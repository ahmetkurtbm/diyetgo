import type { Measurement } from '@diyetgo/shared'
import { useId, useState, type FormEvent } from 'react'
import { useRepositories } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { TextareaField, TextField } from '../../components/ui/form'
import { today } from '../../lib/format'
import { emptyToNull, parseOptionalNumber } from '../../lib/forms'
import { useSubmit } from '../../lib/use-submit'

type Props = { open: boolean; clientId: string; measurement?: Measurement; onClose: () => void }

const numberFields = [
  ['weightKg', 'Kilo (kg)'],
  ['heightCm', 'Boy (cm)'],
  ['waistCm', 'Bel çevresi (cm)'],
  ['hipCm', 'Kalça çevresi (cm)'],
  ['bodyFatPct', 'Vücut yağ oranı (%)'],
] as const

type NumberField = (typeof numberFields)[number][0]

const toText = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))

export function MeasurementFormDialog({ open, clientId, measurement, onClose }: Props) {
  const formId = useId()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={measurement ? 'Ölçümü düzenle' : 'Yeni ölçüm'}
      description="En az bir ölçüm değeri girin. Ondalık değerlerde virgül kullanabilirsiniz."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {measurement ? 'Kaydet' : 'Ölçüm ekle'}
          </Button>
        </>
      }
    >
      <MeasurementForm formId={formId} clientId={clientId} measurement={measurement} onBusyChange={setBusy} onSaved={onClose} />
    </Dialog>
  )
}

function MeasurementForm({
  formId,
  clientId,
  measurement,
  onBusyChange,
  onSaved,
}: {
  formId: string
  clientId: string
  measurement?: Measurement
  onBusyChange: (busy: boolean) => void
  onSaved: () => void
}) {
  const repositories = useRepositories()
  const { errors, submit } = useSubmit()
  const [measuredOn, setMeasuredOn] = useState(measurement?.measuredOn ?? today())
  const [notes, setNotes] = useState(measurement?.notes ?? '')
  const [numbers, setNumbers] = useState<Record<NumberField, string>>({
    weightKg: toText(measurement?.weightKg ?? null),
    heightCm: toText(measurement?.heightCm ?? null),
    waistCm: toText(measurement?.waistCm ?? null),
    hipCm: toText(measurement?.hipCm ?? null),
    bodyFatPct: toText(measurement?.bodyFatPct ?? null),
  })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = {
      clientId,
      measuredOn,
      weightKg: parseOptionalNumber(numbers.weightKg),
      heightCm: parseOptionalNumber(numbers.heightCm),
      waistCm: parseOptionalNumber(numbers.waistCm),
      hipCm: parseOptionalNumber(numbers.hipCm),
      bodyFatPct: parseOptionalNumber(numbers.bodyFatPct),
      notes: emptyToNull(notes),
    }
    onBusyChange(true)
    const ok = await submit(
      () => (measurement ? repositories.measurements.update(measurement.id, input) : repositories.measurements.create(input)),
      measurement ? 'Ölçüm güncellendi.' : 'Ölçüm eklendi.',
    )
    onBusyChange(false)
    if (ok) onSaved()
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField label="Ölçüm tarihi" type="date" required max={today()} value={measuredOn} error={errors.measuredOn} onChange={(e) => setMeasuredOn(e.target.value)} />
      </div>
      {numberFields.map(([field, label]) => (
        <TextField
          key={field}
          label={label}
          inputMode="decimal"
          autoComplete="off"
          value={numbers[field]}
          error={errors[field]}
          onChange={(e) => setNumbers({ ...numbers, [field]: e.target.value })}
        />
      ))}
      <div className="sm:col-span-2">
        <TextareaField label="Notlar" value={notes} error={errors.notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </form>
  )
}
