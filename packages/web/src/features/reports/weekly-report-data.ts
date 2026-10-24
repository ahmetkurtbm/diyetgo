/** Haftalık raporun verisi: repository'lerden okunur, hesaplar `@diyetgo/shared`'dan gelir. */
import {
  chartWindow,
  metricSeries,
  reportWeek,
  summarizeMetric,
  type Appointment,
  type Client,
  type DatedValue,
  type MetricKey,
  type MetricSummary,
} from '@diyetgo/shared'
import type { Repositories } from '../../data/repositories'

/** Grafikler son 12 haftayı gösterir. */
const CHART_DAYS = 84

export type BodyMetric = { key: Exclude<MetricKey, 'weightKg'>; label: string; unit: string; summary: MetricSummary; chart: DatedValue[] }

export type WeeklyReportData = {
  client: Client
  week: { start: string; end: string }
  weight: MetricSummary | null
  chart: DatedValue[]
  bodyMetrics: BodyMetric[]
  nextAppointment: Appointment | undefined
}

const BODY_METRICS = [
  { key: 'waistCm', label: 'Bel', unit: 'cm' },
  { key: 'hipCm', label: 'Kalça', unit: 'cm' },
  { key: 'thighCm', label: 'Uyluk', unit: 'cm' },
  { key: 'bodyFatPct', label: 'Yağ oranı', unit: '%' },
] as const

export async function loadWeeklyReport(r: Repositories, client: Client, today: string, now: Date): Promise<WeeklyReportData> {
  const [measurements, appointments] = await Promise.all([
    r.measurements.listByClient(client.id),
    r.appointments.list({ clientId: client.id, from: now.toISOString(), status: 'scheduled' }),
  ])

  const weightSeries = metricSeries(measurements, 'weightKg', today)
  const bodyMetrics = BODY_METRICS.flatMap(({ key, label, unit }) => {
    const series = metricSeries(measurements, key, today)
    const summary = summarizeMetric(series)
    return summary ? [{ key, label, unit, summary, chart: chartWindow(series, today, CHART_DAYS) }] : []
  })

  return {
    client,
    week: reportWeek(today),
    weight: summarizeMetric(weightSeries),
    chart: chartWindow(weightSeries, today, CHART_DAYS),
    bodyMetrics,
    nextAppointment: appointments[0],
  }
}
