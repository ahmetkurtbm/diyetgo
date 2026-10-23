/**
 * Ortak Zod şemaları ve bunlardan türetilen tipler.
 *
 * Her varlık için iki şema vardır:
 * - `xInputSchema`: oluşturma ve güncelleme girdisi. Tüm alanlar zorunlu anahtardır; boş değer `null`
 *   ile verilir. Kısmi güncellemede mevcut kayıt girdiyle birleştirilir ve sonuç yeniden bu şemayla
 *   doğrulanır; böylece alanlar arası kurallar (ör. bitiş ≥ başlangıç) güncellemede de uygulanır.
 * - `xSchema`: saklanan kayıt (id ve zaman damgalarıyla).
 *
 * Alan adları camelCase'dir; veritabanındaki snake_case karşılıkları server katmanında eşlenir.
 */
import { z } from 'zod'
import { ACTIVITY_FACTOR_MAX, ACTIVITY_FACTOR_MIN } from './energy'

/**
 * Teknik doğrulama üst sınırları. Yalnızca yazım hatalarını (ör. 75 yerine 750 kg) yakalamak içindir;
 * klinik referans aralığı değildir ve sağlık değerlendirmesi için kullanılmamalıdır.
 */
export const LIMITS = {
  name: 100,
  shortText: 200,
  notes: 2000,
  phone: 30,
  weightKg: 500,
  heightCm: 300,
  circumferenceCm: 300,
  bodyFatPct: 80,
  energyKcalPer100: 900,
  macroGPer100: 200,
  macroSumGPer100g: 100,
  quantity: 10_000,
  planDays: 366,
  sortOrder: 1000,
  goalEnergyKcal: 10_000,
  goalMacroG: 1000,
} as const

// ---------- Ortak alanlar ----------

export const idSchema = z.uuid()
/** Saat bilgisi olmayan takvim günü: `YYYY-MM-DD`. */
export const calendarDateSchema = z.iso.date()
/** UTC zaman, ISO 8601 ve `Z` ile biten biçimde. */
export const instantSchema = z.iso.datetime()

const requiredText = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().max(max).nullable()
const nonNegative = (max: number) => z.number().min(0).max(max)
const positive = (max: number) => z.number().positive().max(max)

const recordFields = { id: idSchema, createdAt: instantSchema, updatedAt: instantSchema }
const archivableFields = { archivedAt: instantSchema.nullable() }

type Ctx = z.RefinementCtx

function checkDateOrder(from: string, to: string | null, ctx: Ctx, path: string) {
  if (to !== null && to < from) {
    ctx.addIssue({ code: 'custom', path: [path], message: 'Bitiş tarihi başlangıç tarihinden önce olamaz' })
  }
}

// ---------- Danışan ----------

export const sexSchema = z.enum(['female', 'male'])
export type Sex = z.infer<typeof sexSchema>

const clientFields = z.object({
  firstName: requiredText(LIMITS.name),
  lastName: requiredText(LIMITS.name),
  birthDate: calendarDateSchema.nullable(),
  sex: sexSchema.nullable(),
  email: z.string().trim().pipe(z.email()).nullable(),
  phone: optionalText(LIMITS.phone),
  notes: optionalText(LIMITS.notes),
})

export const clientInputSchema = clientFields
export const clientSchema = clientFields.extend({ ...recordFields, ...archivableFields })
export type ClientInput = z.infer<typeof clientInputSchema>
export type Client = z.infer<typeof clientSchema>

// ---------- Ölçüm ----------

const measurementFields = z.object({
  clientId: idSchema,
  measuredOn: calendarDateSchema,
  weightKg: positive(LIMITS.weightKg).nullable(),
  heightCm: positive(LIMITS.heightCm).nullable(),
  waistCm: positive(LIMITS.circumferenceCm).nullable(),
  hipCm: positive(LIMITS.circumferenceCm).nullable(),
  bodyFatPct: positive(LIMITS.bodyFatPct).nullable(),
  notes: optionalText(LIMITS.notes),
})

