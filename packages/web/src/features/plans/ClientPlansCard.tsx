import type { Client } from '@diyetgo/shared'
import { NotebookPen, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, CardHeader } from '../../components/ui/layout'
import { formatDate, today } from '../../lib/format'
import { planStatus, planStatusLabels, planStatusTones } from '../../lib/labels'
import { PlanFormDialog } from './PlanFormDialog'

/** Danışan detayında danışanın planları. */
export function ClientPlansCard({ client }: { client: Client }) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const query = useRepositoryQuery((r) => r.mealPlans.list({ clientId: client.id, includeArchived: true }), [client.id])
  const plans = query.data ?? []
  const archived = client.archivedAt !== null
  const date = today()

  return (
    <Card>
      <CardHeader
        title="Beslenme planları"
        description={archived ? 'Arşivdeki danışana yeni plan eklenemez.' : undefined}
        actions={
          !archived && (
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" />
              Yeni plan
            </Button>
          )
        }
      />
      {query.status === 'loading' && <LoadingState />}
      {query.status === 'error' && <ErrorState error={query.error} />}
      {query.status === 'success' && plans.length === 0 && <EmptyState icon={NotebookPen} title="Henüz plan yok" />}
      {plans.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {plans.map((plan) => {
            const status = planStatus(plan, date)
            return (
              <li key={plan.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Link to={`/plans/${plan.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-700">
                    {plan.title}
                  </Link>
                  <span className="block text-xs text-slate-500">
                    {formatDate(plan.startDate)} – {plan.endDate ? formatDate(plan.endDate) : 'açık uçlu'}
                  </span>
                </div>
                <Badge tone={planStatusTones[status]}>{planStatusLabels[status]}</Badge>
              </li>
            )
          })}
        </ul>
      )}
      <PlanFormDialog open={creating} clientId={client.id} onClose={() => setCreating(false)} onSaved={(plan) => navigate(`/plans/${plan.id}`)} />
    </Card>
  )
}
