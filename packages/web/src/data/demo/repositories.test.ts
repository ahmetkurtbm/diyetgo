import { dayTotals, findActiveGoal, istanbulTimeToUtc, mealTotals, type ClientInput, type Food } from '@diyetgo/shared'
import { describe, expect, it } from 'vitest'
import { RepositoryError, type RepositoryErrorCode } from '../repositories'
import { MemoryStorage } from './memory-storage'
import { createDemoRepositories } from './repositories'
import { openDemoStore, STORAGE_KEY } from './store'

const TODAY = '2026-03-10'
const now = () => new Date('2026-03-10T09:00:00.000Z')

function setup(storage = new MemoryStorage()) {
  const opened = openDemoStore({ storage, now })
  if (!opened.ok) throw new Error(opened.error.message)
  return { storage, repos: createDemoRepositories(opened.store, { now }) }
}

async function expectError(promise: Promise<unknown>, code: RepositoryErrorCode): Promise<RepositoryError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(RepositoryError)
  expect((error as RepositoryError).code).toBe(code)
  return error as RepositoryError
}

const newClient: ClientInput = { firstName: 'Yeni', lastName: 'Danışan', birthDate: null, sex: null, email: null, phone: null, notes: null }

async function seedRefs(repos: ReturnType<typeof setup>['repos']) {
  const clients = await repos.clients.list({ includeArchived: true })
  const byName = (name: string) => clients.find((c) => c.firstName === name)!
  const plans = await repos.mealPlans.list()
  const foods = await repos.foods.list()
  const mealTypes = await repos.mealTypes.list()
  return {
    deniz: byName('Deniz'),
    ece: byName('Ece'),
    kaan: byName('Kaan'),
    selin: byName('Selin'),
    denizPlan: plans.find((p) => p.clientId === byName('Deniz').id)!,
    food: (name: string) => foods.find((f) => f.name === name)!,
    mealType: (name: string) => mealTypes.find((t) => t.name === name)!,
  }
}

describe('kalıcılık', () => {
  it('yapılan değişiklikler yeni bir oturumda (sayfa yenileme) korunur', async () => {
    const { storage, repos } = setup()
    const created = await repos.clients.create(newClient)
    const refs = await seedRefs(repos)
    await repos.foods.update(refs.food('Elma').id, { ...refs.food('Elma'), name: 'Yeşil elma' })

    const reloaded = setup(storage).repos
    expect(await reloaded.clients.get(created.id)).toEqual(created)
    expect((await reloaded.foods.get(refs.food('Elma').id)).name).toBe('Yeşil elma')
  })

  it('başarısız işlem depolamaya hiçbir şey yazmaz', async () => {
    const { storage, repos } = setup()
    const refs = await seedRefs(repos)
    const before = storage.getItem(STORAGE_KEY)
    await expectError(repos.clients.remove(refs.deniz.id), 'restricted')
    await expectError(repos.clients.create({ ...newClient, firstName: '' }), 'validation')
    expect(storage.getItem(STORAGE_KEY)).toBe(before)
  })
})

describe('danışanlar', () => {
  it('varsayılan olarak arşivlenmişleri gizler, Türkçe büyük/küçük harf duyarsız arar', async () => {
    const { repos } = setup()
    const names = (await repos.clients.list()).map((c) => c.firstName)
    expect(names).not.toContain('Selin')
    expect((await repos.clients.list({ includeArchived: true })).map((c) => c.firstName)).toContain('Selin')
    expect((await repos.clients.list({ search: 'DENİZ' })).map((c) => c.firstName)).toEqual(['Deniz'])
    expect((await repos.clients.list({ search: 'kaan.taslak@' })).map((c) => c.firstName)).toEqual(['Kaan'])
  })

  it('oluşturur, günceller, arşivler ve arşivden çıkarır', async () => {
    const { repos } = setup()
    const created = await repos.clients.create({ ...newClient, firstName: '  Yeni ' })
    expect(created.firstName).toBe('Yeni')
    expect(created.archivedAt).toBeNull()
    const updated = await repos.clients.update(created.id, { ...newClient, notes: 'Not' })
    expect(updated.notes).toBe('Not')
    expect((await repos.clients.setArchived(created.id, true)).archivedAt).not.toBeNull()
    expect((await repos.clients.setArchived(created.id, false)).archivedAt).toBeNull()
  })

  it('geçersiz girdide alan bazında Türkçe hata verir', async () => {
    const { repos } = setup()
    const error = await expectError(repos.clients.create({ ...newClient, firstName: ' ', email: 'x' }), 'validation')
    expect(error.fieldErrors).toEqual({ firstName: 'Bu alan zorunludur', email: 'Geçerli bir e-posta adresi girin' })
  })

  it('ilişkili kaydı olan danışan silinemez; olmayan silinir', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    await expectError(repos.clients.remove(refs.deniz.id), 'restricted')
    const created = await repos.clients.create(newClient)
    await repos.clients.remove(created.id)
    await expectError(repos.clients.get(created.id), 'not_found')
  })
})

