/**
 * İki çalışma modunun (API ve demo) aynı şekilde uygulaması gereken iş kuralları.
 * Fonksiyonlar saftır; "bugün" gibi değerler çağıran taraftan verilir.
 */
import { addDays, daysBetween } from './dates'
import type { Appointment, Client, ClientGoal, Food, MealPlan, MealType, PlanMeal } from './schemas'

// ---------- Arşivleme ----------
//
// Arşivleme mevcut kayıtları etkilemez; yalnızca yeni bağlantıları engeller (CLAUDE.md §4.4).

/** Arşivlenmiş danışana yeni plan veya randevu eklenemez. */
export function canAddPlanOrAppointment(client: Pick<Client, 'archivedAt'>): boolean {
  return client.archivedAt === null
}

/** Arşivlenmiş besin yeni öğün içeriğine eklenemez; mevcut içeriklerde görünmeye devam eder. */
export function canAddFoodToMeal(food: Pick<Food, 'archivedAt'>): boolean {
  return food.archivedAt === null
}

// ---------- Hedef dönemleri ----------
//
// Dahil olma kuralı: Bir hedef dönemi `validFrom` ve `validTo` günlerini KAPSAR (kapalı aralık).
// `validTo = null` dönemin açık uçlu olduğunu belirtir. Bu nedenle:
// - 31 Mart'ta biten ve 1 Nisan'da başlayan iki hedef çakışmaz.
// - İkisi de 31 Mart'ı kapsıyorsa çakışır.
// - Hedef, `validTo` gününün kendisinde hâlâ aktiftir.

type GoalPeriod = Pick<ClientGoal, 'validFrom' | 'validTo'>

export function goalPeriodsOverlap(a: GoalPeriod, b: GoalPeriod): boolean {
  return (b.validTo === null || a.validFrom <= b.validTo) && (a.validTo === null || b.validFrom <= a.validTo)
}

export function isGoalActiveOn(goal: GoalPeriod, date: string): boolean {
  return goal.validFrom <= date && (goal.validTo === null || date <= goal.validTo)
}

/** Verilen günde aktif olan hedef. Kurallara uyan veride en fazla bir tane olabilir. */
export function findActiveGoal<T extends GoalPeriod>(goals: readonly T[], date: string): T | undefined {
  return goals.find((g) => isGoalActiveOn(g, date))
}

export type GoalPlacement =
  | { ok: true; close: { id: string; validTo: string } | null }
  | { ok: false; conflictingIds: string[] }

/**
 * Bir danışana yeni hedef eklenip eklenemeyeceğini belirler.
 *
 * Açık uçlu mevcut hedef, yeni hedeften önce başlıyorsa yeni hedefin başlangıcından bir gün önce
 * kapatılır (`close`); bu güncelleme yeni hedefle aynı işlemde uygulanmalıdır. Bunun dışında yeni
 * hedef hiçbir mevcut dönemle çakışamaz. `existing` yalnızca aynı danışanın hedeflerini içermelidir.
 */
export function planNewGoal(
  existing: readonly (GoalPeriod & Pick<ClientGoal, 'id'>)[],
  newGoal: GoalPeriod,
): GoalPlacement {
  const open = existing.find((g) => g.validTo === null)
  const close = open && open.validFrom < newGoal.validFrom ? { id: open.id, validTo: addDays(newGoal.validFrom, -1) } : null
  const conflictingIds = existing
    .map((g) => (close && g.id === close.id ? { ...g, validTo: close.validTo } : g))
    .filter((g) => goalPeriodsOverlap(g, newGoal))
    .map((g) => g.id)
  return conflictingIds.length > 0 ? { ok: false, conflictingIds } : { ok: true, close }
}

// ---------- Randevular ----------
//
// Randevu aralıkları yarı açıktır: `[startsAt, endsAt)`. 10:00–10:30 ile 10:30–11:00 çakışmaz.

type AppointmentSlot = Pick<Appointment, 'startsAt' | 'endsAt'>

export function appointmentsOverlap(a: AppointmentSlot, b: AppointmentSlot): boolean {
  return Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt)
}

/**
 * Aday randevuyla çakışan randevular. İptal edilmiş randevular yer tutmaz; düzenlenen randevunun
 * kendisi (`candidate.id`) karşılaştırmaya alınmaz. Tek diyetisyen olduğu için danışandan bağımsızdır.
 */
export function findAppointmentConflicts<T extends AppointmentSlot & Pick<Appointment, 'id' | 'status'>>(
  candidate: AppointmentSlot & { id?: string; status?: Appointment['status'] },
  existing: readonly T[],
): T[] {
  if (candidate.status === 'cancelled') return []
  return existing.filter((a) => a.status !== 'cancelled' && a.id !== candidate.id && appointmentsOverlap(a, candidate))
}

// ---------- Plan günleri ----------
//
// Plan günleri görelidir: gün 1 = `startDate`, gün N = `startDate + (N − 1)`.

type PlanPeriod = Pick<MealPlan, 'startDate' | 'endDate'>

/** Planın gün sayısı (başlangıç ve bitiş dahil); bitişi olmayan planlarda `null`. */
export function planLengthDays(plan: PlanPeriod): number | null {
  return plan.endDate === null ? null : daysBetween(plan.startDate, plan.endDate) + 1
}

export function planDayDate(startDate: string, dayNumber: number): string {
  if (!Number.isInteger(dayNumber) || dayNumber < 1) throw new RangeError(`Geçersiz plan günü: ${dayNumber}`)
  return addDays(startDate, dayNumber - 1)
}

/** Gün numarası planın süresi içinde mi? Bitişi olmayan planlarda yalnızca `dayNumber ≥ 1` aranır. */
export function isDayWithinPlan(plan: PlanPeriod, dayNumber: number): boolean {
  if (!Number.isInteger(dayNumber) || dayNumber < 1) return false
  const length = planLengthDays(plan)
  return length === null || dayNumber <= length
}

/** Plan süresi değişince dışarıda kalacak öğünler; bunlar varken süre değiştirilemez. */
export function mealsOutsidePlan<T extends Pick<PlanMeal, 'dayNumber'>>(plan: PlanPeriod, meals: readonly T[]): T[] {
  return meals.filter((m) => !isDayWithinPlan(plan, m.dayNumber))
}

// ---------- Öğün türleri ----------

/** Arşivlenmiş öğün türü yeni öğünde seçilemez; düzenlenen öğünün mevcut türü korunabilir. */
export function canUseMealType(mealType: Pick<MealType, 'id' | 'archivedAt'>, previousMealTypeId?: string): boolean {
  return mealType.archivedAt === null || mealType.id === previousMealTypeId
}

const normalizeName = (name: string) => name.trim().toLocaleLowerCase('tr-TR')

/** Öğün türü adları büyük/küçük harf farkı gözetmeden (Türkçe kurallarıyla) benzersizdir. */
export function isMealTypeNameTaken(existing: readonly Pick<MealType, 'id' | 'name'>[], name: string, selfId: string | null): boolean {
  return existing.some((t) => t.id !== selfId && normalizeName(t.name) === normalizeName(name))
}