function checkMeasurement(m: z.infer<typeof measurementFields>, ctx: Ctx) {
  if ([m.weightKg, m.heightCm, m.waistCm, m.hipCm, m.bodyFatPct].every((v) => v === null)) {
    ctx.addIssue({ code: 'custom', path: ['weightKg'], message: 'En az bir ölçüm değeri girilmeli' })
  }
}

export const measurementInputSchema = measurementFields.superRefine(checkMeasurement)
export const measurementSchema = measurementFields.extend(recordFields).superRefine(checkMeasurement)
export type MeasurementInput = z.infer<typeof measurementInputSchema>
export type Measurement = z.infer<typeof measurementSchema>

// ---------- Besin ----------

export const baseUnitSchema = z.enum(['g', 'ml'])

/** Besin değerleri 100 g veya 100 ml (`baseUnit`) başınadır. */
const foodFields = z.object({
  name: requiredText(LIMITS.name),
  brand: optionalText(LIMITS.name),
  baseUnit: baseUnitSchema,
  energyKcal: nonNegative(LIMITS.energyKcalPer100),
  proteinG: nonNegative(LIMITS.macroGPer100),
  carbsG: nonNegative(LIMITS.macroGPer100),
  fatG: nonNegative(LIMITS.macroGPer100),
  /** Örn. "1 dilim"; `portionAmount` ile birlikte verilir. */
  portionLabel: optionalText(LIMITS.name),
  /** Bir porsiyonun temel birimdeki miktarı (g/ml). */
  portionAmount: positive(LIMITS.quantity).nullable(),
  /** Değerlerin kaynağı. */
  source: optionalText(LIMITS.shortText),
  /** `true` ise değerler doğrulanmamış örnek veridir; arayüz bunu belirtmelidir. */
  isSample: z.boolean(),
})

function checkFood(f: z.infer<typeof foodFields>, ctx: Ctx) {
  // Katı besinlerde 100 g içindeki makrolar 100 g'ı aşamaz. Sıvılarda yoğunluk 1 g/ml'den büyük
  // olabildiği için (ör. bal) bu kontrol `ml` için yapılmaz.
  if (f.baseUnit === 'g' && f.proteinG + f.carbsG + f.fatG > LIMITS.macroSumGPer100g) {
    ctx.addIssue({ code: 'custom', path: ['proteinG'], message: '100 g içindeki makroların toplamı 100 g\'ı aşamaz' })
  }
  if ((f.portionLabel === null || f.portionLabel === '') !== (f.portionAmount === null)) {
    ctx.addIssue({ code: 'custom', path: ['portionAmount'], message: 'Porsiyon adı ve miktarı birlikte girilmeli' })
  }
}

export const foodInputSchema = foodFields.superRefine(checkFood)
export const foodSchema = foodFields.extend({ ...recordFields, ...archivableFields }).superRefine(checkFood)
export type FoodInput = z.infer<typeof foodInputSchema>
export type Food = z.infer<typeof foodSchema>

// ---------- Öğün türü ----------

const mealTypeFields = z.object({
  name: requiredText(LIMITS.name),
  sortOrder: z.int().min(0).max(LIMITS.sortOrder),
})

export const mealTypeInputSchema = mealTypeFields
export const mealTypeSchema = mealTypeFields.extend({ ...recordFields, ...archivableFields })
export type MealTypeInput = z.infer<typeof mealTypeInputSchema>
export type MealType = z.infer<typeof mealTypeSchema>

// ---------- Beslenme planı ----------

const mealPlanFields = z.object({
  clientId: idSchema,
  title: requiredText(LIMITS.name),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema.nullable(),
  notes: optionalText(LIMITS.notes),
})

function checkMealPlan(p: z.infer<typeof mealPlanFields>, ctx: Ctx) {
  checkDateOrder(p.startDate, p.endDate, ctx, 'endDate')
}

export const mealPlanInputSchema = mealPlanFields.superRefine(checkMealPlan)
export const mealPlanSchema = mealPlanFields.extend({ ...recordFields, ...archivableFields }).superRefine(checkMealPlan)
export type MealPlanInput = z.infer<typeof mealPlanInputSchema>
export type MealPlan = z.infer<typeof mealPlanSchema>

