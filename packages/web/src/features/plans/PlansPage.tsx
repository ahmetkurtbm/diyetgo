import { planLengthDays } from '@diyetgo/shared'
import { ChevronRight, NotebookPen, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { SelectField } from '../../components/ui/form'
import { Card, PageHeader } from '../../components/ui/layout'
import { SortableTh, SortSelect, Table, Td, Th } from '../../components/ui/table'
import { useSort } from '../../components/ui/use-sort'
import { formatDate, today } from '../../lib/format'
import { fullName, planStatus, planStatusLabels, planStatusTones, type PlanStatus } from '../../lib/labels'
import { PlanFormDialog } from './PlanFormDialog'

/** Durum sıralaması: önce devam edenler, sonra başlamamış, tamamlanmış ve arşivdekiler. */
const statusRank: Record<PlanStatus, number> = { active: 0, upcoming: 1, finished: 2, archived: 3 }

const sortOptions = [
  { key: 'title', label: 'Plan' },
  { key: 'client', label: 'Danışan' },
  { key: 'start', label: 'Başlangıç' },
  { key: 'status', label: 'Durum' },
] as const

export function PlansPage() {
  const navigate = useNavigate()
  const [clientId, setClientId] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const query = useRepositoryQuery(
    async (r) => {
      const [plans, clients] = await Promise.all([r.mealPlans.list({ includeArchived, clientId: clientId || undefined }), r.clients.list({ includeArchived: true })])
      return { plans, clients }
    },
    [clientId, includeArchived],
  )
  const plans = query.data?.plans ?? []
  const clientsById = new Map((query.data?.clients ?? []).map((c) => [c.id, c]))
  const date = today()
  const clientName = (clientId: string) => {
    const client = clientsById.get(clientId)
    return client ? fullName(client) : null
  }
  const sorting = useSort(plans, {
    title: { kind: 'text', value: (p) => p.title },
    client: { kind: 'text', value: (p) => clientName(p.clientId) },
    start: { kind: 'date', value: (p) => p.startDate },
    status: { kind: 'number', value: (p) => statusRank[planStatus(p, date)] },
  })

  return (
    <>
      <PageHeader
        title="Beslenme planları"
        description="Planlar göreli günlerden oluşur; 1. gün planın başlangıç tarihidir."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-4" />
            Yeni plan
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="sm:w-72">
            <SelectField label="Danışan" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Tüm danışanlar</option>
              {(query.data?.clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
            </SelectField>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="size-4 rounded border-slate-300 accent-brand-700" />
            Arşivdekileri göster
          </label>
        </div>

        {query.status === 'loading' && <LoadingState />}
        {query.status === 'error' && <ErrorState error={query.error} />}
        {query.status === 'success' && plans.length === 0 && (
          <EmptyState
            icon={NotebookPen}
            title={clientId || includeArchived ? 'Bu ölçütlere uyan plan yok' : 'Henüz plan yok'}
            description="Bir danışan için beslenme planı oluşturun."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Plan oluştur
              </Button>
            }
          />
        )}
        {plans.length > 0 && (
          <>
            <SortSelect options={sortOptions} sort={sorting.sort} onChange={sorting.setSort} />
            <Table label="Plan listesi" layout="stacked">
              <thead>
                <tr>
                  <SortableTh label="Plan" column="title" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="Danışan" column="client" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="Tarihler" column="start" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="Durum" column="status" sort={sorting.sort} onSort={sorting.toggle} />
                  <Th>
                    <span className="sr-only">Detay</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorting.rows.map((plan) => {
                  const length = planLengthDays(plan)
                  const status = planStatus(plan, date)
                  return (
                    <tr key={plan.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/plans/${plan.id}`)}>
                      <Td>
                        <Link to={`/plans/${plan.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
                          {plan.title}
                        </Link>
                      </Td>
                      <Td label="Danışan">{clientName(plan.clientId) ?? '—'}</Td>
                      <Td label="Tarihler">
                        <span>
                          {formatDate(plan.startDate)} – {plan.endDate ? formatDate(plan.endDate) : 'açık uçlu'}
                          {plan.kind === 'options' ? (
                            <span className="block text-xs text-slate-500">Seçenekli haftalık menü</span>
                          ) : (
                            length !== null && <span className="block text-xs text-slate-500">{length} gün</span>
                          )}
                        </span>
                      </Td>
                      <Td label="Durum">
                        <Badge tone={planStatusTones[status]}>{planStatusLabels[status]}</Badge>
                      </Td>
                      <Td className="w-8 text-slate-400 max-sm:hidden">
                        <ChevronRight aria-hidden className="size-4" />
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </>
        )}
      </Card>
      <PlanFormDialog open={creating} clientId={clientId || undefined} onClose={() => setCreating(false)} onSaved={(plan) => navigate(`/plans/${plan.id}`)} />
    </>
  )
}
