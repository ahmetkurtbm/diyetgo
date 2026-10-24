/** Haftalık raporun verisi: repository'lerden okunur, hesaplar `@diyetgo/shared`'dan gelir. */
import {
  chartWindow,
  findActiveGoal,
  metricSeries,
  planWeekAverage,
  reportWeek,
  summarizeMetric,
  type Appointment,
  type Client,
  type ClientGoal,
  type DatedValue,
  type MetricKey,
  type MetricSummary,
  type Nutrients,
} from '@diyetgo/shared'
import type { Repositories } from '../../data/repositories'
import { planStatus } from '../../lib/labels'

/** Grafik son 12 haftayı gösterir. */
const CHART_DAYS = 84

export type BodyMetric = { key: Exclude<MetricKey, 'weightKg'>; label: string; unit: string; summary: MetricSummary }

export type WeeklyReportData = {
  client: Client
  week: { start: string; end: string }
  weight: MetricSummary | null
  chart: DatedValue[]
  bodyMetrics: BodyMetric[]
  goal: ClientGoal | undefined
  plan: { title: string; average: Nutrients; days: number } | null
  nextAppointment: Appointment | undefined
}

const BODY_METRICS = [
  { key: 'waistCm', label: 'Bel', unit: 'cm' },
  { key: 'hipCm', label: 'Kalça', unit: 'cm' },
  { key: 'bodyFatPct', label: 'Yağ oranı', unit: '%' },
] as const

export async function loadWeeklyReport(r: Repositories, client: Client, today: string, now: Date): Promise<WeeklyReportData> {
  const week = reportWeek(today)
  const [measurements, goals, plans, appointments] = await Promise.all([
    r.measurements.listByClient(client.id),
    r.goals.listByClient(client.id),
    r.mealPlans.list({ clientId: client.id }),
    r.appointments.list({ clientId: client.id, from: now.toISOString(), status: 'scheduled' }),
  ])

  const weightSeries = metricSeries(measurements, 'weightKg', today)
  const bodyMetrics = BODY_METRICS.flatMap(({ key, label, unit }) => {
    const summary = summarizeMetric(metricSeries(measurements, key, today))
    return summary ? [{ key, label, unit, summary }] : []
  })

  // Liste en yeni başlangıç tarihi önce sıralıdır; bugünü kapsayan ilk plan raporlanır.
  const activePlan = plans.find((p) => planStatus(p, today) === 'active')
  let plan: WeeklyReportData['plan'] = null
  if (activePlan) {
    const [detail, foods] = await Promise.all([r.mealPlans.get(activePlan.id), r.foods.list({ includeArchived: true })])
    const average = planWeekAverage(detail.plan, detail.meals, detail.items, foods, week)
    if (average) plan = { title: detail.plan.title, ...average }
  }

  return {
    client,
    week,
    weight: summarizeMetric(weightSeries),
    chart: chartWindow(weightSeries, today, CHART_DAYS),
    bodyMetrics,
    goal: findActiveGoal(goals, today),
    plan,
    nextAppointment: appointments[0],
  }
}
