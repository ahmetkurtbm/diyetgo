import { describe, expect, it } from 'vitest'
import {
  appointmentInputSchema,
  clientGoalInputSchema,
  clientInputSchema,
  clientSchema,
  foodInputSchema,
  LIMITS,
  mealPlanInputSchema,
  clientConditionInputSchema,
  clientMedicationInputSchema,
  clientRecommendationInputSchema,
  measurementInputSchema,
  planMealInputSchema,
  planMealItemInputSchema,
} from './schemas'

const ID = '00000000-0000-4000-8000-000000000001'
const ID2 = '00000000-0000-4000-8000-000000000002'
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(true)
const fail = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(false)

describe('Türkçe doğrulama mesajları', () => {
  const message = (schema: { safeParse: (v: unknown) => { error?: { issues: { message: string }[] } } }, value: unknown) =>
    schema.safeParse(value).error?.issues[0]?.message

  it('yaygın hatalar için kullanıcıya uygun mesaj üretir', () => {
    const client = { firstName: '  ', lastName: 'X', birthDate: null, sex: null, email: null, phone: null, notes: null }
    expect(message(clientInputSchema, client)).toBe('Bu alan zorunludur')
    expect(message(clientInputSchema, { ...client, firstName: 'A', email: 'x' })).toBe('Geçerli bir e-posta adresi girin')
    expect(message(clientInputSchema, { ...client, firstName: 'A', birthDate: '2026-02-30' })).toBe('Geçerli bir tarih girin')
    expect(message(clientInputSchema, { ...client, firstName: 'A', sex: 'x' })).toBe('Geçerli bir seçenek seçin')
    expect(message(clientInputSchema, { lastName: 'X' })).toBe('Bu alan zorunludur')
  })

  it('sayısal sınırları Türkçe sayı biçimiyle yazar', () => {
    const item = { planMealId: ID, foodId: ID2, quantity: 0, sortOrder: 0, notes: null }
    expect(message(planMealItemInputSchema, item)).toBe('0 değerinden büyük olmalı')
    expect(message(planMealItemInputSchema, { ...item, quantity: Number.NaN })).toBe('Geçerli bir sayı girin')
    expect(message(planMealItemInputSchema, { ...item, quantity: 1, sortOrder: 1.5 })).toBe('Tam sayı olmalı')
    expect(message(planMealItemInputSchema, { ...item, quantity: 10_001 })).toBe('En fazla 10.000 olabilir')
  })
})

describe('client', () => {
  const client = {
    firstName: 'Test',
    lastName: 'Danışan',
    birthDate: '1990-01-01',
    sex: 'female',
    email: 'test@example.com',
    phone: null,
    notes: null,
  }

  it('geçerli girdiyi kabul eder ve boşlukları kırpar', () => {
    const result = clientInputSchema.parse({ ...client, firstName: '  Test ', email: ' test@example.com ' })
    expect(result.firstName).toBe('Test')
    expect(result.email).toBe('test@example.com')
  })

  it('boş ad, geçersiz e-posta, geçersiz tarih ve bilinmeyen cinsiyeti reddeder', () => {
    fail(clientInputSchema, { ...client, firstName: '   ' })
    fail(clientInputSchema, { ...client, email: 'gecersiz' })
    fail(clientInputSchema, { ...client, birthDate: '2026-02-30' })
    fail(clientInputSchema, { ...client, sex: 'other' })
    fail(clientInputSchema, { ...client, firstName: 'x'.repeat(LIMITS.name + 1) })
  })

  it('boş alanlar null ile açıkça verilmelidir', () => {
    ok(clientInputSchema, { ...client, birthDate: null, sex: null, email: null })
    const { notes: _omitted, ...withoutNotes } = client
    fail(clientInputSchema, withoutNotes)
  })

  it('kayıt şeması id, zaman damgaları ve arşiv alanı ister', () => {
    const record = { ...client, id: ID, createdAt: '2026-03-10T09:00:00.000Z', updatedAt: '2026-03-10T09:00:00.000Z', archivedAt: null }
    ok(clientSchema, record)
    fail(clientSchema, { ...record, id: 'abc' })
    fail(clientSchema, { ...record, createdAt: '2026-03-10T12:00:00+03:00' })
    const { archivedAt: _omitted, ...withoutArchived } = record
    fail(clientSchema, withoutArchived)
  })
})

