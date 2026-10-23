import { appointmentStatusSchema, istanbulDayRangeUtc, type AppointmentStatus } from '@diyetgo/shared'
import { CalendarDays, Plus } from 'lucide-react'
import { useState } from 'react'
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
  upcoming: 'Bugün ve sonrası',
  today: 'Bugün',
  past: 'Geçmiş günler',
  all: 'Tüm tarihler',
} as const

type Period = keyof typeof periods

/** Dönemin UTC aralığı, yarı açık `[from, to)`; gün sınırları İstanbul'a göredir. */
function periodRange(period: Period, date: string): { from?: string; to?: string } {
  const day = istanbulDayRangeUtc(date)
  if (period === 'upcoming') return { from: day.start }
  if (period === 'today') return { from: day.start, to: day.end }
  if (period === 'past') return { to: day.start }
  return {}
}

export function AppointmentsPage() {
  const [period, setPeriod] = useState<Period>('upcoming')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [creating, setCreating] = useState(false)
  const date = today()
  const query = useRepositoryQuery(
    async (r) => {
      const [appointments, clients] = await Promise.all([
        r.appointments.list({ ...periodRange(period, date), clientId: clientId || undefined, status: status || undefined }),
        r.clients.list({ includeArchived: true }),
      ])
      return { appointments: period === 'past' ? appointments.reverse() : appointments, clients }
    },
    [period, clientId, status, date],
  )
  const appointments = query.data?.appointments ?? []
  const clients = query.data?.clients ?? []
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
          <SelectField label="Durum" value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus | '')}>
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
            title={filtered ? 'Bu ölçütlere uyan randevu yok' : 'Yaklaşan randevu yok'}
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
