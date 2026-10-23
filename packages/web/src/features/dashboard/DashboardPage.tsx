import { addDays, daysBetween, istanbulDateOf, istanbulDayRangeUtc, planLengthDays, type Appointment, type Client } from '@diyetgo/shared'
import { CalendarCheck, CalendarClock, CalendarX2, History, NotebookPen, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useRepositoryQuery } from '../../data/context'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, CardHeader, PageHeader } from '../../components/ui/layout'
import { formatDate, formatDateTime, formatTime, formatWeekday, formatWeekdayDate, today } from '../../lib/format'
import { appointmentStatusLabels, appointmentStatusTones, fullName, planStatus } from '../../lib/labels'

type Activity = { id: string; at: string; title: string; detail: string; to: string }

const cardLink = 'text-sm font-medium text-brand-700 hover:underline'

function StatCard({ icon: Icon, label, value, detail, children }: { icon: LucideIcon; label: string; value: number; detail: ReactNode; children?: ReactNode }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="rounded-md bg-brand-50 p-1.5 text-brand-700">
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500" data-testid="stat-detail">
        {detail}
      </p>
      {children && <div className="mt-auto pt-4">{children}</div>}
    </Card>
  )
}

/** Gerçek bir pay ve paydaya dayanan ilerleme çubuğu. */
function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="block h-1.5 overflow-hidden rounded-full bg-slate-100"
    >
      <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(value / max) * 100}%` }} />
    </span>
  )
}

/** Önümüzdeki günlerin randevu sayıları; en yoğun gün tam yüksekliktedir. */
function DayBars({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const summary = days.map((d) => `${formatWeekday(d.date)} ${d.count}`).join(', ')
  return (
    <div role="img" aria-label={`Günlere göre randevu sayısı: ${summary}`} className="flex items-end gap-1.5">
      {days.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${formatDate(d.date)}: ${d.count} randevu`}>
          <div className="flex h-8 w-full items-end rounded-sm bg-slate-100">
            {d.count > 0 && <div className="w-full rounded-sm bg-brand-600" style={{ height: `${(d.count / max) * 100}%` }} />}
          </div>
          <span className="text-[10px] text-slate-500">{formatWeekday(d.date)}</span>
        </div>
      ))}
    </div>
  )
}

function ListCard({ title, description, actions, empty, children }: { title: string; description?: string; actions?: ReactNode; empty: ReactNode | null; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} actions={actions} />
      {empty ?? children}
    </Card>
  )
}

