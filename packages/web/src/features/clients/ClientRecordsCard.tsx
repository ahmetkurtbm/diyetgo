/**
 * Danışana bağlı basit kayıtların (ilaç, hastalık, öneri) kartı: liste, ekleme/düzenleme formu ve
 * silme onayı. Kayıt türleri yalnızca alan tanımları ve listeleme biçimiyle ayrışır (`health-cards.tsx`).
 */
import type { LucideIcon } from 'lucide-react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { TextareaField, TextField } from '../../components/ui/form'
import { Card, CardHeader } from '../../components/ui/layout'
import { useToast } from '../../components/ui/toast-context'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import type { ClientRecordRepository, Repositories } from '../../data/repositories'
import { errorMessage } from '../../lib/errors'
import { useSubmit } from '../../lib/use-submit'

export type RecordField = {
  key: string
  label: string
  kind: 'text' | 'date' | 'textarea'
  required?: boolean
  placeholder?: string
  /** Formda tam genişlik (iki sütunlu düzende). */
  full?: boolean
}

export type RecordConfig<T extends { id: string }, I> = {
  title: string
  description: string
  /** Bildirimlerde kullanılır: "İlaç kaydı eklendi." */
  noun: string
  addLabel: string
  emptyTitle: string
  emptyDescription: string
  icon: LucideIcon
  repository: (r: Repositories) => ClientRecordRepository<T, I>
  fields: RecordField[]
  /** Yeni kayıt formunun başlangıç değerleri (ör. bugünün tarihi). */
  defaults?: () => Record<string, string>
  /** Listede kaydın başlığı, ek bilgisi ve gövde metni. */
  summary: (record: T) => { title: string; meta?: string; body?: string | null }
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1)

export function ClientRecordsCard<T extends { id: string }, I>({ clientId, config }: { clientId: string; config: RecordConfig<T, I> }) {
  const repositories = useRepositories()
  const toast = useToast()
  const query = useRepositoryQuery((r) => config.repository(r).listByClient(clientId), [clientId])
  const [editing, setEditing] = useState<T | 'new' | null>(null)
  const [deleting, setDeleting] = useState<T | null>(null)
  const Icon = config.icon

  return (
    <Card>
      <CardHeader
        title={config.title}
        description={config.description}
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" />
            {config.addLabel}
          </Button>
        }
      />
      {query.status === 'loading' && <LoadingState />}
      {query.status === 'error' && !query.data && <ErrorState error={query.error} />}
      {query.data && query.data.length === 0 && <EmptyState icon={Icon} title={config.emptyTitle} description={config.emptyDescription} />}
      {query.data && query.data.length > 0 && (
        <ul aria-label={config.title} className="divide-y divide-slate-100">
          {query.data.map((record) => {
            const { title, meta, body } = config.summary(record)
            return (
              <li key={record.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words text-slate-900">{title}</p>
                  {meta && <p className="text-xs text-slate-500">{meta}</p>}
                  {body && <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{body}</p>}
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="sm" aria-label={`${title} kaydını düzenle`} onClick={() => setEditing(record)}>
                    <Pencil aria-hidden className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={`${title} kaydını sil`} onClick={() => setDeleting(record)}>
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <RecordFormDialog
        // Her açılışta form başlangıç değerleriyle yeniden kurulur.
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        open={editing !== null}
        clientId={clientId}
        config={config}
        record={editing === 'new' || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`${capitalize(config.noun)} silinsin mi?`}
        description={deleting && `"${config.summary(deleting).title}" kalıcı olarak silinir.`}
        confirmLabel="Sil"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          const target = deleting
          setDeleting(null)
          try {
            await config.repository(repositories).remove(target.id)
            toast.success(`${capitalize(config.noun)} silindi.`)
          } catch (error) {
            toast.error(errorMessage(error))
          }
        }}
      />
    </Card>
  )
}

function RecordFormDialog<T extends { id: string }, I>({
  open,
  clientId,
  config,
  record,
  onClose,
}: {
  open: boolean
  clientId: string
  config: RecordConfig<T, I>
  record?: T
  onClose: () => void
}) {
  const formId = useId()
  const repositories = useRepositories()
  const { busy, errors, submit, formRef } = useSubmit()
  const initial = record as Record<string, unknown> | undefined
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.fields.map((f) => [f.key, initial ? String(initial[f.key] ?? '') : (config.defaults?.()[f.key] ?? '')])),
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Boş isteğe bağlı alanlar `null` olur; zorunlu alanları ortak şema doğrular.
    const input = {
      clientId,
      ...Object.fromEntries(config.fields.map((f) => [f.key, values[f.key]!.trim() === '' && !f.required ? null : values[f.key]])),
    } as I
    const repository = config.repository(repositories)
    const ok = await submit(
      () => (record ? repository.update(record.id, input) : repository.create(input)),
      `${capitalize(config.noun)} ${record ? 'güncellendi' : 'eklendi'}.`,
    )
    if (ok) onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={record ? `${capitalize(config.noun)} düzenle` : config.addLabel}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {record ? 'Kaydet' : 'Ekle'}
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        {config.fields.map((field) => {
          const common = {
            label: field.label,
            required: field.required,
            placeholder: field.placeholder,
            error: errors[field.key],
            value: values[field.key],
          }
          const set = (value: string) => setValues((v) => ({ ...v, [field.key]: value }))
          return (
            <div key={field.key} className={field.full || field.kind === 'textarea' ? 'sm:col-span-2' : undefined}>
              {field.kind === 'textarea' ? (
                <TextareaField {...common} rows={4} onChange={(e) => set(e.target.value)} />
              ) : (
                <TextField {...common} type={field.kind === 'date' ? 'date' : 'text'} onChange={(e) => set(e.target.value)} />
              )}
            </div>
          )
        })}
      </form>
    </Dialog>
  )
}