// ---------- Plan öğünü ----------

/** Planın göreli günündeki bir öğün. Gün 1, planın `startDate` günüdür. */
const planMealFields = z.object({
  mealPlanId: idSchema,
  dayNumber: z.int().min(1).max(LIMITS.planDays),
  mealTypeId: idSchema,
  /** İsteğe bağlı öğün saati, `HH:MM`. */
  time: z.iso.time({ precision: -1 }).nullable(),
  notes: optionalText(LIMITS.notes),
})

export const planMealInputSchema = planMealFields
export const planMealSchema = planMealFields.extend(recordFields)
export type PlanMealInput = z.infer<typeof planMealInputSchema>
export type PlanMeal = z.infer<typeof planMealSchema>

// ---------- Öğün içeriği ----------

const planMealItemFields = z.object({
  planMealId: idSchema,
  foodId: idSchema,
  /** Besinin temel birimi (g/ml) cinsinden miktar. */
  quantity: positive(LIMITS.quantity),
  sortOrder: z.int().min(0).max(LIMITS.sortOrder),
  notes: optionalText(LIMITS.notes),
})

export const planMealItemInputSchema = planMealItemFields
export const planMealItemSchema = planMealItemFields.extend(recordFields)
export type PlanMealItemInput = z.infer<typeof planMealItemInputSchema>
export type PlanMealItem = z.infer<typeof planMealItemSchema>

// ---------- Randevu ----------

export const appointmentStatusSchema = z.enum(['scheduled', 'completed', 'cancelled', 'no_show'])
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>

const appointmentFields = z.object({
  clientId: idSchema,
  startsAt: instantSchema,
  endsAt: instantSchema,
  status: appointmentStatusSchema,
  notes: optionalText(LIMITS.notes),
})

function checkAppointment(a: z.infer<typeof appointmentFields>, ctx: Ctx) {
  if (Date.parse(a.endsAt) <= Date.parse(a.startsAt)) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Bitiş zamanı başlangıçtan sonra olmalı' })
  }
}

export const appointmentInputSchema = appointmentFields.superRefine(checkAppointment)
export const appointmentSchema = appointmentFields.extend(recordFields).superRefine(checkAppointment)
export type AppointmentInput = z.infer<typeof appointmentInputSchema>
export type Appointment = z.infer<typeof appointmentSchema>

// ---------- Danışan hedefi ----------

export const goalMethodSchema = z.enum(['manual', 'mifflin_st_jeor'])

/** Hedef dönemi `validFrom` ve `validTo` dahil olmak üzere kapalı aralıktır; `validTo = null` açık uçludur. */
const clientGoalFields = z.object({
  clientId: idSchema,
  validFrom: calendarDateSchema,
  validTo: calendarDateSchema.nullable(),
  energyKcal: positive(LIMITS.goalEnergyKcal),
  proteinG: nonNegative(LIMITS.goalMacroG),
  carbsG: nonNegative(LIMITS.goalMacroG),
  fatG: nonNegative(LIMITS.goalMacroG),
  method: goalMethodSchema,
  activityFactor: z.number().min(ACTIVITY_FACTOR_MIN).max(ACTIVITY_FACTOR_MAX).nullable(),
  notes: optionalText(LIMITS.notes),
})

function checkClientGoal(g: z.infer<typeof clientGoalFields>, ctx: Ctx) {
  checkDateOrder(g.validFrom, g.validTo, ctx, 'validTo')
  if (g.method === 'mifflin_st_jeor' && g.activityFactor === null) {
    ctx.addIssue({ code: 'custom', path: ['activityFactor'], message: 'Hesaplanan hedefte etkinlik katsayısı gerekli' })
  }
}

export const clientGoalInputSchema = clientGoalFields.superRefine(checkClientGoal)
export const clientGoalSchema = clientGoalFields.extend(recordFields).superRefine(checkClientGoal)
export type ClientGoalInput = z.infer<typeof clientGoalInputSchema>
export type ClientGoal = z.infer<typeof clientGoalSchema>
