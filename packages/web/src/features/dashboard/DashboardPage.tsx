import { addDays, daysBetween, istanbulDayRangeUtc, planLengthDays, type Appointment, type Client } from '@diyetgo/shared'
import { CalendarCheck, CalendarClock, CalendarX2, History, NotebookPen, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useRepositoryQuery } from '../../data/context'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, CardHeader, PageHeader } from '../../components/ui/layout'
import { formatDate, formatDateTime, formatTime, formatWeekdayDate, today } from '../../lib/format'
import { appointmentStatusLabels, appointmentStatusTones, fullName, planStatus } from '../../lib/labels'

type Activity = { id: string; at: string; title: string; detail: string; to: string }

function StatCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: number; hint: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <Icon aria-hidden className="size-5 text-brand-600" />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Card>
  )
}

function ListCard({ title, description, empty, children }: { title: string; description?: string; empty: { icon: LucideIcon; title: string } | null; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {empty ? <EmptyState icon={empty.icon} title={empty.title} /> : <ul className="divide-y divide-slate-100">{children}</ul>}
    </Card>
  )
}

function AppointmentRow({ appointment, client, showDate }: { appointment: Appointment; client?: Client; showDate: boolean }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="w-24 shrink-0 text-sm tabular-nums">
        {showDate && <span className="block text-xs text-slate-500">{formatWeekdayDate(appointment.startsAt)}</span>}
        <span className="font-medium text-slate-900">
          {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        {client ? (
          <Link to={`/clients/${client.id}`} className="truncate text-sm font-medium text-slate-900 hover:text-brand-700">
            {fullName(client)}
          </Link>
        ) : (
          <span className="text-sm text-slate-500">Bilinmeyen danışan</span>
        )}
      </div>
      <Badge tone={appointmentStatusTones[appointment.status]}>{appointmentStatusLabels[appointment.status]}</Badge>
    </li>
  )
}

const changeVerb = (record: { createdAt: string; updatedAt: string }, created: string, updated: string) =>
  record.createdAt === record.updatedAt ? created : updated

export function DashboardPage() {
  const date = today()
  const query = useRepositoryQuery(async (r) => {
    const [clients, appointments, plans] = await Promise.all([r.clients.list({ includeArchived: true }), r.appointments.list(), r.mealPlans.list()])
    const measurements = (await Promise.all(clients.map((c) => r.measurements.listByClient(c.id)))).flat()
    return { clients, appointments, plans, measurements }
  }, [date])

  if (query.status === 'loading') return <LoadingState />
  if (query.status === 'error' && !query.data) return <ErrorState error={query.error} />
  const { clients, appointments, plans, measurements } = query.data!

  const clientsById = new Map(clients.map((c) => [c.id, c]))
  // Aralıklar yarı açıktır: [başlangıç, bitiş). Karşılaştırma ISO metniyle değil, zamanla yapılır.
  const todayStart = Date.parse(istanbulDayRangeUtc(date).start)
  const todayEnd = Date.parse(istanbulDayRangeUtc(date).end)
  const weekEnd = Date.parse(istanbulDayRangeUtc(addDays(date, 7)).end)
  const startOf = (a: Appointment) => Date.parse(a.startsAt)
  const todays = appointments.filter((a) => startOf(a) >= todayStart && startOf(a) < todayEnd && a.status !== 'cancelled')
  const upcoming = appointments.filter((a) => a.status === 'scheduled' && startOf(a) >= todayEnd && startOf(a) < weekEnd)
  const activePlans = plans.filter((p) => planStatus(p, date) === 'active')

  const nameOf = (clientId: string) => {
    const client = clientsById.get(clientId)
    return client ? fullName(client) : 'Bilinmeyen danışan'
  }
  const activities: Activity[] = [
    ...clients.map((c) => ({ id: c.id, at: c.updatedAt, title: changeVerb(c, 'Danışan eklendi', 'Danışan güncellendi'), detail: fullName(c), to: `/clients/${c.id}` })),
    ...measurements.map((m) => ({ id: m.id, at: m.updatedAt, title: changeVerb(m, 'Ölçüm kaydedildi', 'Ölçüm güncellendi'), detail: nameOf(m.clientId), to: `/clients/${m.clientId}` })),
    ...plans.map((p) => ({ id: p.id, at: p.updatedAt, title: changeVerb(p, 'Plan oluşturuldu', 'Plan güncellendi'), detail: `${p.title} · ${nameOf(p.clientId)}`, to: `/plans/${p.id}` })),
    ...appointments.map((a) => ({
      id: a.id,
      at: a.updatedAt,
      title: a.status === 'cancelled' ? 'Randevu iptal edildi' : changeVerb(a, 'Randevu oluşturuldu', 'Randevu güncellendi'),
      detail: `${nameOf(a.clientId)} · ${formatDateTime(a.startsAt)}`,
      to: `/clients/${a.clientId}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)

  return (
    <>
      <PageHeader title="Genel bakış" description={formatDate(date)} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Aktif danışan" value={clients.filter((c) => c.archivedAt === null).length} hint="Arşivdekiler hariç" />
        <StatCard icon={CalendarCheck} label="Bugünkü randevu" value={todays.length} hint="İptal edilenler hariç" />
        <StatCard icon={CalendarClock} label="Yaklaşan randevu" value={upcoming.length} hint="Önümüzdeki 7 gün" />
        <StatCard icon={NotebookPen} label="Aktif plan" value={activePlans.length} hint="Bugünü kapsayan planlar" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ListCard title="Bugünkü randevular" empty={todays.length === 0 ? { icon: CalendarX2, title: 'Bugün randevu yok' } : null}>
          {todays.map((a) => (
            <AppointmentRow key={a.id} appointment={a} client={clientsById.get(a.clientId)} showDate={false} />
          ))}
        </ListCard>
        <ListCard title="Yaklaşan randevular" description="Önümüzdeki 7 gün" empty={upcoming.length === 0 ? { icon: CalendarClock, title: 'Yaklaşan randevu yok' } : null}>
          {upcoming.map((a) => (
            <AppointmentRow key={a.id} appointment={a} client={clientsById.get(a.clientId)} showDate />
          ))}
        </ListCard>
        <ListCard title="Aktif beslenme planları" empty={activePlans.length === 0 ? { icon: NotebookPen, title: 'Aktif plan yok' } : null}>
          {activePlans.map((plan) => {
            const length = planLengthDays(plan)
            const day = daysBetween(plan.startDate, date) + 1
            return (
              <li key={plan.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Link to={`/plans/${plan.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                    {plan.title}
                  </Link>
                  <Link to={`/clients/${plan.clientId}`} className="text-xs text-slate-500 hover:text-brand-700">
                    {nameOf(plan.clientId)}
                  </Link>
                </div>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">{length === null ? `${day}. gün` : `${day}. gün / ${length}`}</span>
              </li>
            )
          })}
        </ListCard>
        <ListCard title="Son işlemler" empty={activities.length === 0 ? { icon: History, title: 'Henüz işlem yok' } : null}>
          {activities.map((activity) => (
            <li key={activity.id} className="px-5 py-3">
              <Link to={activity.to} className="group block">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-slate-900 group-hover:text-brand-700">{activity.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatDateTime(activity.at)}</span>
                </span>
                <span className="block truncate text-xs text-slate-500">{activity.detail}</span>
              </Link>
            </li>
          ))}
        </ListCard>
      </div>
    </>
  )
}