function AppointmentRow({ appointment, client }: { appointment: Appointment; client?: Client }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="w-24 shrink-0 text-sm tabular-nums">
        <span className="block text-xs text-slate-500">{formatWeekdayDate(appointment.startsAt)}</span>
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

/** Bugünkü randevular saat sırasıyla; "şu an" çizgisi geçmiş ve gelecek randevuları ayırır. */
function TodayTimeline({ appointments, clientsById, now }: { appointments: Appointment[]; clientsById: Map<string, Client>; now: number }) {
  const nowIndex = appointments.findIndex((a) => Date.parse(a.startsAt) >= now)
  const markerAt = nowIndex === -1 ? appointments.length : nowIndex
  const nowTime = formatTime(new Date(now).toISOString())
  const marker = (
    <li key="now" className="flex items-center gap-3 py-1">
      <span className="w-12 shrink-0 text-right text-xs font-semibold text-red-600 tabular-nums">{nowTime}</span>
      <span className="flex w-3 shrink-0 justify-center">
        <span className="size-2 rounded-full bg-red-500" />
      </span>
      <span className="h-px flex-1 bg-red-200" />
      <span className="sr-only">Şu an {nowTime}</span>
    </li>
  )

  return (
    <ol aria-label="Bugünün zaman çizelgesi" className="px-5 py-3">
      {appointments.map((a, index) => {
        const client = clientsById.get(a.clientId)
        const cancelled = a.status === 'cancelled'
        const past = Date.parse(a.endsAt) <= now
        const minutes = Math.round((Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 60_000)
        return [
          index === markerAt && marker,
          <li key={a.id} className={`flex gap-3 ${past || cancelled ? 'opacity-60' : ''}`}>
            <span className="w-12 shrink-0 pt-2 text-right text-sm font-medium text-slate-900 tabular-nums">{formatTime(a.startsAt)}</span>
            <span className="relative flex w-3 shrink-0 justify-center">
              <span className="absolute inset-y-0 w-px bg-slate-200" />
              <span className={`relative mt-3 size-3 rounded-full ring-2 ring-white ${cancelled ? 'bg-slate-300' : 'bg-brand-600'}`} />
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
              <div className="min-w-0">
                {client ? (
                  <Link to={`/clients/${client.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                    {fullName(client)}
                  </Link>
                ) : (
                  <span className="text-sm text-slate-500">Bilinmeyen danışan</span>
                )}
                <span className={`text-xs text-slate-500 tabular-nums ${cancelled ? 'line-through' : ''}`}>
                  {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
                </span>
                <span className="text-xs text-slate-500"> · {minutes} dk</span>
              </div>
              <Badge tone={appointmentStatusTones[a.status]}>{appointmentStatusLabels[a.status]}</Badge>
            </div>
          </li>,
        ]
      })}
      {markerAt === appointments.length && marker}
    </ol>
  )
}

const changeVerb = (record: { createdAt: string; updatedAt: string }, created: string, updated: string) =>
  record.createdAt === record.updatedAt ? created : updated

export function DashboardPage() {
  const date = today()
  const query = useRepositoryQuery(async (r) => {
    const [clients, appointments, plans] = await Promise.all([r.clients.list({ includeArchived: true }), r.appointments.list(), r.mealPlans.list()])
    const measurements = (await Promise.all(clients.map((c) => r.measurements.listByClient(c.id)))).flat()
    // "Şu an" render sırasında değil, veri yüklenirken alınır; veri her değiştiğinde yenilenir.
    return { clients, appointments, plans, measurements, now: Date.now() }
  }, [date])

  if (query.status === 'loading') return <LoadingState />
  if (query.status === 'error' && !query.data) return <ErrorState error={query.error} />
  const { clients, appointments, plans, measurements, now } = query.data!

  const clientsById = new Map(clients.map((c) => [c.id, c]))
  // Aralıklar yarı açıktır: [başlangıç, bitiş). Karşılaştırma ISO metniyle değil, zamanla yapılır.
  const todayStart = Date.parse(istanbulDayRangeUtc(date).start)
  const todayEnd = Date.parse(istanbulDayRangeUtc(date).end)
  const weekEnd = Date.parse(istanbulDayRangeUtc(addDays(date, 7)).end)
  const startOf = (a: Appointment) => Date.parse(a.startsAt)
  const todayAll = appointments.filter((a) => startOf(a) >= todayStart && startOf(a) < todayEnd)
  const todays = todayAll.filter((a) => a.status !== 'cancelled')
  const cancelledToday = todayAll.length - todays.length
  const nextToday = todays.find((a) => a.status === 'scheduled' && startOf(a) >= now)
  const upcoming = appointments.filter((a) => a.status === 'scheduled' && startOf(a) >= todayEnd && startOf(a) < weekEnd)
  const upcomingDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(date, i + 1)
    return { date: day, count: upcoming.filter((a) => istanbulDateOf(a.startsAt) === day).length }
  })
  const nextUpcoming = upcoming[0] ?? appointments.find((a) => a.status === 'scheduled' && startOf(a) >= weekEnd)

  const activeClients = clients.filter((c) => c.archivedAt === null)
  const activePlans = plans.filter((p) => planStatus(p, date) === 'active')
  const datedPlans = activePlans.filter((p) => p.endDate !== null).length
  const coveredClients = new Set(activePlans.map((p) => p.clientId).filter((id) => clientsById.get(id)?.archivedAt === null)).size

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

  const archivedCount = clients.length - activeClients.length
  const todayDetail = nextToday
    ? `Sıradaki ${formatTime(nextToday.startsAt)} · ${nameOf(nextToday.clientId)}`
    : todays.length > 0
      ? 'Bugün kalan randevu yok'
      : 'Bugün randevu planlanmamış'

  return (
    <>
      <PageHeader title="Genel bakış" description={formatDate(date)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Aktif danışan"
          value={activeClients.length}
          detail={archivedCount > 0 ? `Arşivdeki ${archivedCount} danışan hariç` : 'Arşivde danışan yok'}
        />
        <StatCard
          icon={CalendarCheck}
          label="Bugünkü randevu"
          value={todays.length}
          detail={cancelledToday > 0 ? `${todayDetail} · ${cancelledToday} iptal hariç` : todayDetail}
        />
        <StatCard
          icon={CalendarClock}
          label="Yaklaşan randevu"
          value={upcoming.length}
          detail={nextUpcoming ? `En yakın: ${formatWeekdayDate(nextUpcoming.startsAt)} ${formatTime(nextUpcoming.startsAt)}` : 'Planlanmış randevu yok'}
        >
          <DayBars days={upcomingDays} />
        </StatCard>
        <StatCard
          icon={NotebookPen}
          label="Aktif plan"
          value={activePlans.length}
          detail={activePlans.length > 0 ? `${datedPlans} bitiş tarihli · ${activePlans.length - datedPlans} açık uçlu` : 'Bugünü kapsayan plan yok'}
        >
          {activeClients.length > 0 && (
            <div className="space-y-1.5">
              <p className="flex justify-between text-xs text-slate-500">
                <span>Planı olan aktif danışan</span>
                <span className="font-medium text-slate-700 tabular-nums">
                  {coveredClients} / {activeClients.length}
                </span>
              </p>
              <Meter value={coveredClients} max={activeClients.length} label="Aktif planı olan aktif danışanlar" />
            </div>
          )}
        </StatCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ListCard
          title="Bugünkü randevular"
          description="Saat sırasıyla; iptal edilenler soluk gösterilir."
          actions={
            <Link to="/appointments" className={cardLink}>
              Tüm randevular
            </Link>
          }
          empty={
            todayAll.length === 0 ? (
              <EmptyState
                icon={CalendarX2}
                title="Bugün randevu yok"
                description={nextUpcoming ? `Sıradaki randevu: ${formatWeekdayDate(nextUpcoming.startsAt)} ${formatTime(nextUpcoming.startsAt)} · ${nameOf(nextUpcoming.clientId)}` : undefined}
                action={
                  <Link to="/appointments" className={cardLink}>
                    Randevulara git
                  </Link>
                }
              />
            ) : null
          }
        >
          <TodayTimeline appointments={todayAll} clientsById={clientsById} now={now} />
        </ListCard>
        <ListCard
          title="Yaklaşan randevular"
          description="Önümüzdeki 7 gün"
          empty={upcoming.length === 0 ? <EmptyState icon={CalendarClock} title="Yaklaşan randevu yok" description="Önümüzdeki 7 gün için planlanmış randevu bulunmuyor." /> : null}
        >
          <ul className="divide-y divide-slate-100">
            {upcoming.map((a) => (
              <AppointmentRow key={a.id} appointment={a} client={clientsById.get(a.clientId)} />
            ))}
          </ul>
        </ListCard>
        <ListCard
          title="Aktif beslenme planları"
          actions={
            <Link to="/plans" className={cardLink}>
              Tüm planlar
            </Link>
          }
          empty={
            activePlans.length === 0 ? (
              <EmptyState
                icon={NotebookPen}
                title="Aktif plan yok"
                description="Bugünü kapsayan bir beslenme planı bulunmuyor."
                action={
                  <Link to="/plans" className={cardLink}>
                    Planlara git
                  </Link>
                }
              />
            ) : null
          }
        >
          <ul className="divide-y divide-slate-100">
            {activePlans.map((plan) => {
              const length = planLengthDays(plan)
              const day = daysBetween(plan.startDate, date) + 1
              return (
                <li key={plan.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/plans/${plan.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                        {plan.title}
                      </Link>
                      <Link to={`/clients/${plan.clientId}`} className="text-xs text-slate-500 hover:text-brand-700">
                        {nameOf(plan.clientId)}
                      </Link>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{length === null ? `${day}. gün · açık uçlu` : `${day}. gün / ${length}`}</span>
                  </div>
                  {length !== null && (
                    <div className="mt-2">
                      <Meter value={day} max={length} label={`${plan.title} ilerlemesi`} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </ListCard>
        <ListCard title="Son işlemler" empty={activities.length === 0 ? <EmptyState icon={History} title="Henüz işlem yok" /> : null}>
          <ul className="divide-y divide-slate-100">
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
          </ul>
        </ListCard>
      </div>
    </>
  )
}
