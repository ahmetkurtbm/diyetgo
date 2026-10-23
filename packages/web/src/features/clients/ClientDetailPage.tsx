import { Archive, ArchiveRestore, ArrowLeft, Pencil, Trash2, UserX } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { RepositoryError } from '../../data/repositories'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, CardHeader, PageHeader } from '../../components/ui/layout'
import { useToast } from '../../components/ui/toast-context'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { ageLabel, fullName, sexLabels } from '../../lib/labels'
import { MeasurementsCard } from '../measurements/MeasurementsCard'
import { ClientPlansCard } from '../plans/ClientPlansCard'
import { ClientFormDialog } from './ClientFormDialog'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 sm:block">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium break-words text-slate-900 sm:mt-0.5 sm:text-left">{children}</dd>
    </div>
  )
}

export function ClientDetailPage() {
  const { clientId = '' } = useParams()
  const repositories = useRepositories()
  const toast = useToast()
  const navigate = useNavigate()
  const query = useRepositoryQuery((r) => r.clients.get(clientId), [clientId])
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (query.status === 'loading') return <LoadingState />
  if (query.status === 'error' && !query.data) {
    const notFound = query.error instanceof RepositoryError && query.error.code === 'not_found'
    return (
      <Card>
        {notFound ? (
          <EmptyState
            icon={UserX}
            title="Danışan bulunamadı"
            description="Danışan silinmiş veya bağlantı hatalı olabilir."
            action={
              <Link to="/clients" className="text-sm font-medium text-brand-700 hover:underline">
                Danışan listesine dön
              </Link>
            }
          />
        ) : (
          <ErrorState error={query.error} />
        )}
      </Card>
    )
  }

  const client = query.data!
  const archived = client.archivedAt !== null

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      toast.success(success)
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    }
  }

  return (
    <>
      <Link to="/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="size-4" />
        Danışanlar
      </Link>
      <PageHeader
        title={fullName(client)}
        description={archived ? <Badge>Arşivde</Badge> : <Badge tone="brand">Aktif danışan</Badge>}
        actions={
          <>
            <Button onClick={() => setEditing(true)}>
              <Pencil aria-hidden className="size-4" />
              Düzenle
            </Button>
            <Button onClick={() => run(() => repositories.clients.setArchived(client.id, !archived), archived ? 'Danışan arşivden çıkarıldı.' : 'Danışan arşivlendi.')}>
              {archived ? <ArchiveRestore aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />}
              {archived ? 'Arşivden çıkar' : 'Arşivle'}
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(true)} aria-label="Danışanı sil">
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </>
        }
      />
      {archived && (
        <p role="note" className="mb-6 rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Bu danışan arşivde. Mevcut kayıtları görüntülenebilir; yeni plan veya randevu eklenemez.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="self-start">
          <CardHeader title="Danışan bilgileri" />
          <dl className="divide-y divide-slate-100 px-5 py-2 sm:divide-y-0">
            <Detail label="Doğum tarihi">{client.birthDate ? `${formatDate(client.birthDate)} (${ageLabel(client)})` : '—'}</Detail>
            <Detail label="Cinsiyet">{client.sex ? sexLabels[client.sex] : 'Belirtilmedi'}</Detail>
            <Detail label="E-posta">{client.email ?? '—'}</Detail>
            <Detail label="Telefon">{client.phone ?? '—'}</Detail>
            <Detail label="Notlar">{client.notes ? <span className="font-normal whitespace-pre-line">{client.notes}</span> : '—'}</Detail>
          </dl>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <MeasurementsCard clientId={client.id} />
          <ClientPlansCard client={client} />
        </div>
      </div>

      <ClientFormDialog open={editing} client={client} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={deleting}
        title="Danışan silinsin mi?"
        description="Danışan kalıcı olarak silinir. Ölçüm, plan, randevu veya hedef kaydı varsa silinemez; bunun yerine arşivleyebilirsiniz."
        confirmLabel="Sil"
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          setDeleting(false)
          if (await run(() => repositories.clients.remove(client.id), 'Danışan silindi.')) navigate('/clients')
        }}
      />
    </>
  )
}
