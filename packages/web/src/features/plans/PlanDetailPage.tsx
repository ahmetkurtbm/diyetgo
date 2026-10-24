import {
  canAddFoodToMeal,
  dayTotals,
  findActiveGoal,
  LIMITS,
  planDayDate,
  planLengthDays,
  planWeekOf,
  planWeekTotals,
  type MealPlan,
  type PlanMeal,
} from '@diyetgo/shared'
import { Archive, ArchiveRestore, ArrowLeft, Copy, FileX, Pencil, Plus, Trash2, Utensils } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { RepositoryError } from '../../data/repositories'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, CardHeader, PageHeader } from '../../components/ui/layout'
import { useToast } from '../../components/ui/toast-context'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatLongDate, formatNumber, formatShortDate, today } from '../../lib/format'
import { fullName, planStatus, planStatusLabels, planStatusTones } from '../../lib/labels'
import { CopyPlanDialog } from './CopyPlanDialog'
import { MealCard } from './MealCard'
import { MealFormDialog } from './MealFormDialog'
import { NutrientSummary } from './NutrientSummary'
import { PlanFormDialog } from './PlanFormDialog'

const weekTotalMetrics = [
  { key: 'energyKcal', label: 'Enerji', unit: 'kcal', digits: 0 },
  { key: 'proteinG', label: 'Protein', unit: 'g', digits: 0 },
  { key: 'carbsG', label: 'Karbonhidrat', unit: 'g', digits: 0 },
  { key: 'fatG', label: 'Yağ', unit: 'g', digits: 0 },
] as const

/** Bitişi olan planda tüm günler; açık uçlu planda en az 7 gün ve son dolu günden bir fazlası gösterilir. */
function visibleDayCount(plan: MealPlan, meals: PlanMeal[]): number {
  const length = planLengthDays(plan)
  if (length !== null) return length
  return Math.min(LIMITS.planDays, Math.max(7, Math.max(0, ...meals.map((m) => m.dayNumber)) + 1))
}

