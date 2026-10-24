import { appointmentStatusSchema, isAppointmentOverdue, istanbulDayRangeUtc, type AppointmentStatus } from '@diyetgo/shared'
import { AlarmClock, CalendarDays, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { SelectField } from '../../components/ui/form'
import { Card, PageHeader } from '../../components/ui/layout'
import { today } from '../../lib/format'
import { appointmentStatusLabels, fullName } from '../../lib/labels'
import { AppointmentFormDialog } from './AppointmentFormDialog'
import { AppointmentList } from './AppointmentList'

const periods = {
  overdue: 'İşlem bekleyenler (saati geçmiş)',
  upcoming: 'Bugün ve sonrası',
  today: 'Bugün',
  past: 'Geçmiş günler',
  all: 'Tüm tarihler',
} as const

type Period = keyof typeof periods

/** Genel bakıştaki uyarı bu adresle işlem bekleyen randevuları açar. */
export const OVERDUE_APPOINTMENTS_PATH = '/appointments?donem=bekleyen'

/**
 * Dönemin UTC aralığı, yarı açık `[from, to)`; gün sınırları İstanbul'a göredir. "İşlem bekleyenler",
 * şu andan önce başlamış planlanmış randevulardır; bitişi henüz gelmeyenler listede ayrıca süzülür.
 */
function periodRange(period: Period, date: string, now: string): { from?: string; to?: string } {
  if (period === 'overdue') return { to: now }
  const day = istanbulDayRangeUtc(date)
  if (period === 'upcoming') return { from: day.start }
  if (period === 'today') return { from: day.start, to: day.end }
  if (period === 'past') return { to: day.start }
  return {}
}

export function AppointmentsPage() {
  const [searchParams] = useSearchParams()
  const [period, setPeriod] = useState<Period>(searchParams.get('donem') === 'bekleyen' ? 'overdue' : 'upcoming')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [creating, setCreating] = useState(false)
  const date = today()
  const query = useRepositoryQuery(
    async (r) => {
      const now = Date.now()
      const nowIso = new Date(now).toISOString()
      const [appointments, clients, started] = await Promise.all([
        r.appointments.list({
          ...periodRange(period, date, nowIso),
          clientId: clientId || undefined,
          status: period === 'overdue' ? 'scheduled' : status || undefined,
        }),
        r.clients.list({ includeArchived: true }),
        r.appointments.list({ to: nowIso, status: 'scheduled' }),
      ])
      const overdueCount = started.filter((a) => isAppointmentOverdue(a, now)).length
      const shown = period === 'overdue' ? appointments.filter((a) => isAppointmentOverdue(a, now)) : appointments
      return { appointments: period === 'past' || period === 'overdue' ? shown.reverse() : shown, clients, overdueCount }
    },
    [period, clientId, status, date],
  )
  const appointments = query.data?.appointments ?? []
  const clients = query.data?.clients ?? []
  const overdueCount = query.data?.overdueCount ?? 0
  const filtered = period !== 'upcoming' || clientId !== '' || status !== ''

  return (
    <>
      <PageHeader
        title="Randevular"
        description="Saatler Türkiye saatine (Europe/Istanbul) göre gösterilir."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-4" />
            Yeni randevu
          </Button>
        }
      />
      {overdueCount > 0 && period !== 'overdue' && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlarmClock aria-hidden className="size-5 shrink-0" />
          <span className="flex-1">
            <strong>{overdueCount}</strong> randevunun saati geçti; durumunu (tamamlandı, gelmedi veya iptal) güncelleyin.
          </span>
          <Button size="sm" onClick={() => setPeriod('overdue')}>
            İşlem bekleyenleri göster
          </Button>
        </div>
      )}
      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-3">
          <SelectField label="Dönem" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            {Object.entries(periods).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Danışan" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Tüm danışanlar</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {fullName(c)}
              </option>
            ))}
          </SelectField>
          <SelectField label="Durum" value={period === 'overdue' ? 'scheduled' : status} disabled={period === 'overdue'} onChange={(e) => setStatus(e.target.value as AppointmentStatus | '')}>
            <option value="">Tüm durumlar</option>
            {appointmentStatusSchema.options.map((s) => (
              <option key={s} value={s}>
                {appointmentStatusLabels[s]}
              </option>
            ))}
          </SelectField>
        </div>

        {query.status === 'loading' && <LoadingState />}
        {query.status === 'error' && <ErrorState error={query.error} />}
        {query.status === 'success' && appointments.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            title={period === 'overdue' ? 'İşlem bekleyen randevu yok' : filtered ? 'Bu ölçütlere uyan randevu yok' : 'Yaklaşan randevu yok'}
            description="Bir danışan için randevu oluşturun."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Randevu oluştur
              </Button>
            }
          />
        )}
        {appointments.length > 0 && <AppointmentList appointments={appointments} clientsById={new Map(clients.map((c) => [c.id, c]))} />}
      </Card>
      <AppointmentFormDialog open={creating} clientId={clientId || undefined} onClose={() => setCreating(false)} />
    </>
  )
}
