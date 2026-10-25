/**
 * Günü veya öğünü aynı planın başka yerlerine kopyalama. Hedefte öğün varsa besinler sonuna eklenir
 * (bkz. `MealPlanRepository.copyMeals`).
 */
import { planDayDate, type MealPlan, type MealType, type PlanMeal } from '@diyetgo/shared'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField } from '../../components/ui/form'
import { useToast } from '../../components/ui/toast-context'
import { useRepositories } from '../../data/context'
import { errorMessage } from '../../lib/errors'
import { formatShortDate } from '../../lib/format'

export type CopySource = { kind: 'day'; dayNumber: number } | { kind: 'meal'; meal: PlanMeal }

type Props = {
  plan: MealPlan
  meals: PlanMeal[]
  /** Arşivdekiler dahil tüm öğün türleri, sıralı. */
  mealTypes: MealType[]
  /** Günlük planda seçilebilecek gün sayısı. */
  dayCount: number
  source: CopySource | null
  onClose: () => void
}

export function CopyMealsDialog({ source, onClose, ...rest }: Props) {
  return (
    <Dialog
      open={source !== null}
      onClose={onClose}
      title={source?.kind === 'day' ? `${source.dayNumber}. günü kopyala` : 'Öğünü kopyala'}
      description="Seçtiğiniz yerde zaten öğün varsa kopyalanan besinler o öğünün sonuna eklenir."
    >
      {/* Her açılışta seçimler sıfırlansın diye form kaynağa göre yeniden oluşturulur. */}
      {source && <CopyForm key={source.kind === 'day' ? `day-${source.dayNumber}` : source.meal.id} source={source} onClose={onClose} {...rest} />}
    </Dialog>
  )
}

function CopyForm({ plan, meals, mealTypes, dayCount, source, onClose }: Omit<Props, 'source'> & { source: CopySource }) {
  const repositories = useRepositories()
  const toast = useToast()
  const sourceMeal = source.kind === 'meal' ? source.meal : null
  const sourceDay = source.kind === 'day' ? source.dayNumber : source.meal.dayNumber
  const [mealTypeId, setMealTypeId] = useState(sourceMeal?.mealTypeId ?? '')
  const [days, setDays] = useState<number[]>([])
  const [option, setOption] = useState('new')
  const [busy, setBusy] = useState(false)

  const isOptions = plan.kind === 'options'
  const typeChoices = mealTypes.filter((t) => t.archivedAt === null || t.id === sourceMeal?.mealTypeId)
  const typeName = (id: string) => mealTypes.find((t) => t.id === id)?.name ?? 'Öğün'
  const hasMeal = (day: number, typeId: string) => meals.some((m) => m.dayNumber === day && m.mealTypeId === typeId)
  // Gün kopyalamada kaynak gün, öğün kopyalamada aynı türdeyken kaynağın kendi günü seçilemez.
  const dayChoices = Array.from({ length: dayCount }, (_, i) => i + 1).filter((d) => d !== sourceDay || (sourceMeal !== null && mealTypeId !== sourceMeal.mealTypeId))
  const options = meals.filter((m) => m.mealTypeId === mealTypeId && m.id !== sourceMeal?.id).map((m) => m.dayNumber).sort((a, b) => a - b)
  const nextOption = Math.max(0, ...meals.filter((m) => m.mealTypeId === mealTypeId).map((m) => m.dayNumber)) + 1

  const targets = isOptions
    ? [{ dayNumber: option === 'new' ? nextOption : Number(option), mealTypeId }]
    : days.map((dayNumber) => ({ dayNumber, mealTypeId: sourceMeal ? mealTypeId : null }))
  const mealIds = sourceMeal ? [sourceMeal.id] : meals.filter((m) => m.dayNumber === sourceDay).map((m) => m.id)

  const toggle = (day: number) => setDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b))

  async function copy() {
    setBusy(true)
    try {
      const result = await repositories.mealPlans.copyMeals(plan.id, { mealIds, targets })
      const where = isOptions ? `${typeName(mealTypeId)} · ${targets[0]!.dayNumber}. seçenek` : `${targets.length} güne`
      toast.success(`${where} kopyalandı (${result.items} besin).`)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {sourceMeal && (
        <SelectField
          label="Hangi öğüne"
          value={mealTypeId}
          onChange={(e) => {
            setMealTypeId(e.target.value)
            setDays([])
            setOption('new')
          }}
        >
          {typeChoices.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      )}

      {isOptions ? (
        <SelectField label="Hangi seçeneğe" value={option} onChange={(e) => setOption(e.target.value)}>
          <option value="new">Yeni seçenek ({nextOption}. seçenek)</option>
          {options.map((n) => (
            <option key={n} value={String(n)}>
              {n}. seçeneğin sonuna ekle
            </option>
          ))}
        </SelectField>
      ) : (
        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-2">
            <legend className="text-sm font-medium text-slate-700">Hangi günlere</legend>
            <Button size="sm" variant="ghost" onClick={() => setDays(days.length === dayChoices.length ? [] : dayChoices)}>
              {days.length === dayChoices.length ? 'Seçimi kaldır' : 'Tümünü seç'}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {dayChoices.map((d) => {
              const filled = sourceMeal ? hasMeal(d, mealTypeId) : meals.some((m) => m.dayNumber === d)
              return (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${days.includes(d) ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white'}`}
                >
                  <input type="checkbox" checked={days.includes(d)} onChange={() => toggle(d)} aria-label={`${d}. gün`} />
                  <span>
                    <span className="block font-semibold text-slate-800">{d}. gün</span>
                    <span className="text-slate-500">
                      {formatShortDate(planDayDate(plan.startDate, d))}
                      {filled && ' · dolu'}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">"Dolu" günlerde besinler mevcut öğünün sonuna eklenir.</p>
        </fieldset>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button onClick={onClose} disabled={busy}>
          Vazgeç
        </Button>
        <Button variant="primary" disabled={busy || targets.length === 0 || mealIds.length === 0 } onClick={() => void copy()}>
          Kopyala
        </Button>
      </div>
    </div>
  )
}