export function PlanDetailPage() {
  const { planId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const repositories = useRepositories()
  const toast = useToast()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'edit' | 'copy' | 'delete' | 'meal' | null>(null)
  const [editingMeal, setEditingMeal] = useState<PlanMeal | null>(null)
  const [deletingMeal, setDeletingMeal] = useState<PlanMeal | null>(null)

  const query = useRepositoryQuery(
    async (r) => {
      const detail = await r.mealPlans.get(planId)
      const [client, foods, mealTypes, goals] = await Promise.all([
        r.clients.get(detail.plan.clientId),
        r.foods.list({ includeArchived: true }),
        r.mealTypes.list({ includeArchived: true }),
        r.goals.listByClient(detail.plan.clientId),
      ])
      return { ...detail, client, foods, mealTypes, goals }
    },
    [planId],
  )

  if (query.status === 'loading') return <LoadingState />
  if (query.status === 'error' && !query.data) {
    const notFound = query.error instanceof RepositoryError && query.error.code === 'not_found'
    return (
      <Card>
        {notFound ? (
          <EmptyState
            icon={FileX}
            title="Plan bulunamadı"
            description="Plan silinmiş veya bağlantı hatalı olabilir."
            action={
              <Link to="/plans" className="text-sm font-medium text-brand-700 hover:underline">
                Plan listesine dön
              </Link>
            }
          />
        ) : (
          <ErrorState error={query.error} />
        )}
      </Card>
    )
  }

  const { plan, meals, items, client, foods, mealTypes, goals } = query.data!
  const foodsById = new Map(foods.map((f) => [f.id, f]))
  const mealTypesById = new Map(mealTypes.map((t) => [t.id, t]))
  const selectableFoods = foods.filter(canAddFoodToMeal)
  const dayCount = visibleDayCount(plan, meals)
  const requested = Number(searchParams.get('day'))
  const day = Number.isInteger(requested) && requested >= 1 && requested <= dayCount ? requested : 1
  const dayDate = planDayDate(plan.startDate, day)
  const dayMeals = meals.filter((m) => m.dayNumber === day)
  const week = planWeekTotals(planWeekOf(day), dayCount, meals, items, foodsById)
  const usedTypeIds = new Set(dayMeals.map((m) => m.mealTypeId))
  const availableTypes = (current?: PlanMeal) => mealTypes.filter((t) => (t.archivedAt === null && !usedTypeIds.has(t.id)) || t.id === current?.mealTypeId)
  const status = planStatus(plan, today())
  const archived = plan.archivedAt !== null

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
      <Link to="/plans" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="size-4" />
        Beslenme planları
      </Link>
      <PageHeader
        title={plan.title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to={`/clients/${client.id}`} className="font-medium text-slate-700 hover:text-brand-700">
              {fullName(client)}
            </Link>
            <span aria-hidden>·</span>
            <span>{plan.endDate ? `${formatDate(plan.startDate)} – ${formatDate(plan.endDate)}` : `${formatDate(plan.startDate)} tarihinden itibaren`}</span>
            <Badge tone={planStatusTones[status]}>{planStatusLabels[status]}</Badge>
          </span>
        }
        actions={
          <>
            <Button onClick={() => setDialog('edit')}>
              <Pencil aria-hidden className="size-4" />
              Düzenle
            </Button>
            <Button onClick={() => setDialog('copy')}>
              <Copy aria-hidden className="size-4" />
              Kopyala
            </Button>
            <Button onClick={() => run(() => repositories.mealPlans.setArchived(plan.id, !archived), archived ? 'Plan arşivden çıkarıldı.' : 'Plan arşivlendi.')}>
              {archived ? <ArchiveRestore aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />}
              {archived ? 'Arşivden çıkar' : 'Arşivle'}
            </Button>
            <Button variant="ghost" aria-label="Planı sil" onClick={() => setDialog('delete')}>
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </>
        }
      />

      <nav aria-label="Plan günleri" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex gap-2 pb-1">
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((n) => {
            const hasMeals = meals.some((m) => m.dayNumber === n)
            return (
              <li key={n}>
                <button
                  type="button"
                  aria-current={n === day ? 'page' : undefined}
                  onClick={() => setSearchParams({ day: String(n) }, { replace: true })}
                  className={`flex w-16 flex-col items-center rounded-md border px-2 py-1.5 text-xs ${
                    n === day ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="font-semibold">{n}. gün</span>
                  <span className="text-slate-500">{formatShortDate(planDayDate(plan.startDate, n))}</span>
                  <span aria-hidden className={`mt-0.5 size-1.5 rounded-full ${hasMeals ? 'bg-brand-600' : 'bg-transparent'}`} />
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <Card className="mb-6">
        <CardHeader title={`${day}. gün toplamı`} description={formatLongDate(dayDate)} />
        <div className="px-5 py-4">
          <NutrientSummary totals={dayTotals(day, meals, items, foodsById)} goal={findActiveGoal(goals, dayDate)} />
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title={`${week.week}. hafta toplamı`}
          description={`${week.fromDay}–${week.toDay}. günler (${formatShortDate(planDayDate(plan.startDate, week.fromDay))} – ${formatShortDate(planDayDate(plan.startDate, week.toDay))}) · ${week.daysWithMeals} günde öğün var`}
        />
        <div className="space-y-4 px-5 py-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {weekTotalMetrics.map(({ key, label, unit, digits }) => (
              <div key={key} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                <dt className="text-xs font-medium text-slate-600">Haftalık {label.toLocaleLowerCase('tr-TR')}</dt>
                <dd className="mt-1">
                  <span className="text-lg font-semibold text-slate-900 tabular-nums">{formatNumber(week.total[key], digits)}</span>{' '}
                  <span className="text-xs text-slate-500">{unit}</span>
                </dd>
              </div>
            ))}
          </dl>
          {week.daysWithMeals > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Günlük ortalama (öğünü olan {week.daysWithMeals} gün)</h3>
              <NutrientSummary totals={week.average} goal={findActiveGoal(goals, dayDate)} />
            </div>
          )}
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Öğünler</h2>
        <Button variant="primary" size="sm" disabled={availableTypes().length === 0} onClick={() => setDialog('meal')}>
          <Plus aria-hidden className="size-4" />
          Öğün ekle
        </Button>
      </div>
      {availableTypes().length === 0 && dayMeals.length > 0 && <p className="mb-3 text-xs text-slate-500">Bu gün için tüm öğün türleri eklendi.</p>}

      {dayMeals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Utensils}
            title="Bu gün için öğün yok"
            description="Öğün ekleyip besinleri porsiyonlarıyla girin."
            action={
              availableTypes().length > 0 && (
                <Button variant="primary" onClick={() => setDialog('meal')}>
                  Öğün ekle
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {dayMeals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              mealType={mealTypesById.get(meal.mealTypeId)}
              items={items}
              foodsById={foodsById}
              selectableFoods={selectableFoods}
              onEdit={() => setEditingMeal(meal)}
              onDelete={() => setDeletingMeal(meal)}
            />
          ))}
        </div>
      )}

      <PlanFormDialog open={dialog === 'edit'} plan={plan} onClose={() => setDialog(null)} />
      <CopyPlanDialog open={dialog === 'copy'} plan={plan} onClose={() => setDialog(null)} onCopied={(copy) => navigate(`/plans/${copy.id}`)} />
      <MealFormDialog open={dialog === 'meal'} planId={plan.id} dayNumber={day} mealTypes={availableTypes()} onClose={() => setDialog(null)} />
      <MealFormDialog
        open={editingMeal !== null}
        planId={plan.id}
        dayNumber={editingMeal?.dayNumber ?? day}
        meal={editingMeal ?? undefined}
        mealTypes={availableTypes(editingMeal ?? undefined)}
        onClose={() => setEditingMeal(null)}
      />
      <ConfirmDialog
        open={deletingMeal !== null}
        title="Öğün silinsin mi?"
        description={
          deletingMeal
            ? `"${mealTypesById.get(deletingMeal.mealTypeId)?.name ?? 'Öğün'}" ve içindeki ${items.filter((i) => i.planMealId === deletingMeal.id).length} besin silinir.`
            : undefined
        }
        confirmLabel="Sil"
        onCancel={() => setDeletingMeal(null)}
        onConfirm={() => {
          const target = deletingMeal
          setDeletingMeal(null)
          if (target) void run(() => repositories.mealPlans.removeMeal(target.id), 'Öğün silindi.')
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Plan silinsin mi?"
        description={`"${plan.title}" planı, ${meals.length} öğün ve ${items.length} öğün içeriğiyle birlikte kalıcı olarak silinir. Planı saklamak istiyorsanız arşivleyin.`}
        confirmLabel="Planı sil"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null)
          if (await run(() => repositories.mealPlans.remove(plan.id), 'Plan silindi.')) navigate('/plans')
        }}
      />
    </>
  )
}
