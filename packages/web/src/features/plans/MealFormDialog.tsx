import type { MealType, PlanMeal } from '@diyetgo/shared'
import { useId, useState, type FormEvent } from 'react'
import { useRepositories } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField, TextareaField, TextField } from '../../components/ui/form'
import { emptyToNull } from '../../lib/forms'
import { useSubmit } from '../../lib/use-submit'

type Props = {
  open: boolean
  planId: string
  dayNumber: number
  meal?: PlanMeal
  /** Bu günde seçilebilecek öğün türleri (kullanılmamış ve arşivde olmayanlar; düzenlemede mevcut tür dahil). */
  mealTypes: MealType[]
  onClose: () => void
}

export function MealFormDialog({ open, planId, dayNumber, meal, mealTypes, onClose }: Props) {
  const formId = useId()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={meal ? 'Öğünü düzenle' : `${dayNumber}. güne öğün ekle`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {meal ? 'Kaydet' : 'Öğün ekle'}
          </Button>
        </>
      }
    >
      <MealForm formId={formId} planId={planId} dayNumber={dayNumber} meal={meal} mealTypes={mealTypes} onBusyChange={setBusy} onSaved={onClose} />
    </Dialog>
  )
}

function MealForm({
  formId,
  planId,
  dayNumber,
  meal,
  mealTypes,
  onBusyChange,
  onSaved,
}: Omit<Props, 'open' | 'onClose'> & { formId: string; onBusyChange: (busy: boolean) => void; onSaved: () => void }) {
  const repositories = useRepositories()
  const { errors, submit } = useSubmit()
  const [values, setValues] = useState({ mealTypeId: meal?.mealTypeId ?? mealTypes[0]?.id ?? '', time: meal?.time ?? '', notes: meal?.notes ?? '' })
  const set = (field: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = { mealPlanId: planId, dayNumber, mealTypeId: values.mealTypeId, time: emptyToNull(values.time), notes: emptyToNull(values.notes) }
    onBusyChange(true)
    const ok = await submit(() => (meal ? repositories.mealPlans.updateMeal(meal.id, input) : repositories.mealPlans.addMeal(input)), meal ? 'Öğün güncellendi.' : 'Öğün eklendi.')
    onBusyChange(false)
    if (ok) onSaved()
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Öğün türü" required value={values.mealTypeId} error={errors.mealTypeId} onChange={set('mealTypeId')}>
        {mealTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </SelectField>
      <TextField label="Saat" type="time" value={values.time} error={errors.time} onChange={set('time')} />
      <div className="sm:col-span-2">
        <TextareaField label="Notlar" value={values.notes} error={errors.notes} onChange={set('notes')} />
      </div>
    </form>
  )
}