describe('measurement', () => {
  const empty = { clientId: ID, measuredOn: '2026-03-10', weightKg: null, heightCm: null, waistCm: null, hipCm: null, thighCm: null, bodyFatPct: null, notes: null }

  it('en az bir ölçüm değeri ister', () => {
    fail(measurementInputSchema, empty)
    ok(measurementInputSchema, { ...empty, waistCm: 80 })
    ok(measurementInputSchema, { ...empty, thighCm: 56.5 })
  })

  it('sıfır, negatif ve teknik üst sınırı aşan değerleri reddeder', () => {
    fail(measurementInputSchema, { ...empty, weightKg: 0 })
    fail(measurementInputSchema, { ...empty, weightKg: -5 })
    ok(measurementInputSchema, { ...empty, weightKg: LIMITS.weightKg })
    fail(measurementInputSchema, { ...empty, weightKg: LIMITS.weightKg + 0.1 })
    fail(measurementInputSchema, { ...empty, bodyFatPct: LIMITS.bodyFatPct + 1 })
  })

  it('NaN ve sonsuz değerleri reddeder', () => {
    fail(measurementInputSchema, { ...empty, weightKg: Number.NaN })
    fail(measurementInputSchema, { ...empty, heightCm: Number.POSITIVE_INFINITY })
  })
})

describe('food', () => {
  const food = {
    name: 'Test besini',
    brand: null,
    baseUnit: 'g',
    energyKcal: 380,
    proteinG: 13,
    carbsG: 60,
    fatG: 7,
    portionLabel: '1 kase',
    portionAmount: 40,
    source: null,
    isSample: false,
  }

  it('geçerli besini kabul eder', () => {
    ok(foodInputSchema, food)
    ok(foodInputSchema, { ...food, portionLabel: null, portionAmount: null })
  })

  it('g cinsinden 100 g içindeki makro toplamı 100 g\'ı aşamaz', () => {
    ok(foodInputSchema, { ...food, proteinG: 0, carbsG: 0, fatG: 100 })
    fail(foodInputSchema, { ...food, proteinG: 30, carbsG: 60, fatG: 11 })
  })

  it('ml cinsinden yoğun sıvılarda 100 ml içindeki makrolar 100 g\'ı aşabilir', () => {
    // Bal gibi yoğunluğu 1 g/ml'den büyük bir sıvı (kurgusal değerler).
    ok(foodInputSchema, { ...food, baseUnit: 'ml', energyKcal: 430, proteinG: 0.4, carbsG: 116, fatG: 0 })
  })

  it('porsiyon adı ve miktarı birlikte verilmelidir', () => {
    fail(foodInputSchema, { ...food, portionLabel: '1 kase', portionAmount: null })
    fail(foodInputSchema, { ...food, portionLabel: null, portionAmount: 40 })
    fail(foodInputSchema, { ...food, portionLabel: '   ', portionAmount: 40 })
  })

  it('enerji ve makrolarda sınır, negatif, NaN ve sonsuz değerleri reddeder', () => {
    ok(foodInputSchema, { ...food, energyKcal: 0 })
    fail(foodInputSchema, { ...food, energyKcal: LIMITS.energyKcalPer100 + 1 })
    fail(foodInputSchema, { ...food, proteinG: -1 })
    fail(foodInputSchema, { ...food, energyKcal: Number.NaN })
    fail(foodInputSchema, { ...food, fatG: Number.POSITIVE_INFINITY })
  })

  it('örnek veri işareti zorunludur', () => {
    const { isSample: _omitted, ...withoutFlag } = food
    fail(foodInputSchema, withoutFlag)
    fail(foodInputSchema, { ...food, isSample: 'true' })
  })
})

describe('mealPlan / planMeal / planMealItem', () => {
  const plan = { clientId: ID, title: 'Plan', startDate: '2026-03-10', endDate: '2026-03-16', notes: null }

  it('bitiş başlangıçtan önce olamaz; aynı gün olabilir', () => {
    ok(mealPlanInputSchema, plan)
    ok(mealPlanInputSchema, { ...plan, endDate: '2026-03-10' })
    ok(mealPlanInputSchema, { ...plan, endDate: null })
    fail(mealPlanInputSchema, { ...plan, endDate: '2026-03-09' })
  })

  const meal = { mealPlanId: ID, dayNumber: 1, mealTypeId: ID2, time: '08:30', notes: null }

  it('gün numarası 1\'den başlayan tam sayıdır', () => {
    ok(planMealInputSchema, meal)
    fail(planMealInputSchema, { ...meal, dayNumber: 0 })
    fail(planMealInputSchema, { ...meal, dayNumber: 1.5 })
    fail(planMealInputSchema, { ...meal, dayNumber: LIMITS.planDays + 1 })
  })

  it('öğün saati HH:MM biçimindedir', () => {
    ok(planMealInputSchema, { ...meal, time: null })
    fail(planMealInputSchema, { ...meal, time: '8:30' })
    fail(planMealInputSchema, { ...meal, time: '25:00' })
    fail(planMealInputSchema, { ...meal, time: '08:30:00' })
  })

  it('öğün içeriği miktarı pozitif ve sonludur', () => {
    const item = { planMealId: ID, foodId: ID2, quantity: 40, sortOrder: 0, notes: null }
    ok(planMealItemInputSchema, item)
    fail(planMealItemInputSchema, { ...item, quantity: 0 })
    fail(planMealItemInputSchema, { ...item, quantity: Number.NaN })
    fail(planMealItemInputSchema, { ...item, quantity: LIMITS.quantity + 1 })
  })
})

