import type { Client, MealPlan } from '@diyetgo/shared'
import { useId, useState, type FormEvent } from 'react'
import { useRepositories } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { FormSection, SelectField, TextareaField, TextField } from '../../components/ui/form'
import { today } from '../../lib/format'
import { emptyToNull } from '../../lib/forms'
import { fullName } from '../../lib/labels'
import { useSubmit } from '../../lib/use-submit'
import { useSelectableClients } from './use-selectable-clients'

type Props = {
  open: boolean
  plan?: MealPlan
  /** Yeni planda önceden seçili danışan. */
  clientId?: string
  onClose: () => void
  onSaved?: (plan: MealPlan) => void
}

export function PlanFormDialog({ open, plan, clientId, onClose, onSaved }: Props) {
  const formId = useId()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={plan ? 'Planı düzenle' : 'Yeni beslenme planı'}
      description="Plan günleri başlangıç tarihinden itibaren numaralanır (1. gün = başlangıç)."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {plan ? 'Kaydet' : 'Plan oluştur'}
          </Button>
        </>
      }
    >
      <PlanForm
        formId={formId}
        plan={plan}
        clientId={clientId}
        onBusyChange={setBusy}
        onSaved={(saved) => {
          onSaved?.(saved)
          onClose()
        }}
      />
    </Dialog>
  )
}

export function ClientOptions({ clients }: { clients: Client[] }) {
  return (
    <>
      <option value="">Danışan seçin</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {fullName(c)}
          {c.archivedAt ? ' (arşivde)' : ''}
        </option>
      ))}
    </>
  )
}

function PlanForm({
  formId,
  plan,
  clientId,
  onBusyChange,
  onSaved,
}: {
  formId: string
  plan?: MealPlan
  clientId?: string
  onBusyChange: (busy: boolean) => void
  onSaved: (plan: MealPlan) => void
}) {
  const repositories = useRepositories()
  const clients = useSelectableClients(plan?.clientId)
  const { errors, submit, formRef } = useSubmit()
  const [values, setValues] = useState({
    clientId: plan?.clientId ?? clientId ?? '',
    title: plan?.title ?? '',
    startDate: plan?.startDate ?? today(),
    endDate: plan?.endDate ?? '',
    notes: plan?.notes ?? '',
  })
  const [clientError, setClientError] = useState<string>()
  const set = (field: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setClientError(values.clientId ? undefined : 'Bir danışan seçin')
    const input = { ...values, endDate: emptyToNull(values.endDate), notes: emptyToNull(values.notes) }
    let saved: MealPlan | undefined
    onBusyChange(true)
    const ok = await submit(async () => {
      saved = plan ? await repositories.mealPlans.update(plan.id, input) : await repositories.mealPlans.create(input)
    }, plan ? 'Plan güncellendi.' : 'Plan oluşturuldu.')
    onBusyChange(false)
    if (ok && saved) onSaved(saved)
  }

  return (
    <form ref={formRef} id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormSection title="Danışan ve plan" columns={1}>
        <SelectField label="Danışan" required value={values.clientId} error={clientError ?? (values.clientId ? errors.clientId : undefined)} onChange={set('clientId')}>
          <ClientOptions clients={clients} />
        </SelectField>
        <TextField label="Plan adı" required autoComplete="off" value={values.title} error={errors.title} onChange={set('title')} />
      </FormSection>
      <FormSection title="Plan süresi" description="Bitiş günü plana dahildir.">
        <TextField label="Başlangıç tarihi" type="date" required value={values.startDate} error={errors.startDate} onChange={set('startDate')} />
        <TextField label="Bitiş tarihi" type="date" hint="Boş bırakılırsa plan açık uçludur." value={values.endDate} error={errors.endDate} onChange={set('endDate')} />
      </FormSection>
      <div className="border-t border-slate-200 pt-5">
        <TextareaField label="Notlar" value={values.notes} error={errors.notes} onChange={set('notes')} />
      </div>
    </form>
  )
}
