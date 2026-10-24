/**
 * Danışan ilerleme özeti (haftalık rapor). Fonksiyonlar saftır; "bugün" çağıran taraftan verilir.
 *
 * Değişimler yalnızca hesaplanır, yorumlanmaz: kilo artışı veya azalışı iyi/kötü olarak
 * sınıflandırılmaz, çünkü hedef danışana göre değişir.
 */
import { addDays } from './dates'
import { dayTotals, mealTotals, sumNutrients, ZERO_NUTRIENTS, type Nutrients } from './nutrition'
import type { Food, Measurement, PlanMeal, PlanMealItem } from './schemas'

export type DatedValue = { date: string; value: number }

/** Raporun kapsadığı 7 gün: bitiş günü dahil, `[end − 6, end]`. */
export function reportWeek(end: string): { start: string; end: string } {
  return { start: addDays(end, -6), end }
}

type MeasurementValues = Pick<Measurement, 'measuredOn' | 'createdAt' | 'weightKg' | 'waistCm' | 'hipCm' | 'thighCm' | 'bodyFatPct'>
export type MetricKey = 'weightKg' | 'waistCm' | 'hipCm' | 'thighCm' | 'bodyFatPct'

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

type FoodValues = Pick<Food, 'energyKcal' | 'proteinG' | 'carbsG' | 'fatG'>

/** Plan haftası: 1–7. günler 1. hafta, 8–14. günler 2. hafta… */
export function planWeekOf(dayNumber: number): number {
  return Math.ceil(dayNumber / 7)
}

export type PlanWeekTotals = {
  week: number
  fromDay: number
  toDay: number
  /** Haftadaki tüm günlerin toplamı. */
  total: Nutrients
  /** Öğünü olan günlerin günlük ortalaması; öğünlü gün yoksa sıfırdır. */
  average: Nutrients
  /** Öğünü olan gün sayısı. */
  daysWithMeals: number
}

/**
 * Plan haftasının toplamı ve günlük ortalaması. `lastDay` planın son günüdür (bitişi olmayan planlarda
 * görünen son gün); hafta bunu aşmaz.
 */
export function planWeekTotals(
  week: number,
  lastDay: number,
  meals: readonly Pick<PlanMeal, 'id' | 'dayNumber'>[],
  items: readonly Pick<PlanMealItem, 'planMealId' | 'foodId' | 'quantity'>[],
  foodsById: ReadonlyMap<string, FoodValues>,
): PlanWeekTotals {
  const fromDay = (week - 1) * 7 + 1
  const toDay = Math.min(week * 7, lastDay)
  const mealDays = new Set(meals.map((m) => m.dayNumber))
  const days: Nutrients[] = []
  for (let day = fromDay; day <= toDay; day++) if (mealDays.has(day)) days.push(dayTotals(day, meals, items, foodsById))
  const total = sumNutrients(days)
  const average = { ...ZERO_NUTRIENTS }
  if (days.length > 0) for (const key of Object.keys(average) as (keyof Nutrients)[]) average[key] = total[key] / days.length
  return { week, fromDay, toDay, total, average, daysWithMeals: days.length }
}

// ---------- Seçenekli haftalık menü ----------

export type NutrientRange = { min: Nutrients; average: Nutrients; max: Nutrients }

export type OptionPlanSummary = {
  /** Öğün türü başına: seçenek sayısı, haftalık adet ve haftalık aralık. */
  mealTypes: { mealTypeId: string; options: number; perWeek: number; weekly: NutrientRange }[]
  /** Haftalık toplam aralık; danışan her seferinde en düşük / ortalama / en yüksek seçeneği seçerse. */
  weekly: NutrientRange
  /** Haftalık aralığın 7 güne bölünmüş hâli. */
  daily: NutrientRange
}

const scale = (n: Nutrients, factor: number): Nutrients => ({
  energyKcal: n.energyKcal * factor,
  proteinG: n.proteinG * factor,
  carbsG: n.carbsG * factor,
  fatG: n.fatG * factor,
})

/**
 * Seçenekli planın haftalık aralığı. Her öğün türü için seçeneklerin enerjisine göre en düşük ve en
 * yüksek seçenek alınır, haftalık adetle çarpılır; ortalama tüm seçeneklerin ortalamasıdır. Adedi
 * olup seçeneği olmayan öğün türü toplama katılmaz (aralık sıfır).
 */
export function optionPlanSummary(
  meals: readonly Pick<PlanMeal, 'id' | 'mealTypeId'>[],
  items: readonly Pick<PlanMealItem, 'planMealId' | 'foodId' | 'quantity'>[],
  foodsById: ReadonlyMap<string, FoodValues>,
  quotas: readonly { mealTypeId: string; perWeek: number }[],
): OptionPlanSummary {
  const typeIds = [...new Set([...quotas.map((q) => q.mealTypeId), ...meals.map((m) => m.mealTypeId)])]
  const mealTypes = typeIds.map((mealTypeId) => {
    const perWeek = quotas.find((q) => q.mealTypeId === mealTypeId)?.perWeek ?? 0
    const totals = meals.filter((m) => m.mealTypeId === mealTypeId).map((m) => mealTotals(m.id, items, foodsById))
    if (totals.length === 0) return { mealTypeId, options: 0, perWeek, weekly: { min: { ...ZERO_NUTRIENTS }, average: { ...ZERO_NUTRIENTS }, max: { ...ZERO_NUTRIENTS } } }
    const byEnergy = [...totals].sort((a, b) => a.energyKcal - b.energyKcal)
    const average = scale(sumNutrients(totals), 1 / totals.length)
    return {
      mealTypeId,
      options: totals.length,
      perWeek,
      weekly: { min: scale(byEnergy[0]!, perWeek), average: scale(average, perWeek), max: scale(byEnergy.at(-1)!, perWeek) },
    }
  })
  const weekly: NutrientRange = {
    min: sumNutrients(mealTypes.map((t) => t.weekly.min)),
    average: sumNutrients(mealTypes.map((t) => t.weekly.average)),
    max: sumNutrients(mealTypes.map((t) => t.weekly.max)),
  }
  return { mealTypes, weekly, daily: { min: scale(weekly.min, 1 / 7), average: scale(weekly.average, 1 / 7), max: scale(weekly.max, 1 / 7) } }
}
