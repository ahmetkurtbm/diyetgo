/**
 * Beslenme planı, plan öğünü ve öğün içeriği. Plan → öğün → içerik zinciri veritabanında `CASCADE`
 * ile silinir; öğün veya içerik değiştiğinde planın `updatedAt` alanı güncellenir.
 */
import {
  addDays,
  canAddFoodToMeal,
  canUseMealType,
  isMealSlotValid,
  mealPlanInputSchema,
  mealsOutsidePlan,
  planLengthDays,
  planMealInputSchema,
  planKindChangeIssue,
  planMealItemInputSchema,
  type MealPlan,
  type MealPlanInput,
  type PlanMeal,
  type PlanMealInput,
  type PlanMealItem,
} from '@diyetgo/shared'
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '../db/client'
import { foods, mealPlans, mealTypes, planMealItems, planMeals } from '../db/schema'
import { ApiError, parse } from '../errors'
import { byIdAndOwner, checkId, found, isValidId, now, requireActiveClient, setArchivedValue, toRecord, trCollate, type Executor } from './common'

export type MealPlanDetail = { plan: MealPlan; meals: PlanMeal[]; items: PlanMealItem[] }

const copyTargetSchema = z.object({ clientId: z.string(), startDate: z.string(), title: z.string() })

async function getPlanRow(db: Executor, ownerId: string, id: string) {
  checkId(id, 'Plan')
  return found((await db.select().from(mealPlans).where(byIdAndOwner(mealPlans, id, ownerId)))[0], 'Plan')
}

/** Öğünün sahibi, ait olduğu planın sahibidir. */
async function getMealRow(db: Executor, ownerId: string, id: string) {
  checkId(id, 'Öğün')
  const [row] = await db
    .select({ meal: planMeals })
    .from(planMeals)
    .innerJoin(mealPlans, eq(mealPlans.id, planMeals.mealPlanId))
    .where(and(eq(planMeals.id, id), eq(mealPlans.ownerId, ownerId)))
  return found(row, 'Öğün').meal
}

async function getItemRow(db: Executor, ownerId: string, id: string) {
  checkId(id, 'Öğün içeriği')
  const [row] = await db
    .select({ item: planMealItems })
    .from(planMealItems)
    .innerJoin(planMeals, eq(planMeals.id, planMealItems.planMealId))
    .innerJoin(mealPlans, eq(mealPlans.id, planMeals.mealPlanId))
    .where(and(eq(planMealItems.id, id), eq(mealPlans.ownerId, ownerId)))
  return found(row, 'Öğün içeriği').item
}

async function touchPlan(db: Executor, planId: string) {
  await db.update(mealPlans).set({ updatedAt: now }).where(eq(mealPlans.id, planId))
}

/** Gün plan süresinde olmalı, öğün türü arşivlenmemiş olmalı (mevcut seçim korunabilir), aynı gün aynı öğün bir kez bulunur. */
async function checkMeal(db: Executor, ownerId: string, input: PlanMealInput, selfId: string | null, previousMealTypeId?: string) {
  const plan = await getPlanRow(db, ownerId, input.mealPlanId)
  if (!isMealSlotValid(plan, input.dayNumber)) {
    const message = plan.kind === 'options' ? 'Geçersiz seçenek numarası' : 'Gün plan süresinin dışında'
    throw new ApiError('validation', `${message}.`, { fieldErrors: { dayNumber: message } })
  }
  checkId(input.mealTypeId, 'Öğün türü')
  const mealType = found((await db.select().from(mealTypes).where(byIdAndOwner(mealTypes, input.mealTypeId, ownerId)))[0], 'Öğün türü')
  if (!canUseMealType(mealType, previousMealTypeId)) {
    throw new ApiError('validation', 'Arşivlenmiş öğün türü seçilemez.', { fieldErrors: { mealTypeId: 'Arşivlenmiş öğün türü seçilemez' } })
  }
  const [duplicate] = await db
    .select({ id: planMeals.id })
    .from(planMeals)
    .where(
      and(
        eq(planMeals.mealPlanId, input.mealPlanId),
        eq(planMeals.dayNumber, input.dayNumber),
        eq(planMeals.mealTypeId, input.mealTypeId),
        selfId === null ? undefined : ne(planMeals.id, selfId),
      ),
    )
  if (duplicate) {
    throw new ApiError('conflict', `${input.dayNumber}. gün için "${mealType.name}" öğünü zaten var.`, { conflictingIds: [duplicate.id] })
  }
}

