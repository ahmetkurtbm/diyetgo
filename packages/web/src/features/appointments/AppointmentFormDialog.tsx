import { appointmentStatusSchema, findAppointmentConflicts, istanbulDateOf, istanbulTimeOf, istanbulTimeToUtc, type Appointment, type AppointmentStatus } from '@diyetgo/shared'
import { useId, useState, type FormEvent } from 'react'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField, TextareaField, TextField } from '../../components/ui/form'
import { formatTime, today } from '../../lib/format'
import { emptyToNull } from '../../lib/forms'
import { appointmentStatusLabels, fullName } from '../../lib/labels'
import { useSubmit } from '../../lib/use-submit'
import { ClientOptions } from '../plans/PlanFormDialog'
import { useSelectableClients } from '../plans/use-selectable-clients'

type Props = {
  open: boolean
  appointment?: Appointment
  /** Yeni randevuda önceden seçili danışan. */
  clientId?: string
  onClose: () => void
}

const TIME_PATTERN = /^(\d{2}):(\d{2})$/

/** `SS:DD` → günün dakikası; geçersizse `NaN`. */
function toMinutes(time: string): number {
  const match = TIME_PATTERN.exec(time)
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN
}

const fromMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** İstanbul'daki gün ve saatin UTC karşılığı; eksik veya geçersiz girdide boş metin (şema hatası üretir). */
function toInstant(date: string, time: string): string {
  const minutes = toMinutes(time)
  if (Number.isNaN(minutes)) return ''
  try {
    return istanbulTimeToUtc(date, Math.floor(minutes / 60), minutes % 60)
  } catch {
    return ''
  }
}

export function AppointmentFormDialog({ open, appointment, clientId, onClose }: Props) {
  const formId = useId()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={appointment ? 'Randevuyu düzenle' : 'Yeni randevu'}
      description="Saatler Türkiye saatine göredir. Randevu aynı gün içinde bitmelidir."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {appointment ? 'Kaydet' : 'Randevu oluştur'}
          </Button>
        </>
      }
    >
      <AppointmentForm formId={formId} appointment={appointment} clientId={clientId} onBusyChange={setBusy} onSaved={onClose} />
    </Dialog>
  )
}

function AppointmentForm({
  formId,
  appointment,
  clientId,
  onBusyChange,
  onSaved,
}: {
  formId: string
  appointment?: Appointment
  clientId?: string
  onBusyChange: (busy: boolean) => void
  onSaved: () => void
}) {
  const repositories = useRepositories()
  const clients = useSelectableClients(appointment?.clientId)
  const { errors, submit } = useSubmit()
  const [values, setValues] = useState({
    clientId: appointment?.clientId ?? clientId ?? '',
    date: appointment ? istanbulDateOf(appointment.startsAt) : today(),
    startTime: appointment ? istanbulTimeOf(appointment.startsAt) : '09:00',
    endTime: appointment ? istanbulTimeOf(appointment.endsAt) : '09:45',
    status: appointment?.status ?? ('scheduled' as AppointmentStatus),
    notes: appointment?.notes ?? '',
  })
  const [required, setRequired] = useState<Partial<Record<'clientId' | 'date' | 'startTime' | 'endTime', string>>>({})
  const set = (field: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value })

  const startsAt = toInstant(values.date, values.startTime)
  const endsAt = toInstant(values.date, values.endTime)
  const validRange = startsAt !== '' && endsAt !== '' && Date.parse(endsAt) > Date.parse(startsAt)
  // Canlı çakışma uyarısı; kesin kontrolü kayıt sırasında repository yapar. 24 saatten uzun randevu olmadığından
  // adayın bitişinden önceki 24 saatte başlayan randevulara bakmak yeterlidir.
  const nearby = useRepositoryQuery(
    async (r) => {
      if (!validRange) return null
      const [appointments, allClients] = await Promise.all([
        r.appointments.list({ from: new Date(Date.parse(startsAt) - 86_400_000).toISOString(), to: endsAt }),
        r.clients.list({ includeArchived: true }),
      ])
      return { appointments, clientsById: new Map(allClients.map((c) => [c.id, c])) }
    },
    [startsAt, endsAt],
  )
  const conflicts =
    validRange && nearby.data ? findAppointmentConflicts({ id: appointment?.id, startsAt, endsAt, status: values.status }, nearby.data.appointments) : []

  function setStartTime(event: { target: { value: string } }) {
    const startTime = event.target.value
    // Başlangıç değişince süre korunur.
    const duration = toMinutes(values.endTime) - toMinutes(values.startTime)
    const shiftedEnd = toMinutes(startTime) + duration
    setValues({ ...values, startTime, endTime: duration > 0 && shiftedEnd < 24 * 60 ? fromMinutes(shiftedEnd) : values.endTime })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const missing = 'Bu alan zorunludur'
    setRequired({
      clientId: values.clientId ? undefined : 'Bir danışan seçin',
      date: values.date ? undefined : missing,
      startTime: values.startTime ? undefined : missing,
      endTime: values.endTime ? undefined : missing,
    })
    const input = { clientId: values.clientId, startsAt, endsAt, status: values.status, notes: emptyToNull(values.notes) }
    onBusyChange(true)
    const ok = await submit(
      () => (appointment ? repositories.appointments.update(appointment.id, input) : repositories.appointments.create(input)),
      appointment ? 'Randevu güncellendi.' : 'Randevu oluşturuldu.',
    )
    onBusyChange(false)
    if (ok) onSaved()
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <SelectField label="Danışan" required value={values.clientId} error={required.clientId ?? (values.clientId ? errors.clientId : undefined)} onChange={set('clientId')}>
          <ClientOptions clients={clients} />
        </SelectField>
      </div>
      <div className="sm:col-span-2">
        <TextField label="Tarih" type="date" required value={values.date} error={values.date ? undefined : required.date} onChange={set('date')} />
      </div>
      <TextField
        label="Başlangıç saati"
        type="time"
        required
        step={300}
        value={values.startTime}
        error={values.startTime ? (values.date ? errors.startsAt : undefined) : required.startTime}
        onChange={setStartTime}
      />
      <TextField
        label="Bitiş saati"
        type="time"
        required
        step={300}
        value={values.endTime}
        error={values.endTime ? (values.date ? errors.endsAt : undefined) : required.endTime}
        onChange={set('endTime')}
      />
      {conflicts.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2">
          <p className="font-medium">Bu saat başka bir randevuyla çakışıyor:</p>
          <ul className="mt-1 list-disc pl-5">
            {conflicts.map((c) => {
              const client = nearby.data?.clientsById.get(c.clientId)
              return (
                <li key={c.id}>
                  {client ? fullName(client) : 'Bilinmeyen danışan'}, {formatTime(c.startsAt)}–{formatTime(c.endsAt)}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div className="sm:col-span-2">
        <SelectField label="Durum" value={values.status} error={errors.status} onChange={set('status')}>
          {appointmentStatusSchema.options.map((status) => (
            <option key={status} value={status}>
              {appointmentStatusLabels[status]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="sm:col-span-2">
        <TextareaField label="Notlar" value={values.notes} error={errors.notes} onChange={set('notes')} />
      </div>
    </form>
  )
}
