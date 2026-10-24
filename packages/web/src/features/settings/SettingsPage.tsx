import type { MealType } from '@diyetgo/shared'
import { Archive, ArchiveRestore, Pencil, Plus, RotateCcw, Trash2, Utensils } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { TextField } from '../../components/ui/form'
import { Card, CardHeader, PageHeader } from '../../components/ui/layout'
import { useToast } from '../../components/ui/toast-context'
import { errorMessage, fieldErrorsOf } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { parseNumber } from '../../lib/forms'

export function SettingsPage() {
  const { demo } = useRepositories()
  return (
    <>
      <PageHeader title="Ayarlar" description={demo ? 'Öğün türlerini yönetin ve demo verilerini sıfırlayın.' : 'Öğün türlerini yönetin.'} />
      <div className="space-y-6">
        <MealTypesSection />
        <DemoDataSection />
      </div>
    </>
  )
}

function MealTypeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { name: string; sortOrder: string }
  submitLabel: string
  onSubmit: (input: { name: string; sortOrder: number }) => Promise<void>
  onCancel: () => void
}) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ name: values.name, sortOrder: parseNumber(values.sortOrder) })
    } catch (error) {
      setErrors(fieldErrorsOf(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-3 bg-slate-50 px-5 py-4 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
      <TextField label="Öğün türü adı" required value={values.name} error={errors.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
      <TextField
        label="Sıra"
        inputMode="numeric"
        required
        value={values.sortOrder}
        error={errors.sortOrder}
        onChange={(e) => setValues({ ...values, sortOrder: e.target.value })}
      />
      <div className="flex gap-2 sm:pt-6">
        <Button type="submit" variant="primary" disabled={busy}>
          {submitLabel}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Vazgeç
        </Button>
      </div>
    </form>
  )
}

function MealTypesSection() {
  const repositories = useRepositories()
  const toast = useToast()
  const query = useRepositoryQuery((r) => r.mealTypes.list({ includeArchived: true }), [])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [deleting, setDeleting] = useState<MealType | null>(null)

  const mealTypes = query.data ?? []
  const nextOrder = String(Math.max(0, ...mealTypes.map((t) => t.sortOrder)) + 1)

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Öğün türleri"
        description="Planlarda kullanılan öğünler (kahvaltı, ara öğün vb.). Sıra numarası menüdeki sırayı belirler."
        actions={
          editing !== 'new' && (
            <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
              <Plus aria-hidden className="size-4" />
              Öğün türü ekle
            </Button>
          )
        }
      />
      {editing === 'new' && (
        <MealTypeForm
          initial={{ name: '', sortOrder: nextOrder }}
          submitLabel="Ekle"
          onCancel={() => setEditing(null)}
          onSubmit={async (input) => {
            await repositories.mealTypes.create(input)
            setEditing(null)
            toast.success('Öğün türü eklendi.')
          }}
        />
      )}
      {query.status === 'loading' && <LoadingState />}
      {query.status === 'error' && <ErrorState error={query.error} />}
      {query.status === 'success' && mealTypes.length === 0 && (
        <EmptyState icon={Utensils} title="Henüz öğün türü yok" description="Plan oluşturmadan önce en az bir öğün türü ekleyin." />
      )}
      {mealTypes.length > 0 && (
        <ul className="divide-y divide-slate-200">
          {mealTypes.map((mealType) =>
            editing === mealType.id ? (
              <li key={mealType.id}>
                <MealTypeForm
                  initial={{ name: mealType.name, sortOrder: String(mealType.sortOrder) }}
                  submitLabel="Kaydet"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (input) => {
                    await repositories.mealTypes.update(mealType.id, input)
                    setEditing(null)
                    toast.success('Öğün türü güncellendi.')
                  }}
                />
              </li>
            ) : (
              <li key={mealType.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="w-8 text-sm tabular-nums text-slate-500">{mealType.sortOrder}</span>
                <span className="flex-1 text-sm font-medium text-slate-900">{mealType.name}</span>
                {mealType.archivedAt && <Badge>Arşivde</Badge>}
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(mealType.id)} aria-label={`${mealType.name} düzenle`}>
                    <Pencil aria-hidden className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={mealType.archivedAt ? `${mealType.name} arşivden çıkar` : `${mealType.name} arşivle`}
                    onClick={() =>
                      run(
                        () => repositories.mealTypes.setArchived(mealType.id, mealType.archivedAt === null),
                        mealType.archivedAt ? 'Öğün türü arşivden çıkarıldı.' : 'Öğün türü arşivlendi.',
                      )
                    }
                  >
                    {mealType.archivedAt ? <ArchiveRestore aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(mealType)} aria-label={`${mealType.name} sil`}>
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Öğün türü silinsin mi?"
        description={`"${deleting?.name ?? ''}" kalıcı olarak silinir. Bir planda kullanılıyorsa silinemez; bunun yerine arşivleyebilirsiniz.`}
        confirmLabel="Sil"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting
          setDeleting(null)
          if (target) void run(() => repositories.mealTypes.remove(target.id), 'Öğün türü silindi.')
        }}
      />
    </Card>
  )
}

const collectionLabels: Record<string, string> = {
  clients: 'Danışan',
  measurements: 'Ölçüm',
  foods: 'Besin',
  mealTypes: 'Öğün türü',
  mealPlans: 'Beslenme planı',
  planMeals: 'Plan öğünü',
  planMealItems: 'Öğün içeriği',
  appointments: 'Randevu',
  clientGoals: 'Hedef',
}

function DemoDataSection() {
  const repositories = useRepositories()
  const toast = useToast()
  const info = useRepositoryQuery((r) => (r.demo ? r.demo.info() : Promise.resolve(null)), [])
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!repositories.demo) return null
  const demo = repositories.demo

  async function reset() {
    setBusy(true)
    try {
      await demo.reset()
      toast.success('Demo verileri sıfırlandı ve örnek veriler yeniden yüklendi.')
      setConfirming(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Demo verileri"
        description="Demo modunda tüm veriler yalnızca bu tarayıcıda tutulur; cihazlar arasında paylaşılmaz ve yedeklenmez."
      />
      <div className="space-y-4 px-5 py-4">
        {info.status === 'success' && info.data && (
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-slate-500">Örnek veriler yüklendi</dt>
              <dd className="font-medium text-slate-900">{formatDateTime(info.data.seededAt)}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-slate-500">Kayıt durumu</dt>
              <dd className="font-medium text-slate-900">{info.data.persistent ? 'Bu tarayıcıda kaydediliyor' : 'Kaydedilmiyor (yalnızca bellekte)'}</dd>
            </div>
          </dl>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">Sıfırlama, bu tarayıcıdaki tüm Dietgo demo verilerini siler ve örnek verileri yeniden yükler. Bu işlem geri alınamaz.</p>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            <RotateCcw aria-hidden className="size-4" />
            Demo verilerini sıfırla
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        busy={busy}
        title="Demo verileri sıfırlansın mı?"
        description="Aşağıdaki kayıtlar silinir ve örnek veriler yeniden yüklenir. Diğer sitelerin ve uygulamaların verileri etkilenmez."
        confirmLabel="Evet, tüm demo verilerini sıfırla"
        onCancel={() => setConfirming(false)}
        onConfirm={reset}
      >
        {info.data && (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {Object.entries(info.data.counts).map(([name, count]) => (
              <li key={name} className="flex justify-between">
                <span className="text-slate-600">{collectionLabels[name] ?? name}</span>
                <span className="font-medium tabular-nums text-slate-900">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </ConfirmDialog>
    </Card>
  )
}