describe('ölçümler', () => {
  it('danışana göre en yeni önce listeler; olmayan danışana ölçüm eklenemez', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const list = await repos.measurements.listByClient(refs.deniz.id)
    expect(list.map((m) => m.measuredOn)).toEqual([...list.map((m) => m.measuredOn)].sort().reverse())
    const input = { clientId: '00000000-0000-4000-8000-0000000000ff', measuredOn: TODAY, weightKg: 70, heightCm: null, waistCm: null, hipCm: null, bodyFatPct: null, notes: null }
    await expectError(repos.measurements.create(input), 'not_found')
  })

  it('en az bir değer ister; ekler, günceller ve siler', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const input = { clientId: refs.ece.id, measuredOn: TODAY, weightKg: null, heightCm: null, waistCm: null, hipCm: null, bodyFatPct: null, notes: null }
    expect((await expectError(repos.measurements.create(input), 'validation')).fieldErrors.weightKg).toBe('En az bir ölçüm değeri girilmeli')
    const created = await repos.measurements.create({ ...input, weightKg: 63.5 })
    expect((await repos.measurements.update(created.id, { ...input, weightKg: 63 })).weightKg).toBe(63)
    await repos.measurements.remove(created.id)
    expect((await repos.measurements.listByClient(refs.ece.id)).some((m) => m.id === created.id)).toBe(false)
  })
})

describe('besinler ve canlı hesaplama', () => {
  it('planda kullanılan besin silinemez; kullanım sayısını verir', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    await expectError(repos.foods.remove(refs.food('Yumurta').id), 'restricted')
    expect(await repos.foods.countPlansUsing(refs.food('Yumurta').id)).toBe(2)
    expect(await repos.foods.countPlansUsing(refs.food('Muz').id)).toBe(1)
  })

  it('besin değeri değişince plan toplamları shared hesaplamasıyla birlikte değişir', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const totals = async () => {
      const { meals, items } = await repos.mealPlans.get(refs.denizPlan.id)
      const foods = new Map<string, Food>((await repos.foods.list({ includeArchived: true })).map((f) => [f.id, f]))
      return dayTotals(1, meals, items, foods).energyKcal
    }
    const before = await totals()
    const milk = refs.food('Süt (yarım yağlı)')
    await repos.foods.update(milk.id, { ...milk, energyKcal: milk.energyKcal + 10 })
    // Plan 1. günde 200 ml süt içeriyor: 10 kcal/100 ml × 2 = 20 kcal artış.
    expect(await totals()).toBeCloseTo(before + 20, 10)
  })

  it('arşivlenmiş besin yeni öğüne eklenemez ama mevcut içerik korunur', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const egg = refs.food('Yumurta')
    await repos.foods.setArchived(egg.id, true)
    const { meals, items } = await repos.mealPlans.get(refs.denizPlan.id)
    const existing = items.find((i) => i.foodId === egg.id)!
    expect(await repos.mealPlans.updateItem(existing.id, { ...existing, quantity: 60 })).toMatchObject({ quantity: 60 })
    const error = await expectError(repos.mealPlans.addItem({ planMealId: meals[0]!.id, foodId: egg.id, quantity: 50, sortOrder: 9, notes: null }), 'validation')
    expect(error.fieldErrors.foodId).toBeDefined()
  })
})

