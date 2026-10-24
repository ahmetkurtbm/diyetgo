import { isAppointmentOverdue, istanbulDateOf, type Appointment, type AppointmentStatus, type Client } from '@diyetgo/shared'
import { AlarmClock, CalendarX2, Check, Pencil, Trash2, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useRepositories } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Badge } from '../../components/ui/feedback'
import { useToast } from '../../components/ui/toast-context'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, formatLongDate, formatShortDate, formatTime, today } from '../../lib/format'
import { appointmentStatusLabels, appointmentStatusTones, fullName } from '../../lib/labels'
import { AppointmentFormDialog } from './AppointmentFormDialog'

type Props = {
  /** Gösterilecek sırayla. */
  appointments: Appointment[]
  /** Verilirse her satırda danışan adı gösterilir. */
  clientsById?: Map<string, Client>
}

/** Randevuları İstanbul takvim gününe göre gruplar; düzenleme, iptal ve silme işlemlerini içerir. */
export function AppointmentList({ appointments, clientsById }: Props) {
  const repositories = useRepositories()
  const toast = useToast()
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [deleting, setDeleting] = useState<Appointment | null>(null)
  const date = today()
  const now = Date.now()

  const groups: { date: string; items: Appointment[] }[] = []
  for (const appointment of appointments) {
    const day = istanbulDateOf(appointment.startsAt)
    const last = groups.at(-1)
    if (last?.date === day) last.items.push(appointment)
    else groups.push({ date: day, items: [appointment] })
  }

  const clientName = (a: Appointment) => {
    const client = clientsById?.get(a.clientId)
    return client ? `${fullName(client)}, ` : ''
  }
  const slotLabel = (a: Appointment) => `${formatShortDate(istanbulDateOf(a.startsAt))} ${formatTime(a.startsAt)}`

  /** Saati geçmiş randevunun sonucunu tek tıkla kaydeder. */
  function setStatus(a: Appointment, status: AppointmentStatus, success: string) {
    const { clientId, startsAt, endsAt, notes } = a
    return run(() => repositories.appointments.update(a.id, { clientId, startsAt, endsAt, notes, status }), success)
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      {groups.map((group) => (
        <section key={group.date} aria-label={formatLongDate(group.date)}>
          <h3 className="flex items-center gap-2 border-y border-slate-100 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-600">
            {formatLongDate(group.date)}
            {group.date === date && <Badge tone="brand">Bugün</Badge>}
          </h3>
          <ul className="divide-y divide-slate-100">
            {group.items.map((a) => {
              const cancelled = a.status === 'cancelled'
              const overdue = isAppointmentOverdue(a, now)
              const client = clientsById?.get(a.clientId)
              return (
                <li key={a.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${overdue ? 'border-l-4 border-l-amber-500 bg-amber-50/70' : ''}`}>
                  <div className="w-28 shrink-0 text-sm tabular-nums">
                    <span className={`font-medium ${cancelled ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
                    </span>
                    <span className="block text-xs text-slate-500">{Math.round((Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 60_000)} dk</span>
                  </div>
                  <div className="min-w-0 flex-1 basis-40">
                    {clientsById &&
                      (client ? (
                        <Link to={`/clients/${client.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                          {fullName(client)}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-500">Bilinmeyen danışan</span>
                      ))}
                    {a.notes && <span className="block truncate text-xs text-slate-500">{a.notes}</span>}
                  </div>
                  {overdue ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        <AlarmClock aria-hidden className="size-3.5" />
                        Saati geçti, işlem yapın
                      </span>
                      <Button size="sm" aria-label={`${slotLabel(a)} randevusunu tamamlandı olarak işaretle`} onClick={() => setStatus(a, 'completed', 'Randevu tamamlandı olarak işaretlendi.')}>
                        <Check aria-hidden className="size-4" />
                        Tamamlandı
                      </Button>
                      <Button size="sm" aria-label={`${slotLabel(a)} randevusuna gelmedi olarak işaretle`} onClick={() => setStatus(a, 'no_show', 'Randevu gelmedi olarak işaretlendi.')}>
                        <UserX aria-hidden className="size-4" />
                        Gelmedi
                      </Button>
                    </span>
                  ) : (
                    <Badge tone={appointmentStatusTones[a.status]}>{appointmentStatusLabels[a.status]}</Badge>
                  )}
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="sm" aria-label={`${slotLabel(a)} randevusunu düzenle`} onClick={() => setEditing(a)}>
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    {!cancelled && (
                      <Button variant="ghost" size="sm" aria-label={`${slotLabel(a)} randevusunu iptal et`} onClick={() => setCancelling(a)}>
                        <CalendarX2 aria-hidden className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" aria-label={`${slotLabel(a)} randevusunu sil`} onClick={() => setDeleting(a)}>
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <AppointmentFormDialog open={editing !== null} appointment={editing ?? undefined} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={cancelling !== null}
        title="Randevu iptal edilsin mi?"
        description={
          cancelling && `${clientName(cancelling)}${formatDateTime(cancelling.startsAt)} randevusu iptal edilir. Kayıt silinmez ve bu saat başka bir randevuya açılır.`
        }
        confirmLabel="Randevuyu iptal et"
        onCancel={() => setCancelling(null)}
        onConfirm={() => {
          if (!cancelling) return
          setCancelling(null)
          void run(() => repositories.appointments.cancel(cancelling.id), 'Randevu iptal edildi.')
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Randevu silinsin mi?"
        description={deleting && `${clientName(deleting)}${formatDateTime(deleting.startsAt)} randevusu kalıcı olarak silinir. Kaydı korumak için iptal etmeyi tercih edin.`}
        confirmLabel="Sil"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          setDeleting(null)
          void run(() => repositories.appointments.remove(deleting.id), 'Randevu silindi.')
        }}
      />
    </>
  )
}
