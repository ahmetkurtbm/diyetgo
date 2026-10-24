import { describe, expect, it } from 'vitest'
import { chartWindow, metricSeries, planWeekOf, planWeekTotals, reportWeek, summarizeMetric } from './progress'

const m = (measuredOn: string, values: { weightKg?: number; waistCm?: number }, createdAt = `${measuredOn}T09:00:00.000Z`) => ({
  measuredOn,
  createdAt,
  weightKg: values.weightKg ?? null,
  waistCm: values.waistCm ?? null,
  hipCm: null,
  thighCm: null,
  bodyFatPct: null,
})

describe('reportWeek', () => {
  it('bitiş günü dahil 7 gün kapsar; ay sınırını geçer', () => {
    expect(reportWeek('2026-03-03')).toEqual({ start: '2026-02-25', end: '2026-03-03' })
  })
})

describe('metricSeries', () => {
  const measurements = [
    m('2026-03-01', { weightKg: 80, waistCm: 90 }),
    m('2026-03-08', { waistCm: 88 }),
    m('2026-03-15', { weightKg: 78.5 }),
    m('2026-03-15', { weightKg: 78.2 }, '2026-03-15T18:00:00.000Z'),
    m('2026-03-20', { weightKg: 77 }),
  ]

  it('yalnızca o türün değerlerini, verilen güne kadar ve eskiden yeniye döndürür', () => {
    expect(metricSeries(measurements, 'weightKg', '2026-03-16')).toEqual([
      { date: '2026-03-01', value: 80 },
      { date: '2026-03-15', value: 78.2 },
    ])
    expect(metricSeries(measurements, 'waistCm', '2026-03-31').map((p) => p.value)).toEqual([90, 88])
  })

  it('aynı gündeki ölçümlerden en son kaydedileni kullanır', () => {
    const reversed = [...measurements].reverse()
    expect(metricSeries(reversed, 'weightKg', '2026-03-15').at(-1)).toEqual({ date: '2026-03-15', value: 78.2 })
  })
})

describe('summarizeMetric', () => {
  it('son ölçümü önceki ve ilk ölçümle karşılaştırır', () => {
    const summary = summarizeMetric([
      { date: '2026-03-01', value: 80 },
      { date: '2026-03-08', value: 79 },
      { date: '2026-03-15', value: 79.5 },
    ])!
    expect(summary.current).toEqual({ date: '2026-03-15', value: 79.5 })
    expect(summary.changeSincePrevious).toBeCloseTo(0.5)
    expect(summary.totalChange).toBeCloseTo(-0.5)
  })

  it('tek ölçümde önceki değişim yoktur; ölçüm yoksa özet yoktur', () => {
    expect(summarizeMetric([{ date: '2026-03-01', value: 80 }])).toMatchObject({ previous: null, changeSincePrevious: null, totalChange: 0 })
    expect(summarizeMetric([])).toBeNull()
  })
})

describe('chartWindow', () => {
  const series = [
    { date: '2026-01-01', value: 82 },
    { date: '2026-02-20', value: 80 },
    { date: '2026-03-10', value: 79 },
  ]

  it('pencereye düşen noktaları döndürür', () => {
    expect(chartWindow(series, '2026-03-15', 30).map((p) => p.date)).toEqual(['2026-02-20', '2026-03-10'])
  })

  it('pencerede iki noktadan az varsa tüm geçmişi kullanır', () => {
    expect(chartWindow(series, '2026-03-15', 10)).toHaveLength(3)
  })
})

describe('planWeekTotals', () => {
  const foods = new Map([
    ['f1', { energyKcal: 100, proteinG: 10, carbsG: 0, fatG: 5 }],
    ['f2', { energyKcal: 400, proteinG: 0, carbsG: 100, fatG: 0 }],
  ])
  const meals = [
    { id: 'm1', dayNumber: 1 },
    { id: 'm2', dayNumber: 2 },
    { id: 'm9', dayNumber: 9 },
  ]
  const items = [
    { planMealId: 'm1', foodId: 'f1', quantity: 200 },
    { planMealId: 'm2', foodId: 'f2', quantity: 100 },
    { planMealId: 'm9', foodId: 'f2', quantity: 500 },
  ]

  it('gün numarasından plan haftasını bulur', () => {
    expect([1, 7, 8, 14, 15].map(planWeekOf)).toEqual([1, 1, 2, 2, 3])
  })

  it('haftanın toplamını ve öğünlü günlerin ortalamasını hesaplar', () => {
    const result = planWeekTotals(1, 28, meals, items, foods)
    expect(result).toMatchObject({ fromDay: 1, toDay: 7, daysWithMeals: 2 })
    expect(result.total).toEqual({ energyKcal: 600, proteinG: 20, carbsG: 100, fatG: 10 })
    expect(result.average).toEqual({ energyKcal: 300, proteinG: 10, carbsG: 50, fatG: 5 })
  })

  it('hafta planın son gününü aşmaz; öğün yoksa ortalama sıfırdır', () => {
    expect(planWeekTotals(2, 10, meals, items, foods)).toMatchObject({ fromDay: 8, toDay: 10, daysWithMeals: 1 })
    expect(planWeekTotals(3, 21, meals, items, foods)).toMatchObject({ daysWithMeals: 0, average: { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } })
  })
})