describe('öğün türleri', () => {
  it('aynı adı (büyük/küçük harf duyarsız) reddeder; kullanılan türü silmez', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    await expectError(repos.mealTypes.create({ name: 'KAHVALTI', sortOrder: 9 }), 'validation')
    await expectError(repos.mealTypes.remove(refs.mealType('Kahvaltı').id), 'restricted')
    const created = await repos.mealTypes.create({ name: 'Brunch', sortOrder: 9 })
    await repos.mealTypes.remove(created.id)
    expect((await repos.mealTypes.list()).some((t) => t.id === created.id)).toBe(false)
  })

  it('arşivlenmiş öğün türü yeni öğünde seçilemez', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const night = refs.mealType('Gece ara öğünü')
    await repos.mealTypes.setArchived(night.id, true)
    expect((await repos.mealTypes.list()).some((t) => t.id === night.id)).toBe(false)
    await expectError(repos.mealPlans.addMeal({ mealPlanId: refs.denizPlan.id, dayNumber: 3, mealTypeId: night.id, time: null, notes: null }), 'validation')
  })
})

describe('beslenme planları ve öğünler', () => {
  it('arşivlenmiş danışana plan eklenemez', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const input = { clientId: refs.selin.id, title: 'Plan', startDate: TODAY, endDate: null, notes: null }
    await expectError(repos.mealPlans.create(input), 'restricted')
  })

  it('gün plan süresinde olmalı; aynı gün aynı öğün türü tekrarlanamaz', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const meal = { mealPlanId: refs.denizPlan.id, dayNumber: 29, mealTypeId: refs.mealType('Öğle').id, time: null, notes: null }
    expect((await expectError(repos.mealPlans.addMeal(meal), 'validation')).fieldErrors.dayNumber).toBeDefined()
    await expectError(repos.mealPlans.addMeal({ ...meal, dayNumber: 1 }), 'conflict')
    const added = await repos.mealPlans.addMeal({ ...meal, dayNumber: 28 })
    expect(added.dayNumber).toBe(28)
    expect((await repos.mealPlans.get(refs.denizPlan.id)).plan.updatedAt).toBe(now().toISOString())
  })

  it('plan süresi mevcut öğünleri dışarıda bırakacak şekilde kısaltılamaz', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const plan = refs.denizPlan
    await expectError(repos.mealPlans.update(plan.id, { ...plan, endDate: plan.startDate }), 'conflict')
    expect((await repos.mealPlans.update(plan.id, { ...plan, endDate: null })).endDate).toBeNull()
  })

  it('plan silinince yalnızca kendi öğünleri ve içerikleri silinir', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const other = (await repos.mealPlans.list()).find((p) => p.id !== refs.denizPlan.id)!
    const otherBefore = await repos.mealPlans.get(other.id)
    const { meals } = await repos.mealPlans.get(refs.denizPlan.id)
    await repos.mealPlans.remove(refs.denizPlan.id)
    await expectError(repos.mealPlans.get(refs.denizPlan.id), 'not_found')
    await expectError(repos.mealPlans.removeMeal(meals[0]!.id), 'not_found')
    expect(await repos.mealPlans.get(other.id)).toEqual(otherBefore)
  })

  it('öğün silinince içerikleri de silinir', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const { meals, items } = await repos.mealPlans.get(refs.denizPlan.id)
    const meal = meals[0]!
    await repos.mealPlans.removeMeal(meal.id)
    const after = await repos.mealPlans.get(refs.denizPlan.id)
    expect(after.items.some((i) => i.planMealId === meal.id)).toBe(false)
    expect(after.items.length).toBe(items.filter((i) => i.planMealId !== meal.id).length)
  })

  it('kopyalama yeni kimliklerle aynı içeriği ve süreyi oluşturur; toplamlar aynıdır', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const source = await repos.mealPlans.get(refs.denizPlan.id)
    const copy = await repos.mealPlans.copy(refs.denizPlan.id, { clientId: refs.ece.id, startDate: '2026-04-01', title: 'Kopya' })
    const copied = await repos.mealPlans.get(copy.id)

    expect(copy).toMatchObject({ clientId: refs.ece.id, startDate: '2026-04-01', endDate: '2026-04-28', title: 'Kopya' })
    expect(copied.meals.length).toBe(source.meals.length)
    expect(copied.items.length).toBe(source.items.length)
    const sourceIds = new Set([...source.meals, ...source.items].map((r) => r.id))
    expect([...copied.meals, ...copied.items].some((r) => sourceIds.has(r.id))).toBe(false)

    const foods = new Map<string, Food>((await repos.foods.list()).map((f) => [f.id, f]))
    for (const day of [1, 2]) {
      expect(dayTotals(day, copied.meals, copied.items, foods)).toEqual(dayTotals(day, source.meals, source.items, foods))
    }
    const firstSource = source.meals[0]!
    const firstCopy = copied.meals.find((m) => m.dayNumber === firstSource.dayNumber && m.mealTypeId === firstSource.mealTypeId)!
    expect(mealTotals(firstCopy.id, copied.items, foods)).toEqual(mealTotals(firstSource.id, source.items, foods))
    await expectError(repos.mealPlans.copy(refs.denizPlan.id, { clientId: refs.selin.id, startDate: TODAY, title: 'X' }), 'restricted')
  })
})

