import { describe, expect, it } from 'vitest'
import { istanbulDateOf } from './dates'
import { ageOn, MIN_ADULT_AGE } from './energy'
import { findAppointmentConflicts, goalPeriodsOverlap, isDayWithinPlan } from './rules'
import {
  appointmentSchema,
  clientGoalSchema,
  clientSchema,
  foodSchema,
  mealPlanSchema,
  mealTypeSchema,
  measurementSchema,
  planMealItemSchema,
  planMealSchema,
} from './schemas'
import { createSeedData, SAMPLE_FOOD_SOURCE } from './seed'

const TODAY = '2026-03-10'
const seed = createSeedData(TODAY)

describe('seed verisi', () => {
  it('aynı gün için her zaman aynı veriyi üretir', () => {
    expect(createSeedData(TODAY)).toEqual(seed)
  })

  it('tüm kayıtlar şemalardan geçer', () => {
    const schemas = {
      clients: clientSchema,
      measurements: measurementSchema,
      foods: foodSchema,
      mealTypes: mealTypeSchema,
      mealPlans: mealPlanSchema,
      planMeals: planMealSchema,
      planMealItems: planMealItemSchema,
      appointments: appointmentSchema,
      clientGoals: clientGoalSchema,
    } as const
    for (const [collection, schema] of Object.entries(schemas)) {
      const records = seed[collection as keyof typeof schemas]
      expect(records.length, collection).toBeGreaterThan(0)
      for (const record of records) {
        const result = schema.safeParse(record)
        expect(result.success, `${collection} ${JSON.stringify(result.error?.issues)}`).toBe(true)
      }
    }
  })

  it('kimlikler tüm koleksiyonlarda benzersizdir', () => {
    const ids = Object.values(seed).flatMap((records) => records.map((r) => r.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tüm ilişkiler var olan kayıtlara işaret eder', () => {
    const has = (records: { id: string }[]) => {
      const ids = new Set(records.map((r) => r.id))
      return (id: string) => ids.has(id)
    }
    const isClient = has(seed.clients)
    expect(seed.measurements.every((m) => isClient(m.clientId))).toBe(true)
    expect(seed.mealPlans.every((p) => isClient(p.clientId))).toBe(true)
    expect(seed.appointments.every((a) => isClient(a.clientId))).toBe(true)
    expect(seed.clientGoals.every((g) => isClient(g.clientId))).toBe(true)
    expect(seed.planMeals.every((m) => has(seed.mealPlans)(m.mealPlanId) && has(seed.mealTypes)(m.mealTypeId))).toBe(true)
    expect(seed.planMealItems.every((i) => has(seed.planMeals)(i.planMealId) && has(seed.foods)(i.foodId))).toBe(true)
  })

  it('plan öğünleri plan süresi içindedir ve aynı gün aynı öğün türü tekrarlanmaz', () => {
    const keys = new Set<string>()
    for (const meal of seed.planMeals) {
      const plan = seed.mealPlans.find((p) => p.id === meal.mealPlanId)!
      expect(isDayWithinPlan(plan, meal.dayNumber)).toBe(true)
      const key = `${meal.mealPlanId}/${meal.dayNumber}/${meal.mealTypeId}`
      expect(keys.has(key), key).toBe(false)
      keys.add(key)
    }
  })

  it('hedef dönemleri çakışmaz ve her danışanın en fazla bir açık hedefi vardır', () => {
    for (const client of seed.clients) {
      const goals = seed.clientGoals.filter((g) => g.clientId === client.id)
      expect(goals.filter((g) => g.validTo === null).length).toBeLessThanOrEqual(1)
      for (const [i, a] of goals.entries()) {
        for (const b of goals.slice(i + 1)) expect(goalPeriodsOverlap(a, b)).toBe(false)
      }
    }
  })

  it('iptal edilmemiş randevular çakışmaz', () => {
    for (const appointment of seed.appointments) {
      expect(findAppointmentConflicts(appointment, seed.appointments)).toEqual([])
    }
  })

  it('arşivlenmiş danışanın planı veya planlanmış randevusu yoktur', () => {
    const archived = new Set(seed.clients.filter((c) => c.archivedAt !== null).map((c) => c.id))
    expect(archived.size).toBeGreaterThan(0)
    expect(seed.mealPlans.some((p) => archived.has(p.clientId))).toBe(false)
    expect(seed.appointments.some((a) => archived.has(a.clientId) && a.status === 'scheduled')).toBe(false)
  })

  it('danışanlar yetişkindir', () => {
    for (const client of seed.clients) {
      if (client.birthDate) expect(ageOn(client.birthDate, TODAY)).toBeGreaterThanOrEqual(MIN_ADULT_AGE)
    }
  })

  it('verilen güne göre güncel randevular üretir (İstanbul saatiyle bugün)', () => {
    const todays = seed.appointments.filter((a) => istanbulDateOf(a.startsAt) === TODAY && a.status === 'scheduled')
    expect(todays.length).toBeGreaterThan(0)
    const other = createSeedData('2027-01-01')
    expect(other.appointments.some((a) => istanbulDateOf(a.startsAt) === '2027-01-01')).toBe(true)
  })

  it('artık gün ve yıl sonu gibi tarihlerde de geçerli veri üretir', () => {
    for (const today of ['2028-02-29', '2026-12-31']) {
      const data = createSeedData(today)
      expect(data.appointments.every((a) => appointmentSchema.safeParse(a).success)).toBe(true)
      expect(data.clientGoals.every((g) => clientGoalSchema.safeParse(g).success)).toBe(true)
    }
  })

  it('geçersiz gün için hata verir', () => {
    expect(() => createSeedData('2026-02-30')).toThrow(RangeError)
  })
})

describe('seed verisi kurgusaldır', () => {
  it('e-postalar yalnızca example.com alan adını kullanır, telefon yoktur', () => {
    for (const client of seed.clients) {
      if (client.email !== null) expect(client.email).toMatch(/@example\.com$/)
      expect(client.phone).toBeNull()
    }
  })

  it('tüm seed besinleri doğrulanmamış örnek veri olarak işaretlidir', () => {
    for (const food of seed.foods) {
      expect(food.isSample).toBe(true)
      expect(food.source).toBe(SAMPLE_FOOD_SOURCE)
    }
  })
})
