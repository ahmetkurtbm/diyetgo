/**
 * Danışan ilerleme özeti (haftalık rapor). Fonksiyonlar saftır; "bugün" çağıran taraftan verilir.
 *
 * Değişimler yalnızca hesaplanır, yorumlanmaz: kilo artışı veya azalışı iyi/kötü olarak
 * sınıflandırılmaz, çünkü hedef danışana göre değişir.
 */
import { addDays, daysBetween } from './dates'
import { dayTotals, sumNutrients, ZERO_NUTRIENTS, type Nutrients } from './nutrition'
import { isDayWithinPlan } from './rules'
import type { Food, MealPlan, Measurement, PlanMeal, PlanMealItem } from './schemas'

export type DatedValue = { date: string; value: number }

/** Raporun kapsadığı 7 gün: bitiş günü dahil, `[end − 6, end]`. */
export function reportWeek(end: string): { start: string; end: string } {
  return { start: addDays(end, -6), end }
}

type MeasurementValues = Pick<Measurement, 'measuredOn' | 'createdAt' | 'weightKg' | 'waistCm' | 'hipCm' | 'bodyFatPct'>
export type MetricKey = 'weightKg' | 'waistCm' | 'hipCm' | 'bodyFatPct'

/** Verilen ölçüm türünün `onDate` gününe kadarki değerleri, eskiden yeniye. Aynı gün birden çok ölçümde son kayıt geçerlidir. */
export function metricSeries(measurements: readonly MeasurementValues[], key: MetricKey, onDate: string): DatedValue[] {
  const byDate = new Map<string, { value: number; createdAt: string }>()
  for (const m of measurements) {
    const value = m[key]
    if (value === null || m.measuredOn > onDate) continue
    const existing = byDate.get(m.measuredOn)
    if (!existing || m.createdAt > existing.createdAt) byDate.set(m.measuredOn, { value, createdAt: m.createdAt })
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, { value }]) => ({ date, value }))
}

export type MetricSummary = {
  current: DatedValue
  previous: DatedValue | null
  first: DatedValue
  /** Önceki ölçüme göre değişim; tek ölçüm varsa `null`. */
  changeSincePrevious: number | null
  /** İlk ölçüme göre değişim. */
  totalChange: number
}

/** Son ölçümü önceki ve ilk ölçümle karşılaştırır; hiç ölçüm yoksa `null`. */
export function summarizeMetric(series: readonly DatedValue[]): MetricSummary | null {
  const current = series.at(-1)
  const first = series[0]
  if (!current || !first) return null
  const previous = series.at(-2) ?? null
  return {
    current,
    previous,
    first,
    changeSincePrevious: previous ? current.value - previous.value : null,
    totalChange: current.value - first.value,
  }
}

/** Grafik için son `days` günlük pencere; pencerede iki noktadan az varsa tüm geçmiş kullanılır. */
export function chartWindow(series: readonly DatedValue[], onDate: string, days: number): DatedValue[] {
  const from = addDays(onDate, -days)
  const recent = series.filter((p) => p.date >= from)
  return recent.length >= 2 ? recent : [...series]
}

type FoodValues = Pick<Food, 'id' | 'energyKcal' | 'proteinG' | 'carbsG' | 'fatG'>

/**
 * Planın verilen haftaya düşen ve öğünü olan günlerinin ortalama günlük toplamı. Haftanın hiçbir
 * plan günü öğün içermiyorsa `null`.
 */
export function planWeekAverage(
  plan: Pick<MealPlan, 'startDate' | 'endDate'>,
  meals: readonly Pick<PlanMeal, 'id' | 'dayNumber'>[],
  items: readonly Pick<PlanMealItem, 'planMealId' | 'foodId' | 'quantity'>[],
  foods: readonly FoodValues[],
  week: { start: string; end: string },
): { average: Nutrients; days: number } | null {
  const foodsById = new Map(foods.map((f) => [f.id, f]))
  const mealDays = new Set(meals.map((m) => m.dayNumber))
  const totals: Nutrients[] = []
  for (let date = week.start; date <= week.end; date = addDays(date, 1)) {
    const dayNumber = daysBetween(plan.startDate, date) + 1
    if (isDayWithinPlan(plan, dayNumber) && mealDays.has(dayNumber)) totals.push(dayTotals(dayNumber, meals, items, foodsById))
  }
  if (totals.length === 0) return null
  const sum = sumNutrients(totals)
  const average = { ...ZERO_NUTRIENTS }
  for (const key of Object.keys(average) as (keyof Nutrients)[]) average[key] = sum[key] / totals.length
  return { average, days: totals.length }
}
