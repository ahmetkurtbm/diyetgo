import type { Client } from '@diyetgo/shared'
import { useId, useState, type FormEvent } from 'react'
import { useRepositories } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField, TextareaField, TextField } from '../../components/ui/form'
import { today } from '../../lib/format'
import { emptyToNull } from '../../lib/forms'
import { useSubmit } from '../../lib/use-submit'

type Props = { open: boolean; client?: Client; onClose: () => void; onSaved?: (client: Client) => void }

export function ClientFormDialog({ open, client, onClose, onSaved }: Props) {
  const formId = useId()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={client ? 'Danışanı düzenle' : 'Yeni danışan'}
      description="Demo modunda gerçek kişisel veya sağlık verisi girmeyin."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {client ? 'Kaydet' : 'Danışan ekle'}
          </Button>
        </>
      }
    >
      <ClientForm
        formId={formId}
        client={client}
        onBusyChange={setBusy}
        onSaved={(saved) => {
          onSaved?.(saved)
          onClose()
        }}
      />
    </Dialog>
  )
}

function ClientForm({ formId, client, onBusyChange, onSaved }: { formId: string; client?: Client; onBusyChange: (busy: boolean) => void; onSaved: (client: Client) => void }) {
  const repositories = useRepositories()
  const { errors, submit } = useSubmit()
  const [values, setValues] = useState({
    firstName: client?.firstName ?? '',
    lastName: client?.lastName ?? '',
    birthDate: client?.birthDate ?? '',
    sex: client?.sex ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    notes: client?.notes ?? '',
  })
  const set = (field: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = {
      firstName: values.firstName,
      lastName: values.lastName,
      birthDate: emptyToNull(values.birthDate),
      sex: emptyToNull(values.sex) as Client['sex'],
      email: emptyToNull(values.email),
      phone: emptyToNull(values.phone),
      notes: emptyToNull(values.notes),
    }
    let saved: Client | undefined
    onBusyChange(true)
    const ok = await submit(async () => {
      saved = client ? await repositories.clients.update(client.id, input) : await repositories.clients.create(input)
    }, client ? 'Danışan bilgileri güncellendi.' : 'Danışan eklendi.')
    onBusyChange(false)
    if (ok && saved) onSaved(saved)
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <TextField label="Ad" required autoComplete="off" value={values.firstName} error={errors.firstName} onChange={set('firstName')} />
      <TextField label="Soyad" required autoComplete="off" value={values.lastName} error={errors.lastName} onChange={set('lastName')} />
      <TextField label="Doğum tarihi" type="date" max={today()} value={values.birthDate} error={errors.birthDate} onChange={set('birthDate')} />
      <SelectField label="Cinsiyet" hint="Enerji ihtiyacı hesaplamasında kullanılır." value={values.sex} error={errors.sex} onChange={set('sex')}>
        <option value="">Belirtilmedi</option>
        <option value="female">Kadın</option>
        <option value="male">Erkek</option>
      </SelectField>
      <TextField label="E-posta" type="email" autoComplete="off" value={values.email} error={errors.email} onChange={set('email')} />
      <TextField label="Telefon" type="tel" autoComplete="off" value={values.phone} error={errors.phone} onChange={set('phone')} />
      <div className="sm:col-span-2">
        <TextareaField label="Notlar" value={values.notes} error={errors.notes} onChange={set('notes')} />
      </div>
    </form>
  )
}