/** Arşivlenmiş besin yeni öğüne eklenemez; mevcut içerikte kalan besin korunabilir. */
/** Seçenekli plandaki haftalık adetlerin öğün türleri bu diyetisyene ait olmalıdır. */
async function checkQuotaMealTypes(db: Executor, ownerId: string, plan: Pick<MealPlanInput, 'weeklyQuotas'>) {
  const ids = plan.weeklyQuotas.map((q) => q.mealTypeId)
  if (ids.length === 0) return
  const owned = await db.select({ id: mealTypes.id }).from(mealTypes).where(and(eq(mealTypes.ownerId, ownerId), inArray(mealTypes.id, ids)))
  if (owned.length !== new Set(ids).size) throw new ApiError('not_found', 'Öğün türü bulunamadı.')
}

async function checkItemFood(db: Executor, ownerId: string, foodId: string, previousFoodId?: string) {
  checkId(foodId, 'Besin')
  const food = found((await db.select().from(foods).where(byIdAndOwner(foods, foodId, ownerId)))[0], 'Besin')
  if (!canAddFoodToMeal(food) && previousFoodId !== foodId) {
    throw new ApiError('validation', 'Arşivlenmiş besin yeni öğüne eklenemez.', { fieldErrors: { foodId: 'Arşivlenmiş besin yeni öğüne eklenemez' } })
  }
}

