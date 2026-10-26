/**
 * Repository arayüzlerinin localStorage implementasyonu.
 *
 * Veritabanının uygulayacağı bütünlük kurallarını burada da uygular:
 * RESTRICT (ilişkili kaydı olan danışan/besin/öğün türü silinemez), CASCADE (plan → öğün → içerik),
 * arşiv kuralları, randevu çakışması ve hedef dönemleri. Kurallar `@diyetgo/shared`'dan gelir.
 */
import {
  addDays,
  appointmentInputSchema,
  canAddFoodToMeal,
  canAddPlanOrAppointment,
  canUseMealType,
  copyMealsInputSchema,
  clientConditionInputSchema,
  clientGoalInputSchema,
  clientInputSchema,
  clientMedicationInputSchema,
  clientRecommendationInputSchema,
  findAppointmentConflicts,
  foodInputSchema,
  foodKindChangeIssue,
  goalPeriodsOverlap,
  isMealSlotValid,
  mealCopySlots,
  isMealTypeNameTaken,
  mealPlanInputSchema,
  mealsOutsidePlan,
  mealTypeInputSchema,
  measurementInputSchema,
  planLengthDays,
  planMealInputSchema,
  planMealItemInputSchema,
  planKindChangeIssue,
  planNewGoal,
  recipeIngredientIssue,
  recipeIngredientsInputSchema,
  type CopyMealsResult,
  type MealPlan,
  type PlanMeal,
} from '@diyetgo/shared'
import { RepositoryError, type ClientRecordRepository, type Repositories } from '../repositories'
import type { DemoData, DemoStore } from './store'

type Schema<T> = {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } }
}

function parse<T>(schema: Schema<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const fieldErrors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '_form')
    fieldErrors[field] ??= issue.message
  }
  throw new RepositoryError('validation', 'Lütfen işaretli alanları düzeltin.', { fieldErrors })
}

function find<T extends { id: string }>(records: T[], id: string, label: string): T {
  const record = records.find((r) => r.id === id)
  if (!record) throw new RepositoryError('not_found', `${label} bulunamadı.`)
  return record
}

function removeWhere<T>(records: T[], predicate: (record: T) => boolean): void {
  for (let i = records.length - 1; i >= 0; i--) if (predicate(records[i]!)) records.splice(i, 1)
}

/** PostgreSQL'in `DESC` sıralaması gibi: boş değerler (`null`) önce, ardından büyükten küçüğe. */
const descNullsFirst = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? -1 : b === null ? 1 : b.localeCompare(a))

const collator = new Intl.Collator('tr-TR')
const normalize = (value: string) => value.toLocaleLowerCase('tr-TR')
const matches = (search: string | undefined, ...fields: (string | null)[]) =>
  !search?.trim() || fields.some((f) => f !== null && normalize(f).includes(normalize(search.trim())))

