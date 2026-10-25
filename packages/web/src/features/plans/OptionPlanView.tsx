/**
 * Seçenekli haftalık menü: diyetisyen her öğün türü için seçenekler ve haftalık adet girer, danışan
 * seçeneklerden birini seçer. Haftalık değerler, danışanın en düşük / ortalama / en yüksek kalorili
 * seçenekleri seçmesine göre aralık olarak gösterilir. Öğünlerin `dayNumber` alanı seçenek numarasıdır.
 */
import { optionPlanSummary, type ClientGoal, type Food, type MealPlan, type MealType, type Nutrients, type PlanMeal, type PlanMealItem } from '@diyetgo/shared'
import { ListPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/feedback'
import { Card, CardHeader } from '../../components/ui/layout'
import { useToast } from '../../components/ui/toast-context'
import { useRepositories } from '../../data/context'
import { errorMessage } from '../../lib/errors'
import { formatNumber } from '../../lib/format'
import { MealCard } from './MealCard'
import { NutrientSummary } from './NutrientSummary'

type Props = {
  plan: MealPlan
  meals: PlanMeal[]
  items: PlanMealItem[]
  foodsById: ReadonlyMap<string, Food>
  selectableFoods: Food[]
  /** Arşivdekiler dahil tüm öğün türleri, sıralı. */
  mealTypes: MealType[]
  goal: ClientGoal | undefined
  onEditMeal: (meal: PlanMeal) => void
  onDeleteMeal: (meal: PlanMeal) => void
  onCopyMeal: (meal: PlanMeal) => void
}

const metrics = [
  { key: 'energyKcal', label: 'Enerji', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Karbonhidrat', unit: 'g' },
  { key: 'fatG', label: 'Yağ', unit: 'g' },
] as const

const range = (min: Nutrients, max: Nutrients, key: keyof Nutrients) =>
  Math.round(min[key]) === Math.round(max[key]) ? formatNumber(min[key], 0) : `${formatNumber(min[key], 0)} – ${formatNumber(max[key], 0)}`

export function OptionPlanView({ plan, meals, items, foodsById, selectableFoods, mealTypes, goal, onEditMeal, onDeleteMeal, onCopyMeal }: Props) {
  const repositories = useRepositories()
  const toast = useToast()
  const [quotas, setQuotas] = useState<Record<string, string>>(() => Object.fromEntries(plan.weeklyQuotas.map((q) => [q.mealTypeId, String(q.perWeek)])))
  const [saving, setSaving] = useState(false)
  const summary = optionPlanSummary(meals, items, foodsById, plan.weeklyQuotas)
  const shownTypes = mealTypes.filter((t) => t.archivedAt === null || plan.weeklyQuotas.some((q) => q.mealTypeId === t.id) || meals.some((m) => m.mealTypeId === t.id))
  const dirty = shownTypes.some((t) => (quotas[t.id] ?? '0') !== String(plan.weeklyQuotas.find((q) => q.mealTypeId === t.id)?.perWeek ?? 0))

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

  async function saveQuotas() {
    const weeklyQuotas = shownTypes
      .map((t) => ({ mealTypeId: t.id, perWeek: Number(quotas[t.id] ?? 0) }))
      .filter((q) => q.perWeek > 0)
    if (weeklyQuotas.some((q) => !Number.isInteger(q.perWeek) || q.perWeek > 21)) {
      toast.error('Haftalık adet 0 ile 21 arasında bir tam sayı olmalı.')
      return
    }
    setSaving(true)
    const { clientId, title, startDate, endDate, notes, kind } = plan
    await run(() => repositories.mealPlans.update(plan.id, { clientId, title, startDate, endDate, notes, kind, weeklyQuotas }), 'Haftalık adetler kaydedildi.')
    setSaving(false)
  }

  function addOption(mealType: MealType) {
    const next = Math.max(0, ...meals.filter((m) => m.mealTypeId === mealType.id).map((m) => m.dayNumber)) + 1
    void run(() => repositories.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: next, mealTypeId: mealType.id, time: null, notes: null }), `${mealType.name} için ${next}. seçenek eklendi.`)
  }

  const goalWeek = goal ? goal.energyKcal * 7 : null

  return (
    <>
      <Card className="mb-6">
        <CardHeader
          title="Haftalık aralık"
          description="Danışan her öğünde en düşük veya en yüksek kalorili seçeneği seçerse haftalık toplam bu aralıkta kalır."
        />
        <div className="space-y-4 px-5 py-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map(({ key, label, unit }) => (
              <div key={key} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                <dt className="text-xs font-medium text-slate-600">Haftalık {label.toLocaleLowerCase('tr-TR')}</dt>
                <dd className="mt-1">
                  <span className="text-lg font-semibold text-slate-900 tabular-nums">{range(summary.weekly.min, summary.weekly.max, key)}</span>{' '}
                  <span className="text-xs text-slate-500">{unit}</span>
                  <span className="block text-xs text-slate-500 tabular-nums">Ortalama {formatNumber(summary.weekly.average[key], 0)}</span>
                </dd>
              </div>
            ))}
          </dl>
          {goalWeek !== null && (
            <p className="text-sm text-slate-600">
              Haftalık enerji hedefi: <strong className="tabular-nums">{formatNumber(goalWeek, 0)} kcal</strong> (günlük {formatNumber(goal!.energyKcal, 0)} × 7)
            </p>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Günlük ortalama (haftalık ortalama ÷ 7)</h3>
            <NutrientSummary totals={summary.daily.average} goal={goal} />
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader
          title="Haftalık öğün adetleri"
          description="Her öğün türünün haftada kaç kez yeneceğini girin (0–21). Adedi 0 olan öğün türü hesaba katılmaz."
          actions={
            <Button size="sm" variant="primary" disabled={!dirty || saving} onClick={() => void saveQuotas()}>
              {saving ? 'Kaydediliyor…' : 'Adetleri kaydet'}
            </Button>
          }
        />
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {shownTypes.map((t) => (
            <label key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-100">
              <span className="font-medium text-slate-700">
                {t.name}
                {t.archivedAt && <span className="ml-1 text-xs text-slate-500">(arşivde)</span>}
              </span>
              <span className="flex items-center gap-2 text-slate-500">
                haftada
                <input
                  type="number"
                  min={0}
                  max={21}
                  inputMode="numeric"
                  aria-label={`${t.name} haftalık adet`}
                  value={quotas[t.id] ?? '0'}
                  onChange={(e) => setQuotas({ ...quotas, [t.id]: e.target.value })}
                  className="h-9 w-16 rounded-md border border-slate-300 bg-white px-2 text-right tabular-nums"
                />
                kez
              </span>
            </label>
          ))}
        </div>
      </Card>

      {shownTypes.map((t) => {
        const options = meals.filter((m) => m.mealTypeId === t.id).sort((a, b) => a.dayNumber - b.dayNumber)
        const perWeek = plan.weeklyQuotas.find((q) => q.mealTypeId === t.id)?.perWeek ?? 0
        if (options.length === 0 && perWeek === 0) return null
        return (
          <section key={t.id} aria-label={`${t.name} seçenekleri`} className="mb-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                {t.name}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  haftada {perWeek} kez · {options.length} seçenek
                </span>
              </h2>
              <Button size="sm" disabled={t.archivedAt !== null} onClick={() => addOption(t)}>
                <Plus aria-hidden className="size-4" />
                Seçenek ekle
              </Button>
            </div>
            {options.length === 0 ? (
              <Card>
                <EmptyState icon={ListPlus} title={`${t.name} için seçenek yok`} description="Danışanın seçebileceği menüleri ekleyin." />
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {options.map((meal) => (
                  <MealCard
                    key={meal.id}
                    title={`${t.name} · ${meal.dayNumber}. seçenek`}
                    meal={meal}
                    mealType={t}
                    items={items}
                    foodsById={foodsById}
                    selectableFoods={selectableFoods}
                    onEdit={() => onEditMeal(meal)}
                    onDelete={() => onDeleteMeal(meal)}
                    onCopy={() => onCopyMeal(meal)}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
      {plan.weeklyQuotas.length === 0 && meals.length === 0 && (
        <Card>
          <EmptyState icon={ListPlus} title="Henüz haftalık adet yok" description="Yukarıdan öğün türlerinin haftalık adetlerini girip kaydedin; ardından her öğün için seçenek ekleyin." />
        </Card>
      )}
    </>
  )
}
