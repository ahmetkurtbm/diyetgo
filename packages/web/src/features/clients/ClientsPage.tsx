import { ageOn } from '@diyetgo/shared'
import { ChevronRight, Plus, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, PageHeader } from '../../components/ui/layout'
import { SortableTh, SortSelect, Table, Td, Th } from '../../components/ui/table'
import { useSort } from '../../components/ui/use-sort'
import { today } from '../../lib/format'
import { ageLabel, fullName } from '../../lib/labels'
import { ClientFormDialog } from './ClientFormDialog'

const sortOptions = [
  { key: 'name', label: 'Ad soyad' },
  { key: 'age', label: 'Yaş' },
  { key: 'email', label: 'E-posta' },
  { key: 'status', label: 'Durum' },
] as const

export function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const query = useRepositoryQuery((r) => r.clients.list({ search, includeArchived }), [search, includeArchived])
  const clients = query.data ?? []
  const filtered = search.trim() !== '' || includeArchived
  const date = today()
  const sorting = useSort(clients, {
    name: { kind: 'text', value: fullName },
    age: { kind: 'number', value: (c) => (c.birthDate && c.birthDate <= date ? ageOn(c.birthDate, date) : null) },
    email: { kind: 'text', value: (c) => c.email },
    status: { kind: 'text', value: (c) => (c.archivedAt ? 'Arşivde' : 'Aktif') },
  })

  return (
    <>
      <PageHeader
        title="Danışanlar"
        description="Danışanlarınızı arayın, ekleyin ve düzenleyin."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-4" />
            Yeni danışan
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block sm:w-80">
            <span className="sr-only">Danışan ara</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad, soyad veya e-posta ara"
              className="h-10 w-full rounded-md border border-slate-300 bg-surface pr-3 pl-9 text-sm placeholder:text-slate-400"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="size-4 rounded border-slate-300 accent-brand-700" />
            Arşivdekileri göster
          </label>
        </div>

        {query.status === 'loading' && <LoadingState />}
        {query.status === 'error' && <ErrorState error={query.error} />}
        {query.status === 'success' && clients.length === 0 &&
          (filtered ? (
            <EmptyState icon={Search} title="Sonuç bulunamadı" description="Arama ölçütlerini değiştirip tekrar deneyin." />
          ) : (
            <EmptyState
              icon={Users}
              title="Henüz danışan yok"
              description="İlk danışanınızı ekleyerek başlayın."
              action={
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Danışan ekle
                </Button>
              }
            />
          ))}
        {clients.length > 0 && (
          <>
            <SortSelect options={sortOptions} sort={sorting.sort} onChange={sorting.setSort} />
            <Table label="Danışan listesi" layout="stacked">
              <thead>
                <tr>
                  <SortableTh label="Ad soyad" column="name" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="Yaş" column="age" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="E-posta" column="email" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="Durum" column="status" sort={sorting.sort} onSort={sorting.toggle} />
                  <Th>
                    <span className="sr-only">Detay</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorting.rows.map((client) => (
                  <tr key={client.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/clients/${client.id}`)}>
                    <Td>
                      <Link to={`/clients/${client.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
                        {fullName(client)}
                      </Link>
                    </Td>
                    <Td label="Yaş" className="whitespace-nowrap">
                      {ageLabel(client)}
                    </Td>
                    <Td label="E-posta" className="break-all">
                      {client.email ?? '—'}
                    </Td>
                    <Td label="Durum">{client.archivedAt ? <Badge>Arşivde</Badge> : <Badge tone="brand">Aktif</Badge>}</Td>
                    <Td className="w-8 text-slate-400 max-sm:hidden">
                      <ChevronRight aria-hidden className="size-4" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Card>
      <ClientFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(client) => navigate(`/clients/${client.id}`)} />
    </>
  )
}