describe('randevular', () => {
  const at = (hour: number, minute = 0) => istanbulTimeToUtc(TODAY, hour, minute)

  it('çakışan randevuyu reddeder; uç uca eklenen ve iptal edilmiş randevuyla çakışmayı yok sayar', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    // Seed: Deniz bugün 10:00–10:45.
    const input = { clientId: refs.ece.id, startsAt: at(10, 30), endsAt: at(11), status: 'scheduled' as const, notes: null }
    const error = await expectError(repos.appointments.create(input), 'conflict')
    expect(error.conflictingIds.length).toBe(1)
    const adjacent = await repos.appointments.create({ ...input, startsAt: at(10, 45), endsAt: at(11, 15) })
    await repos.appointments.cancel(adjacent.id)
    expect((await repos.appointments.create({ ...input, startsAt: at(10, 45), endsAt: at(11, 15) })).status).toBe('scheduled')
  })

  it('düzenlenen randevu kendisiyle çakışmaz; arşivlenmiş danışana randevu eklenemez', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const [todays] = await repos.appointments.list({ from: at(0), to: istanbulTimeToUtc('2026-03-11', 0, 0) })
    expect(todays).toBeDefined()
    expect(await repos.appointments.update(todays!.id, { ...todays!, endsAt: at(11) })).toMatchObject({ endsAt: at(11) })
    await expectError(repos.appointments.create({ clientId: refs.selin.id, startsAt: at(15), endsAt: at(16), status: 'scheduled', notes: null }), 'restricted')
  })

  it('zaman aralığı [from, to) olarak filtrelenir', async () => {
    const { repos } = setup()
    const startOfDay = at(0)
    const list = await repos.appointments.list({ from: startOfDay, to: at(10) })
    expect(list.some((a) => a.startsAt === at(10))).toBe(false)
    expect((await repos.appointments.list({ from: startOfDay, to: at(10, 1) })).some((a) => a.startsAt === at(10))).toBe(true)
  })
})

describe('hedefler', () => {
  const goal = (clientId: string, validFrom: string, validTo: string | null) => ({
    clientId,
    validFrom,
    validTo,
    energyKcal: 1700,
    proteinG: 90,
    carbsG: 190,
    fatG: 60,
    method: 'manual' as const,
    activityFactor: null,
    notes: null,
  })

  it('yeni hedef, önceki açık hedefi aynı işlemde kapatır', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    const { goal: created, closed } = await repos.goals.create(goal(refs.deniz.id, '2026-03-11', null))
    expect(closed?.validTo).toBe(TODAY)
    const goals = await repos.goals.listByClient(refs.deniz.id)
    expect(findActiveGoal(goals, TODAY)?.id).toBe(closed?.id)
    expect(findActiveGoal(goals, '2026-03-11')?.id).toBe(created.id)
    expect(goals.filter((g) => g.validTo === null)).toHaveLength(1)
  })

  it('çakışan dönemi oluşturmada ve güncellemede reddeder', async () => {
    const { repos } = setup()
    const refs = await seedRefs(repos)
    // Seed: Deniz'in kapalı hedefi 2026-01-09 – 2026-03-02.
    await expectError(repos.goals.create(goal(refs.deniz.id, '2026-03-02', '2026-03-02')), 'conflict')
    const [open] = await repos.goals.listByClient(refs.deniz.id)
    await expectError(repos.goals.update(open!.id, { ...open!, validFrom: '2026-03-01' }), 'conflict')
  })
})

describe('demo kontrolleri', () => {
  it('kayıt sayılarını verir ve sıfırlamada örnek verilere döner', async () => {
    const { repos } = setup()
    await repos.clients.create(newClient)
    const info = await repos.demo!.info()
    expect(info.counts.clients).toBe(5)
    expect(info.persistent).toBe(true)
    await repos.demo!.reset()
    expect((await repos.demo!.info()).counts.clients).toBe(4)
  })
})