describe('appointment', () => {
  const appointment = { clientId: ID, startsAt: '2026-03-10T07:00:00.000Z', endsAt: '2026-03-10T07:45:00.000Z', status: 'scheduled', notes: null }

  it('bitiş başlangıçtan sonra olmalıdır', () => {
    ok(appointmentInputSchema, appointment)
    fail(appointmentInputSchema, { ...appointment, endsAt: appointment.startsAt })
    fail(appointmentInputSchema, { ...appointment, endsAt: '2026-03-10T06:59:00.000Z' })
  })

  it('zamanlar UTC olmalıdır', () => {
    fail(appointmentInputSchema, { ...appointment, startsAt: '2026-03-10T10:00:00+03:00' })
    fail(appointmentInputSchema, { ...appointment, startsAt: '2026-03-10 07:00' })
  })

  it('bilinmeyen durumu reddeder', () => {
    fail(appointmentInputSchema, { ...appointment, status: 'postponed' })
  })
})

describe('clientGoal', () => {
  const goal = {
    clientId: ID,
    validFrom: '2026-03-01',
    validTo: '2026-03-31',
    energyKcal: 1800,
    proteinG: 90,
    carbsG: 200,
    fatG: 65,
    method: 'manual',
    activityFactor: null,
    notes: null,
  }

  it('bitiş başlangıçtan önce olamaz; aynı gün olabilir (tek günlük dönem)', () => {
    ok(clientGoalInputSchema, goal)
    ok(clientGoalInputSchema, { ...goal, validTo: '2026-03-01' })
    ok(clientGoalInputSchema, { ...goal, validTo: null })
    fail(clientGoalInputSchema, { ...goal, validTo: '2026-02-28' })
  })

  it('hesaplanan hedefte etkinlik katsayısı zorunludur ve aralıktadır', () => {
    fail(clientGoalInputSchema, { ...goal, method: 'mifflin_st_jeor' })
    ok(clientGoalInputSchema, { ...goal, method: 'mifflin_st_jeor', activityFactor: 1.375 })
    fail(clientGoalInputSchema, { ...goal, method: 'mifflin_st_jeor', activityFactor: 1.1 })
    fail(clientGoalInputSchema, { ...goal, method: 'mifflin_st_jeor', activityFactor: 2.6 })
  })

  it('enerji pozitif ve sonludur', () => {
    fail(clientGoalInputSchema, { ...goal, energyKcal: 0 })
    fail(clientGoalInputSchema, { ...goal, energyKcal: Number.POSITIVE_INFINITY })
    fail(clientGoalInputSchema, { ...goal, proteinG: Number.NaN })
  })
})

describe('danışan sağlık bilgileri ve öneriler', () => {
  const medication = { clientId: ID, name: 'Örnek ilaç', dose: null, frequency: null, startedOn: null, endedOn: null, notes: null }

  it('ilaç adı zorunludur; bitiş başlangıçtan önce olamaz', () => {
    ok(clientMedicationInputSchema, medication)
    fail(clientMedicationInputSchema, { ...medication, name: '  ' })
    ok(clientMedicationInputSchema, { ...medication, startedOn: '2026-03-01', endedOn: '2026-03-01' })
    fail(clientMedicationInputSchema, { ...medication, startedOn: '2026-03-02', endedOn: '2026-03-01' })
  })

  it('hastalık adı ve öneri metni zorunludur; öneri tarihlidir', () => {
    ok(clientConditionInputSchema, { clientId: ID, name: 'Örnek durum', diagnosedOn: null, notes: null })
    fail(clientConditionInputSchema, { clientId: ID, name: '', diagnosedOn: null, notes: null })
    ok(clientRecommendationInputSchema, { clientId: ID, givenOn: '2026-03-10', text: 'Örnek öneri' })
    fail(clientRecommendationInputSchema, { clientId: ID, givenOn: '2026-03-10', text: ' ' })
    fail(clientRecommendationInputSchema, { clientId: ID, givenOn: null, text: 'Örnek öneri' })
  })
})
