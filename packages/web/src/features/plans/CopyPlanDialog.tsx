import type { MealPlan } from '@diyetgo/shared'
import { useId, useState, type FormEvent } from 'react'
import { useRepositories } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField, TextField } from '../../components/ui/form'
import { today } from '../../lib/format'
import { useSubmit } from '../../lib/use-submit'
import { ClientOptions } from './PlanFormDialog'
import { useSelectableClients } from './use-selectable-clients'

type Props = { open: boolean; plan: MealPlan; onClose: () => void; onCopied: (plan: MealPlan) => void }

export function CopyPlanDialog({ open, plan, onClose, onCopied }: Props) {
  const formId = useId()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Planı kopyala"
      description="Tüm günler, öğünler ve porsiyonlar kopyalanır; plan süresi korunur."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            Kopyala
          </Button>
        </>
      }
    >
      <CopyForm
        formId={formId}
        plan={plan}
        onBusyChange={setBusy}
        onCopied={(copy) => {
          onCopied(copy)
          onClose()
        }}
      />
    </Dialog>
  )
}

function CopyForm({ formId, plan, onBusyChange, onCopied }: { formId: string; plan: MealPlan; onBusyChange: (busy: boolean) => void; onCopied: (plan: MealPlan) => void }) {
  const repositories = useRepositories()
  const clients = useSelectableClients()
  const { errors, submit } = useSubmit()
  const [values, setValues] = useState({ clientId: plan.clientId, title: `${plan.title} (kopya)`, startDate: today() })
  const [clientError, setClientError] = useState<string>()
  const set = (field: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setClientError(values.clientId ? undefined : 'Bir danışan seçin')
    let copy: MealPlan | undefined
    onBusyChange(true)
    const ok = await submit(async () => {
      copy = await repositories.mealPlans.copy(plan.id, values)
    }, 'Plan kopyalandı.')
    onBusyChange(false)
    if (ok && copy) onCopied(copy)
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4">
      <SelectField label="Danışan" required value={values.clientId} error={clientError ?? (values.clientId ? errors.clientId : undefined)} onChange={set('clientId')}>
        <ClientOptions clients={clients} />
      </SelectField>
      <TextField label="Yeni plan adı" required autoComplete="off" value={values.title} error={errors.title} onChange={set('title')} />
      <TextField label="Başlangıç tarihi" type="date" required value={values.startDate} error={errors.startDate} onChange={set('startDate')} />
    </form>
  )
}