export function createMealPlanService(db: Db, ownerId: string) {
  return {
    /** En yeni başlangıç tarihi önce. */
    async list({ includeArchived = false, clientId }: { includeArchived?: boolean; clientId?: string } = {}): Promise<MealPlan[]> {
      // Geçersiz kimlikle hiçbir plan eşleşmez (demo moduyla aynı).
      if (clientId !== undefined && !isValidId(clientId)) return []
      const rows = await db
        .select()
        .from(mealPlans)
        .where(
          and(
            eq(mealPlans.ownerId, ownerId),
            includeArchived ? undefined : isNull(mealPlans.archivedAt),
            clientId === undefined ? undefined : eq(mealPlans.clientId, clientId),
          ),
        )
        .orderBy(desc(mealPlans.startDate), trCollate(mealPlans.title))
      return rows.map(toRecord)
    },

    async get(id: string): Promise<MealPlanDetail> {
      const plan = await getPlanRow(db, ownerId, id)
      const meals = await db
        .select({ meal: planMeals })
        .from(planMeals)
        .innerJoin(mealTypes, eq(mealTypes.id, planMeals.mealTypeId))
        .where(eq(planMeals.mealPlanId, id))
        .orderBy(asc(planMeals.dayNumber), asc(mealTypes.sortOrder))
      const mealIds = meals.map((m) => m.meal.id)
      const items =
        mealIds.length === 0
          ? []
          : await db.select().from(planMealItems).where(inArray(planMealItems.planMealId, mealIds)).orderBy(asc(planMealItems.sortOrder))
      return { plan: toRecord(plan), meals: meals.map((m) => toRecord(m.meal)), items: items.map(toRecord) }
    },

    async create(input: unknown): Promise<MealPlan> {
      const values = parse(mealPlanInputSchema, input)
      await requireActiveClient(db, ownerId, values.clientId, 'plan')
      await checkQuotaMealTypes(db, ownerId, values)
      const [row] = await db
        .insert(mealPlans)
        .values({ ...values, ownerId })
        .returning()
      return toRecord(row!)
    },

    async update(id: string, input: unknown): Promise<MealPlan> {
      const values = parse(mealPlanInputSchema, input)
      return db.transaction(async (tx) => {
        const plan = await getPlanRow(tx, ownerId, id)
        if (values.clientId !== plan.clientId) await requireActiveClient(tx, ownerId, values.clientId, 'plan')
        await checkQuotaMealTypes(tx, ownerId, values)
        const meals = await tx.select().from(planMeals).where(eq(planMeals.mealPlanId, id))
        const kindIssue = planKindChangeIssue(plan.kind, values.kind, meals.length)
        if (kindIssue) throw new ApiError('validation', `${kindIssue}.`, { fieldErrors: { kind: kindIssue } })
        const outside = mealsOutsidePlan(values, meals)
        if (outside.length > 0) {
          const days = [...new Set(outside.map((m) => m.dayNumber))].sort((a, b) => a - b).join(', ')
          throw new ApiError('conflict', `Yeni plan süresi mevcut öğünleri dışarıda bırakıyor (gün: ${days}).`, {
            conflictingIds: outside.map((m) => m.id),
          })
        }
        const [row] = await tx
          .update(mealPlans)
          .set({ ...values, updatedAt: now })
          .where(byIdAndOwner(mealPlans, id, ownerId))
          .returning()
        return toRecord(row!)
      })
    },

    async setArchived(id: string, archived: boolean): Promise<MealPlan> {
      await getPlanRow(db, ownerId, id)
      const [row] = await db
        .update(mealPlans)
        .set({ archivedAt: setArchivedValue(mealPlans.archivedAt, archived), updatedAt: now })
        .where(byIdAndOwner(mealPlans, id, ownerId))
        .returning()
      return toRecord(row!)
    },

    /** Plan, öğünleri ve öğün içerikleriyle birlikte silinir (`CASCADE`). */
    async remove(id: string): Promise<void> {
      await getPlanRow(db, ownerId, id)
      await db.delete(mealPlans).where(byIdAndOwner(mealPlans, id, ownerId))
    },

    /** Planı öğünleri ve içerikleriyle kopyalar; plan süresi korunur. */
    async copy(id: string, target: unknown): Promise<MealPlan> {
      const { clientId, startDate, title } = parse(copyTargetSchema, target)
      return db.transaction(async (tx) => {
        const source = await getPlanRow(tx, ownerId, id)
        await requireActiveClient(tx, ownerId, clientId, 'plan')
        const length = planLengthDays(source)
        const values = parse(mealPlanInputSchema, {
          clientId,
          title,
          startDate,
          endDate: length === null ? null : addDays(startDate, length - 1),
          notes: source.notes,
          kind: source.kind,
          weeklyQuotas: source.weeklyQuotas,
        })
        const [plan] = await tx
          .insert(mealPlans)
          .values({ ...values, ownerId })
          .returning()
        const meals = await tx.select().from(planMeals).where(eq(planMeals.mealPlanId, id))
        if (meals.length > 0) {
          const copies = await tx
            .insert(planMeals)
            .values(meals.map((m) => ({ mealPlanId: plan!.id, dayNumber: m.dayNumber, mealTypeId: m.mealTypeId, time: m.time, notes: m.notes })))
            .returning({ id: planMeals.id })
          // `returning` satırları ekleme sırasıyla döner; kaynak öğün kimliği yeni kimliğe eşlenir.
          const newMealId = new Map(meals.map((m, i) => [m.id, copies[i]!.id]))
          const items = await tx.select().from(planMealItems).where(inArray(planMealItems.planMealId, [...newMealId.keys()]))
          if (items.length > 0) {
            await tx.insert(planMealItems).values(
              items.map((i) => ({ planMealId: newMealId.get(i.planMealId)!, foodId: i.foodId, quantity: i.quantity, sortOrder: i.sortOrder, notes: i.notes })),
            )
          }
        }
        return toRecord(plan!)
      })
    },

    async addMeal(input: unknown): Promise<PlanMeal> {
      const values = parse(planMealInputSchema, input)
      return db.transaction(async (tx) => {
        await checkMeal(tx, ownerId, values, null)
        const [row] = await tx.insert(planMeals).values(values).returning()
        await touchPlan(tx, values.mealPlanId)
        return toRecord(row!)
      })
    },

    async updateMeal(id: string, input: unknown): Promise<PlanMeal> {
      const values = parse(planMealInputSchema, input)
      return db.transaction(async (tx) => {
        const meal = await getMealRow(tx, ownerId, id)
        await checkMeal(tx, ownerId, values, id, meal.mealTypeId)
        const [row] = await tx
          .update(planMeals)
          .set({ ...values, updatedAt: now })
          .where(eq(planMeals.id, id))
          .returning()
        await touchPlan(tx, values.mealPlanId)
        return toRecord(row!)
      })
    },

    /** Öğün, içerikleriyle birlikte silinir (`CASCADE`). */
    async removeMeal(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const meal = await getMealRow(tx, ownerId, id)
        await tx.delete(planMeals).where(eq(planMeals.id, id))
        await touchPlan(tx, meal.mealPlanId)
      })
    },

    async addItem(input: unknown): Promise<PlanMealItem> {
      const values = parse(planMealItemInputSchema, input)
      return db.transaction(async (tx) => {
        const meal = await getMealRow(tx, ownerId, values.planMealId)
        await checkItemFood(tx, ownerId, values.foodId)
        const [row] = await tx.insert(planMealItems).values(values).returning()
        await touchPlan(tx, meal.mealPlanId)
        return toRecord(row!)
      })
    },

    async updateItem(id: string, input: unknown): Promise<PlanMealItem> {
      const values = parse(planMealItemInputSchema, input)
      return db.transaction(async (tx) => {
        const item = await getItemRow(tx, ownerId, id)
        const meal = await getMealRow(tx, ownerId, values.planMealId)
        await checkItemFood(tx, ownerId, values.foodId, item.foodId)
        const [row] = await tx
          .update(planMealItems)
          .set({ ...values, updatedAt: now })
          .where(eq(planMealItems.id, id))
          .returning()
        await touchPlan(tx, meal.mealPlanId)
        return toRecord(row!)
      })
    },

    async removeItem(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const item = await getItemRow(tx, ownerId, id)
        const meal = await getMealRow(tx, ownerId, item.planMealId)
        await tx.delete(planMealItems).where(eq(planMealItems.id, id))
        await touchPlan(tx, meal.mealPlanId)
      })
    },
  }
}
