import { energyFromMacros, findActiveGoal, MIN_ADULT_AGE, type Client, type ClientGoal } from '@diyetgo/shared'
import { Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, CardHeader } from '../../components/ui/layout'
import { Table, Td, Th } from '../../components/ui/table'
import { useToast } from '../../components/ui/toast-context'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatNumber, today } from '../../lib/format'
import { goalMethodLabels, goalStatus, goalStatusLabels, goalStatusTones } from '../../lib/labels'
import { GoalFormDialog } from './GoalFormDialog'

const period = (g: ClientGoal) => `${formatDate(g.validFrom)} – ${g.validTo ? formatDate(g.validTo) : 'açık uçlu'}`
const methodLabel = (g: ClientGoal) =>
  g.method === 'mifflin_st_jeor' && g.activityFactor !== null ? `${goalMethodLabels[g.method]} (etkinlik ${formatNumber(g.activityFactor, 3)})` : goalMethodLabels[g.method]

function ActiveGoal({ goal }: { goal: ClientGoal }) {
  const macroEnergy = energyFromMacros(goal)
  // Makronun, makrolardan gelen toplam enerjideki payı.
  const share = (kcal: number) => (macroEnergy > 0 ? `%${formatNumber((kcal * 100) / macroEnergy, 0)}` : '')
  const metrics = [
    ['Enerji', `${formatNumber(goal.energyKcal, 0)} kcal`, ''],
    ['Protein', `${formatNumber(goal.proteinG)} g`, share(4 * goal.proteinG)],
    ['Karbonhidrat', `${formatNumber(goal.carbsG)} g`, share(4 * goal.carbsG)],
    ['Yağ', `${formatNumber(goal.fatG)} g`, share(9 * goal.fatG)],
  ] as const
  // Makrolardan hesaplanan enerji hedef enerjiden %10'dan fazla saparsa bilgi verilir.
  const mismatch = Math.abs(macroEnergy - goal.energyKcal) > goal.energyKcal * 0.1

  return (
    <div className="border-b border-slate-200 px-5 py-4" aria-label="Aktif hedef" role="group">
      <p className="text-xs font-medium text-slate-500">
        Aktif hedef · {period(goal)} · {methodLabel(goal)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map(([label, value, extra]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
              {value}
              {extra && <span className="ml-1 text-xs font-normal text-slate-500">{extra}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {mismatch && (
        <p className="mt-3 text-xs text-amber-800">
          Makrolardan hesaplanan enerji ({formatNumber(macroEnergy, 0)} kcal) enerji hedefinden belirgin biçimde farklı.
        </p>
      )}
    </div>
  )
}

/** Danışan detayında dönemli beslenme hedefleri; geçmiş korunur. */
export function ClientGoalsCard({ client }: { client: Client }) {
  const repositories = useRepositories()
  const toast = useToast()
  const query = useRepositoryQuery((r) => r.goals.listByClient(client.id), [client.id])
  const [editing, setEditing] = useState<ClientGoal | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ClientGoal | null>(null)
  const goals = query.data ?? []
  const date = today()
  const active = findActiveGoal(goals, date)

  async function remove(goal: ClientGoal) {
    setDeleting(null)
    try {
      await repositories.goals.remove(goal.id)
      toast.success('Hedef silindi.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Beslenme hedefleri"
        description="Dönemli hedefler; geçmiş hedefler korunur."
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" />
            Yeni hedef
          </Button>
        }
      />
      {query.status === 'loading' && <LoadingState />}
      {query.status === 'error' && <ErrorState error={query.error} />}
      {query.status === 'success' && goals.length === 0 && (
        <EmptyState icon={Target} title="Henüz hedef yok" description="Günlük enerji ve makro hedeflerini dönem olarak tanımlayın." />
      )}
      {goals.length > 0 && (
        <>
          {active ? <ActiveGoal goal={active} /> : <p className="border-b border-slate-200 px-5 py-4 text-sm text-slate-500">Bugün için aktif hedef yok.</p>}
          <Table label="Hedef geçmişi">
            <thead>
              <tr>
                <Th>Dönem</Th>
                <Th className="text-right">Enerji</Th>
                <Th className="hidden text-right sm:table-cell">P / K / Y (g)</Th>
                <Th className="hidden md:table-cell">Yöntem</Th>
                <Th>Durum</Th>
                <Th>
                  <span className="sr-only">İşlemler</span>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {goals.map((g) => {
                const status = goalStatus(g, date)
                return (
                  <tr key={g.id}>
                    <Td className="whitespace-nowrap">
                      <span className="font-medium text-slate-900">{period(g)}</span>
                      {g.notes && <span className="block max-w-56 truncate text-xs text-slate-500">{g.notes}</span>}
                    </Td>
                    <Td className="text-right tabular-nums">{formatNumber(g.energyKcal, 0)} kcal</Td>
                    <Td className="hidden text-right tabular-nums sm:table-cell">
                      {formatNumber(g.proteinG)} / {formatNumber(g.carbsG)} / {formatNumber(g.fatG)}
                    </Td>
                    <Td className="hidden md:table-cell">{methodLabel(g)}</Td>
                    <Td>
                      <Badge tone={goalStatusTones[status]}>{goalStatusLabels[status]}</Badge>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" aria-label={`${formatDate(g.validFrom)} hedefini düzenle`} onClick={() => setEditing(g)}>
                        <Pencil aria-hidden className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`${formatDate(g.validFrom)} hedefini sil`} onClick={() => setDeleting(g)}>
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </>
      )}
      <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        Hesaplanan değerler popülasyon ortalamalarına dayalı tahminlerdir; teşhis veya tedavi önerisi değildir ve uzman değerlendirmesinin yerini tutmaz.
        Mifflin-St Jeor yalnızca {MIN_ADULT_AGE} yaş ve üzeri yetişkinler için kullanılır; gebelik, emzirme, sporcular ve bazı klinik durumlarda gerçek ihtiyaç farklı olabilir.
      </p>
      <GoalFormDialog open={editing !== null} client={client} goal={editing === 'new' || editing === null ? undefined : editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Hedef silinsin mi?"
        description={
          deleting ? `${period(deleting)} dönemindeki hedef kalıcı olarak silinir. Önceki hedefin bitiş tarihi otomatik olarak değişmez.` : undefined
        }
        confirmLabel="Sil"
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
      />
    </Card>
  )
}