export function createDemoRepositories(
  store: DemoStore,
  options: { now?: () => Date; newId?: () => string } = {},
): Repositories {
  const now = options.now ?? (() => new Date())
  const newId = options.newId ?? (() => crypto.randomUUID())

  const read = () => store.read().data

  /** Güncel veriyi okur, değişikliği uygular ve tek seferde yazar. `fn` hata verirse hiçbir şey yazılmaz. */
  async function mutate<R>(fn: (data: DemoData, timestamp: string) => R): Promise<R> {
    const data = read()
    const result = fn(data, now().toISOString())
    store.write(data)
    return result
  }

  const stamp = (timestamp: string) => ({ id: newId(), createdAt: timestamp, updatedAt: timestamp })

  function activeClient(data: DemoData, clientId: string, action: string) {
    const client = find(data.clients, clientId, 'Danışan')
    if (!canAddPlanOrAppointment(client)) {
      throw new RepositoryError('restricted', `Arşivlenmiş danışana yeni ${action} eklenemez.`)
    }
    return client
  }

  function touchPlan(data: DemoData, planId: string, timestamp: string) {
    find(data.mealPlans, planId, 'Plan').updatedAt = timestamp
  }

  function checkMeal(data: DemoData, input: ReturnType<typeof planMealInputSchema.parse>, selfId: string | null, previous?: PlanMeal) {
    const plan = find(data.mealPlans, input.mealPlanId, 'Plan')
    if (!isMealSlotValid(plan, input.dayNumber)) {
      const message = plan.kind === 'options' ? 'Geçersiz seçenek numarası' : 'Gün plan süresinin dışında'
      throw new RepositoryError('validation', `${message}.`, { fieldErrors: { dayNumber: message } })
    }
    const mealType = find(data.mealTypes, input.mealTypeId, 'Öğün türü')
    if (!canUseMealType(mealType, previous?.mealTypeId)) {
      throw new RepositoryError('validation', 'Arşivlenmiş öğün türü seçilemez.', { fieldErrors: { mealTypeId: 'Arşivlenmiş öğün türü seçilemez' } })
    }
    const duplicate = data.planMeals.find(
      (m) => m.id !== selfId && m.mealPlanId === input.mealPlanId && m.dayNumber === input.dayNumber && m.mealTypeId === input.mealTypeId,
    )
    if (duplicate) {
      throw new RepositoryError('conflict', `${input.dayNumber}. gün için "${mealType.name}" öğünü zaten var.`, { conflictingIds: [duplicate.id] })
    }
  }

  /** Seçenekli plandaki haftalık adetlerin öğün türleri var olmalıdır. */
  function checkQuotaMealTypes(data: DemoData, plan: Pick<MealPlan, 'weeklyQuotas'>) {
    for (const quota of plan.weeklyQuotas) find(data.mealTypes, quota.mealTypeId, 'Öğün türü')
  }

  function checkItemFood(data: DemoData, foodId: string, previousFoodId?: string) {
    const food = find(data.foods, foodId, 'Besin')
    if (!canAddFoodToMeal(food) && previousFoodId !== foodId) {
      throw new RepositoryError('validation', 'Arşivlenmiş besin yeni öğüne eklenemez.', { fieldErrors: { foodId: 'Arşivlenmiş besin yeni öğüne eklenemez' } })
    }
  }

  function checkAppointmentConflicts(data: DemoData, candidate: Parameters<typeof findAppointmentConflicts>[0]) {
    const conflicts = findAppointmentConflicts(candidate, data.appointments)
    if (conflicts.length > 0) {
      throw new RepositoryError('conflict', 'Bu saat başka bir randevuyla çakışıyor.', { conflictingIds: conflicts.map((a) => a.id) })
    }
  }

  type RecordCollection = 'clientMedications' | 'clientConditions' | 'clientRecommendations'

  /** İlaç, hastalık ve öneri: danışana bağlı, alt kaydı olmayan kayıtlar için ortak davranış. */
  function clientRecords<K extends RecordCollection, I extends { clientId: string }>(
    collection: K,
    schema: Schema<I>,
    label: string,
    compare: (a: DemoData[K][number], b: DemoData[K][number]) => number,
  ): ClientRecordRepository<DemoData[K][number], I> {
    type R = DemoData[K][number]
    const records = (data: DemoData) => data[collection] as R[]
    return {
      async listByClient(clientId) {
        return records(read())
          .filter((r) => r.clientId === clientId)
          .sort(compare)
      },
      create: (input) =>
        mutate((data, ts) => {
          const parsed = parse(schema, input)
          find(data.clients, parsed.clientId, 'Danışan')
          const record = { ...parsed, ...stamp(ts) } as unknown as R
          records(data).push(record)
          return record
        }),
      update: (id, input) =>
        mutate((data, ts) => {
          const parsed = parse(schema, input)
          find(data.clients, parsed.clientId, 'Danışan')
          return Object.assign(find(records(data), id, label), parsed, { updatedAt: ts })
        }),
      remove: (id) =>
        mutate((data) => {
          find(records(data), id, label)
          removeWhere(records(data), (r) => r.id === id)
        }),
    }
  }

  return {
    mode: 'demo',
    subscribe: (listener) => store.subscribe(listener),

    clients: {
      async list({ includeArchived = false, search } = {}) {
        return read()
          .clients.filter((c) => (includeArchived || c.archivedAt === null) && matches(search, `${c.firstName} ${c.lastName}`, c.email))
          .sort((a, b) => collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName))
      },
      async get(id) {
        return find(read().clients, id, 'Danışan')
      },
      create: (input) =>
        mutate((data, ts) => {
          const client = { ...parse(clientInputSchema, input), ...stamp(ts), archivedAt: null }
          data.clients.push(client)
          return client
        }),
      update: (id, input) =>
        mutate((data, ts) => Object.assign(find(data.clients, id, 'Danışan'), parse(clientInputSchema, input), { updatedAt: ts })),
      setArchived: (id, archived) =>
        mutate((data, ts) => {
          const client = find(data.clients, id, 'Danışan')
          return Object.assign(client, { archivedAt: archived ? (client.archivedAt ?? ts) : null, updatedAt: ts })
        }),
      remove: (id) =>
        mutate((data) => {
          find(data.clients, id, 'Danışan')
          const related =
            data.measurements.some((m) => m.clientId === id) ||
            data.mealPlans.some((p) => p.clientId === id) ||
            data.appointments.some((a) => a.clientId === id) ||
            data.clientGoals.some((g) => g.clientId === id) ||
            data.clientMedications.some((m) => m.clientId === id) ||
            data.clientConditions.some((c) => c.clientId === id) ||
            data.clientRecommendations.some((r) => r.clientId === id)
          if (related) {
            throw new RepositoryError('restricted', 'Bu danışanın ölçüm, plan, randevu, hedef, ilaç, hastalık veya öneri kayıtları var. Silmek yerine arşivleyin.')
          }
          removeWhere(data.clients, (c) => c.id === id)
        }),
    },

    measurements: {
      async listByClient(clientId) {
        return read()
          .measurements.filter((m) => m.clientId === clientId)
          .sort((a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.createdAt.localeCompare(a.createdAt))
      },
      create: (input) =>
        mutate((data, ts) => {
          const parsed = parse(measurementInputSchema, input)
          find(data.clients, parsed.clientId, 'Danışan')
          const measurement = { ...parsed, ...stamp(ts) }
          data.measurements.push(measurement)
          return measurement
        }),
      update: (id, input) =>
        mutate((data, ts) => {
          const parsed = parse(measurementInputSchema, input)
          find(data.clients, parsed.clientId, 'Danışan')
          return Object.assign(find(data.measurements, id, 'Ölçüm'), parsed, { updatedAt: ts })
        }),
      remove: (id) =>
        mutate((data) => {
          find(data.measurements, id, 'Ölçüm')
          removeWhere(data.measurements, (m) => m.id === id)
        }),
    },

    foods: {
      async list({ includeArchived = false, search } = {}) {
        return read()
          .foods.filter((f) => (includeArchived || f.archivedAt === null) && matches(search, f.name, f.brand))
          .sort((a, b) => collator.compare(a.name, b.name))
      },
      async get(id) {
        return find(read().foods, id, 'Besin')
      },
      create: (input) =>
        mutate((data, ts) => {
          const food = { ...parse(foodInputSchema, input), ...stamp(ts), archivedAt: null }
          data.foods.push(food)
          return food
        }),
      update: (id, input) =>
        mutate((data, ts) => {
          const parsed = parse(foodInputSchema, input)
          const food = find(data.foods, id, 'Besin')
          const issue = foodKindChangeIssue(food.recipeYieldG !== null, parsed.recipeYieldG !== null, {
            hasIngredients: data.recipeIngredients.some((i) => i.recipeId === id),
            usedAsIngredient: data.recipeIngredients.some((i) => i.foodId === id),
          })
          if (issue) throw new RepositoryError('validation', `${issue.message}.`, { fieldErrors: { [issue.field]: issue.message } })
          return Object.assign(food, parsed, { updatedAt: ts })
        }),
      setArchived: (id, archived) =>
        mutate((data, ts) => {
          const food = find(data.foods, id, 'Besin')
          return Object.assign(food, { archivedAt: archived ? (food.archivedAt ?? ts) : null, updatedAt: ts })
        }),
      remove: (id) =>
        mutate((data) => {
          find(data.foods, id, 'Besin')
          if (data.planMealItems.some((i) => i.foodId === id) || data.recipeIngredients.some((i) => i.foodId === id)) {
            throw new RepositoryError('restricted', 'Bu besin bir planda veya tarifte kullanılıyor. Silmek yerine arşivleyin.')
          }
          // Tarif silinince malzemeleri de silinir (CASCADE).
          removeWhere(data.recipeIngredients, (i) => i.recipeId === id)
          removeWhere(data.foods, (f) => f.id === id)
        }),
      async countPlansUsing(id) {
        const data = read()
        const mealIds = new Set(data.planMealItems.filter((i) => i.foodId === id).map((i) => i.planMealId))
        return new Set(data.planMeals.filter((m) => mealIds.has(m.id)).map((m) => m.mealPlanId)).size
      },
      async listIngredients() {
        // Sunucuyla aynı sıra: tarif kimliği, ardından liste sırası.
        return read().recipeIngredients.sort((a, b) => a.recipeId.localeCompare(b.recipeId) || a.sortOrder - b.sortOrder)
      },
      setIngredients: (recipeId, input) =>
        mutate((data, ts) => {
          const items = parse(recipeIngredientsInputSchema, input)
          const recipe = find(data.foods, recipeId, 'Besin')
          if (recipe.recipeYieldG === null) throw new RepositoryError('validation', 'Malzeme yalnızca tariflere eklenebilir.')
          const current = new Set(data.recipeIngredients.filter((i) => i.recipeId === recipeId).map((i) => i.foodId))
          for (const item of items) {
            const food = data.foods.find((f) => f.id === item.foodId)
            if (!food) throw new RepositoryError('not_found', 'Malzeme besini bulunamadı.')
            const issue = food.id === recipeId ? 'Bir tarif başka bir tarifin malzemesi olamaz' : recipeIngredientIssue(food, current)
            if (issue) throw new RepositoryError('validation', `${food.name}: ${issue}.`, { fieldErrors: { ingredients: `${food.name}: ${issue}` } })
          }
          removeWhere(data.recipeIngredients, (i) => i.recipeId === recipeId)
          const rows = items.map((item, sortOrder) => ({ ...stamp(ts), recipeId, foodId: item.foodId, quantity: item.quantity, sortOrder }))
          data.recipeIngredients.push(...rows)
          recipe.updatedAt = ts
          return rows
        }),
    },

    mealTypes: {
      async list({ includeArchived = false } = {}) {
        return read()
          .mealTypes.filter((t) => includeArchived || t.archivedAt === null)
          .sort((a, b) => a.sortOrder - b.sortOrder || collator.compare(a.name, b.name))
      },
      create: (input) =>
        mutate((data, ts) => {
          const parsed = parse(mealTypeInputSchema, input)
          if (isMealTypeNameTaken(data.mealTypes, parsed.name, null)) {
            throw new RepositoryError('validation', 'Bu adla bir öğün türü zaten var.', { fieldErrors: { name: 'Bu adla bir öğün türü zaten var' } })
          }
          const mealType = { ...parsed, ...stamp(ts), archivedAt: null }
          data.mealTypes.push(mealType)
          return mealType
        }),
      update: (id, input) =>
        mutate((data, ts) => {
          const parsed = parse(mealTypeInputSchema, input)
          if (isMealTypeNameTaken(data.mealTypes, parsed.name, id)) {
            throw new RepositoryError('validation', 'Bu adla bir öğün türü zaten var.', { fieldErrors: { name: 'Bu adla bir öğün türü zaten var' } })
          }
          return Object.assign(find(data.mealTypes, id, 'Öğün türü'), parsed, { updatedAt: ts })
        }),
      setArchived: (id, archived) =>
        mutate((data, ts) => {
          const mealType = find(data.mealTypes, id, 'Öğün türü')
          return Object.assign(mealType, { archivedAt: archived ? (mealType.archivedAt ?? ts) : null, updatedAt: ts })
        }),
      remove: (id) =>
        mutate((data) => {
          find(data.mealTypes, id, 'Öğün türü')
          if (data.planMeals.some((m) => m.mealTypeId === id)) {
            throw new RepositoryError('restricted', 'Bu öğün türü bir planda kullanılıyor. Silmek yerine arşivleyin.')
          }
          removeWhere(data.mealTypes, (t) => t.id === id)
        }),
    },

    mealPlans: {
      async list({ includeArchived = false, clientId } = {}) {
        return read()
          .mealPlans.filter((p) => (includeArchived || p.archivedAt === null) && (clientId === undefined || p.clientId === clientId))
          .sort((a, b) => b.startDate.localeCompare(a.startDate) || collator.compare(a.title, b.title))
      },
      async get(id) {
        const data = read()
        const plan = find(data.mealPlans, id, 'Plan')
        const typeOrder = new Map(data.mealTypes.map((t) => [t.id, t.sortOrder]))
        const meals = data.planMeals
          .filter((m) => m.mealPlanId === id)
          .sort((a, b) => a.dayNumber - b.dayNumber || (typeOrder.get(a.mealTypeId) ?? 0) - (typeOrder.get(b.mealTypeId) ?? 0))
        const mealIds = new Set(meals.map((m) => m.id))
        const items = data.planMealItems.filter((i) => mealIds.has(i.planMealId)).sort((a, b) => a.sortOrder - b.sortOrder)
        return { plan, meals, items }
      },
      create: (input) =>
        mutate((data, ts) => {
          const parsed = parse(mealPlanInputSchema, input)
          activeClient(data, parsed.clientId, 'plan')
          checkQuotaMealTypes(data, parsed)
          const plan = { ...parsed, ...stamp(ts), archivedAt: null }
          data.mealPlans.push(plan)
          return plan
        }),
      update: (id, input) =>
        mutate((data, ts) => {
          const parsed = parse(mealPlanInputSchema, input)
          const plan = find(data.mealPlans, id, 'Plan')
          if (parsed.clientId !== plan.clientId) activeClient(data, parsed.clientId, 'plan')
          checkQuotaMealTypes(data, parsed)
          const kindIssue = planKindChangeIssue(plan.kind, parsed.kind, data.planMeals.filter((m) => m.mealPlanId === id).length)
          if (kindIssue) throw new RepositoryError('validation', `${kindIssue}.`, { fieldErrors: { kind: kindIssue } })
          const outside = mealsOutsidePlan(parsed, data.planMeals.filter((m) => m.mealPlanId === id))
          if (outside.length > 0) {
            const days = [...new Set(outside.map((m) => m.dayNumber))].sort((a, b) => a - b).join(', ')
            throw new RepositoryError('conflict', `Yeni plan süresi mevcut öğünleri dışarıda bırakıyor (gün: ${days}).`, {
              conflictingIds: outside.map((m) => m.id),
            })
          }
          return Object.assign(plan, parsed, { updatedAt: ts })
        }),
      setArchived: (id, archived) =>
        mutate((data, ts) => {
          const plan = find(data.mealPlans, id, 'Plan')
          return Object.assign(plan, { archivedAt: archived ? (plan.archivedAt ?? ts) : null, updatedAt: ts })
        }),
      remove: (id) =>
        mutate((data) => {
          find(data.mealPlans, id, 'Plan')
          const mealIds = new Set(data.planMeals.filter((m) => m.mealPlanId === id).map((m) => m.id))
          removeWhere(data.planMealItems, (i) => mealIds.has(i.planMealId))
          removeWhere(data.planMeals, (m) => m.mealPlanId === id)
          removeWhere(data.mealPlans, (p) => p.id === id)
        }),
      copy: (id, target) =>
        mutate((data, ts) => {
          const source = find(data.mealPlans, id, 'Plan')
          activeClient(data, target.clientId, 'plan')
          const length = planLengthDays(source)
          const parsed = parse(mealPlanInputSchema, {
            clientId: target.clientId,
            title: target.title,
            startDate: target.startDate,
            endDate: length === null ? null : addDays(target.startDate, length - 1),
            notes: source.notes,
            kind: source.kind,
            weeklyQuotas: source.weeklyQuotas,
          })
          const plan: MealPlan = { ...parsed, ...stamp(ts), archivedAt: null }
          data.mealPlans.push(plan)
          for (const meal of data.planMeals.filter((m) => m.mealPlanId === id)) {
            const copy = { ...meal, ...stamp(ts), mealPlanId: plan.id }
            data.planMeals.push(copy)
            for (const item of data.planMealItems.filter((i) => i.planMealId === meal.id)) {
              data.planMealItems.push({ ...item, ...stamp(ts), planMealId: copy.id })
            }
          }
          return plan
        }),
      copyMeals: (planId, input) =>
        mutate((data, ts) => {
          const parsed = parse(copyMealsInputSchema, input)
          const plan = find(data.mealPlans, planId, 'Plan')
          const sources = [...new Set(parsed.mealIds)].map((mealId) => {
            const meal = find(data.planMeals, mealId, 'Öğün')
            if (meal.mealPlanId !== planId) throw new RepositoryError('not_found', 'Öğün bulunamadı.')
            return meal
          })
          const result: CopyMealsResult = { meals: 0, items: 0 }
          for (const { source, dayNumber, mealTypeId } of mealCopySlots(sources, parsed.targets)) {
            if (!isMealSlotValid(plan, dayNumber)) {
              const message = plan.kind === 'options' ? 'Geçersiz seçenek numarası' : 'Gün plan süresinin dışında'
              throw new RepositoryError('validation', `${message}.`, { fieldErrors: { dayNumber: message } })
            }
            const mealType = find(data.mealTypes, mealTypeId, 'Öğün türü')
            let target = data.planMeals.find((m) => m.mealPlanId === planId && m.dayNumber === dayNumber && m.mealTypeId === mealTypeId)
            if (!target) {
              if (!canUseMealType(mealType)) {
                throw new RepositoryError('validation', 'Arşivlenmiş öğün türü seçilemez.', { fieldErrors: { mealTypeId: 'Arşivlenmiş öğün türü seçilemez' } })
              }
              target = { ...stamp(ts), mealPlanId: planId, dayNumber, mealTypeId, time: source.time, notes: source.notes }
              data.planMeals.push(target)
              result.meals++
            }
            const targetId = target.id
            let sortOrder = Math.max(-1, ...data.planMealItems.filter((i) => i.planMealId === targetId).map((i) => i.sortOrder)) + 1
            const copies = data.planMealItems.filter((i) => i.planMealId === source.id).sort((a, b) => a.sortOrder - b.sortOrder)
            for (const item of copies) data.planMealItems.push({ ...item, ...stamp(ts), planMealId: targetId, sortOrder: sortOrder++ })
            result.items += copies.length
          }
          touchPlan(data, planId, ts)
          return result
        }),
      addMeal: (input) =>
        mutate((data, ts) => {
          const parsed = parse(planMealInputSchema, input)
          checkMeal(data, parsed, null)
          const meal = { ...parsed, ...stamp(ts) }
          data.planMeals.push(meal)
          touchPlan(data, parsed.mealPlanId, ts)
          return meal
        }),
      updateMeal: (id, input) =>
        mutate((data, ts) => {
          const parsed = parse(planMealInputSchema, input)
          const meal = find(data.planMeals, id, 'Öğün')
          checkMeal(data, parsed, id, meal)
          touchPlan(data, parsed.mealPlanId, ts)
          return Object.assign(meal, parsed, { updatedAt: ts })
        }),
      removeMeal: (id) =>
        mutate((data, ts) => {
          const meal = find(data.planMeals, id, 'Öğün')
          removeWhere(data.planMealItems, (i) => i.planMealId === id)
          removeWhere(data.planMeals, (m) => m.id === id)
          touchPlan(data, meal.mealPlanId, ts)
        }),
      addItem: (input) =>
        mutate((data, ts) => {
          const parsed = parse(planMealItemInputSchema, input)
          const meal = find(data.planMeals, parsed.planMealId, 'Öğün')
          checkItemFood(data, parsed.foodId)
          const item = { ...parsed, ...stamp(ts) }
          data.planMealItems.push(item)
          touchPlan(data, meal.mealPlanId, ts)
          return item
        }),
      updateItem: (id, input) =>
        mutate((data, ts) => {
          const parsed = parse(planMealItemInputSchema, input)
          const item = find(data.planMealItems, id, 'Öğün içeriği')
          const meal = find(data.planMeals, parsed.planMealId, 'Öğün')
          checkItemFood(data, parsed.foodId, item.foodId)
          touchPlan(data, meal.mealPlanId, ts)
          return Object.assign(item, parsed, { updatedAt: ts })
        }),
      removeItem: (id) =>
        mutate((data, ts) => {
          const item = find(data.planMealItems, id, 'Öğün içeriği')
          const meal = find(data.planMeals, item.planMealId, 'Öğün')
          removeWhere(data.planMealItems, (i) => i.id === id)
          touchPlan(data, meal.mealPlanId, ts)
        }),
    },

    appointments: {
      async list({ from, to, clientId, status } = {}) {
        const fromMs = from === undefined ? -Infinity : Date.parse(from)
        const toMs = to === undefined ? Infinity : Date.parse(to)
        return read()
          .appointments.filter((a) => {
            const start = Date.parse(a.startsAt)
            return start >= fromMs && start < toMs && (clientId === undefined || a.clientId === clientId) && (status === undefined || a.status === status)
          })
          .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      },
      create: (input) =>
        mutate((data, ts) => {
          const parsed = parse(appointmentInputSchema, input)
          activeClient(data, parsed.clientId, 'randevu')
          checkAppointmentConflicts(data, parsed)
          const appointment = { ...parsed, ...stamp(ts) }
          data.appointments.push(appointment)
          return appointment
        }),
      update: (id, input) =>
        mutate((data, ts) => {
          const parsed = parse(appointmentInputSchema, input)
          const appointment = find(data.appointments, id, 'Randevu')
          if (parsed.clientId !== appointment.clientId) activeClient(data, parsed.clientId, 'randevu')
          checkAppointmentConflicts(data, { ...parsed, id })
          return Object.assign(appointment, parsed, { updatedAt: ts })
        }),
      cancel: (id) =>
        mutate((data, ts) => Object.assign(find(data.appointments, id, 'Randevu'), { status: 'cancelled' as const, updatedAt: ts })),
      remove: (id) =>
        mutate((data) => {
          find(data.appointments, id, 'Randevu')
          removeWhere(data.appointments, (a) => a.id === id)
        }),
    },

    goals: {
      async listByClient(clientId) {
        return read()
          .clientGoals.filter((g) => g.clientId === clientId)
          .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
      },
      create: (input) =>
        mutate((data, ts) => {
          const parsed = parse(clientGoalInputSchema, input)
          find(data.clients, parsed.clientId, 'Danışan')
          const placement = planNewGoal(
            data.clientGoals.filter((g) => g.clientId === parsed.clientId),
            parsed,
          )
          if (!placement.ok) {
            throw new RepositoryError('conflict', 'Bu dönem başka bir hedefle çakışıyor.', { conflictingIds: placement.conflictingIds })
          }
          const closed = placement.close
            ? Object.assign(find(data.clientGoals, placement.close.id, 'Hedef'), { validTo: placement.close.validTo, updatedAt: ts })
            : null
          const goal = { ...parsed, ...stamp(ts) }
          data.clientGoals.push(goal)
          return { goal, closed }
        }),
      update: (id, input) =>
        mutate((data, ts) => {
          const parsed = parse(clientGoalInputSchema, input)
          const goal = find(data.clientGoals, id, 'Hedef')
          find(data.clients, parsed.clientId, 'Danışan')
          const conflicts = data.clientGoals.filter((g) => g.id !== id && g.clientId === parsed.clientId && goalPeriodsOverlap(g, parsed))
          if (conflicts.length > 0) {
            throw new RepositoryError('conflict', 'Bu dönem başka bir hedefle çakışıyor.', { conflictingIds: conflicts.map((g) => g.id) })
          }
          return Object.assign(goal, parsed, { updatedAt: ts })
        }),
      remove: (id) =>
        mutate((data) => {
          find(data.clientGoals, id, 'Hedef')
          removeWhere(data.clientGoals, (g) => g.id === id)
        }),
    },

    medications: clientRecords(
      'clientMedications',
      clientMedicationInputSchema,
      'İlaç kaydı',
      (a, b) => descNullsFirst(a.endedOn, b.endedOn) || descNullsFirst(a.startedOn, b.startedOn) || a.createdAt.localeCompare(b.createdAt),
    ),
    conditions: clientRecords('clientConditions', clientConditionInputSchema, 'Hastalık kaydı', (a, b) => a.createdAt.localeCompare(b.createdAt)),
    recommendations: clientRecords(
      'clientRecommendations',
      clientRecommendationInputSchema,
      'Öneri',
      (a, b) => b.givenOn.localeCompare(a.givenOn) || b.createdAt.localeCompare(a.createdAt),
    ),

    demo: {
      async info() {
        const { seededAt, data } = store.read()
        const counts = Object.fromEntries(Object.entries(data).map(([name, records]) => [name, records.length]))
        return { persistent: store.persistent, seededAt, counts }
      },
      async reset() {
        store.reset()
      },
    },
  }
}
