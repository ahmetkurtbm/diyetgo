import { mealTotals, nutrientsFor, type Food, type MealType, type PlanMeal, type PlanMealItem } from '@diyetgo/shared'
import { Clock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useRepositories } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/feedback'
import { SelectField, TextField } from '../../components/ui/form'
import { Card } from '../../components/ui/layout'
import { useToast } from '../../components/ui/toast-context'
import { errorMessage, fieldErrorsOf } from '../../lib/errors'
import { formatNumber } from '../../lib/format'
import { numberToText, parseNumber } from '../../lib/forms'
import { useSubmit } from '../../lib/use-submit'
import { NutrientLine } from './NutrientSummary'

type Props = {
  meal: PlanMeal
  mealType?: MealType
  items: PlanMealItem[]
  foodsById: ReadonlyMap<string, Food>
  /** Yeni içerik olarak seçilebilen (arşivde olmayan) besinler. */
  selectableFoods: Food[]
  onEdit: () => void
  onDelete: () => void
  /** Varsayılan başlık öğün türünün adıdır; seçenekli planda "Kahvaltı · 2. seçenek" gibi verilir. */
  title?: string
}

const foodLabel = (food: Food) => (food.brand ? `${food.name} (${food.brand})` : food.name)

export function MealCard({ meal, mealType, items, foodsById, selectableFoods, onEdit, onDelete, title: customTitle }: Props) {
  const [adding, setAdding] = useState(false)
  const mealItems = items.filter((i) => i.planMealId === meal.id)
  const totals = mealTotals(meal.id, items, foodsById)
  const title = customTitle ?? mealType?.name ?? 'Öğün'

  return (
    <Card aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            {title}
            {meal.time && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-500">
                <Clock aria-hidden className="size-3.5" />
                {meal.time}
              </span>
            )}
          </h3>
          <span data-testid="meal-totals">
            <NutrientLine totals={totals} />
          </span>
          {meal.notes && <p className="mt-1 text-xs text-slate-500">{meal.notes}</p>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" aria-label={`${title} öğününü düzenle`} onClick={onEdit}>
            <Pencil aria-hidden className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`${title} öğününü sil`} onClick={onDelete}>
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </div>

      {mealItems.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">Bu öğünde henüz besin yok.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {mealItems.map((item) => (
            // Miktar anahtarın parçası: kayıttan sonra veya başka sekmedeki değişiklikte alan güncel değerle yeniden oluşur.
            <ItemRow key={`${item.id}:${item.quantity}`} item={item} food={foodsById.get(item.foodId)} />
          ))}
        </ul>
      )}

      <div className="border-t border-slate-200 px-4 py-3 sm:px-5">
        {adding ? (
          <AddItemForm meal={meal} sortOrder={Math.max(-1, ...mealItems.map((i) => i.sortOrder)) + 1} foods={selectableFoods} onDone={() => setAdding(false)} />
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            Besin ekle
          </Button>
        )}
      </div>
    </Card>
  )
}

function ItemRow({ item, food }: { item: PlanMealItem; food?: Food }) {
  const repositories = useRepositories()
  const toast = useToast()
  const [text, setText] = useState(numberToText(item.quantity))
  const [error, setError] = useState<string>()
  const name = food ? foodLabel(food) : 'Bilinmeyen besin'
  const unit = food?.baseUnit ?? 'g'

  async function saveQuantity() {
    const quantity = parseNumber(text)
    if (quantity === item.quantity) return setError(undefined)
    try {
      await repositories.mealPlans.updateItem(item.id, { ...item, quantity })
      setError(undefined)
      toast.success('Miktar güncellendi.')
    } catch (e) {
      const fieldError = fieldErrorsOf(e).quantity
      setError(fieldError)
      if (!fieldError) toast.error(errorMessage(e))
    }
  }

  async function remove() {
    try {
      await repositories.mealPlans.removeItem(item.id)
      toast.success(`${name} öğünden çıkarıldı.`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const portions = food?.portionAmount ? item.quantity / food.portionAmount : null
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
      <div className="min-w-0 flex-1 basis-40">
        <span className="text-sm font-medium text-slate-900">{name}</span>
        {food?.archivedAt && (
          <span className="ml-2">
            <Badge>Arşivde</Badge>
          </span>
        )}
        <span className="block">{food && <NutrientLine totals={nutrientsFor(food, item.quantity)} />}</span>
      </div>
      <div className="w-36">
        <label className="flex items-center gap-1.5">
          <span className="sr-only">{name} miktarı ({unit})</span>
          <input
            inputMode="decimal"
            value={text}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => void saveQuantity()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void saveQuantity()
              }
            }}
            className="h-8 w-20 rounded-md border border-slate-300 px-2 text-right text-sm tabular-nums aria-invalid:border-red-500"
          />
          <span className="text-xs text-slate-500">{unit}</span>
        </label>
        {error ? (
          <span className="block text-xs text-red-600">{error}</span>
        ) : (
          portions !== null && (
            <span className="block text-xs text-slate-500">
              ≈ {formatNumber(portions)} × {food?.portionLabel}
            </span>
          )
        )}
      </div>
      <Button variant="ghost" size="sm" aria-label={`${name} öğünden çıkar`} onClick={() => void remove()}>
        <X aria-hidden className="size-4" />
      </Button>
    </li>
  )
}

function AddItemForm({ meal, sortOrder, foods, onDone }: { meal: PlanMeal; sortOrder: number; foods: Food[]; onDone: () => void }) {
  const repositories = useRepositories()
  const { errors, busy, submit } = useSubmit()
  const [search, setSearch] = useState('')
  const [foodId, setFoodId] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<'base' | 'portion'>('base')
  const [foodError, setFoodError] = useState<string>()

  const normalized = search.trim().toLocaleLowerCase('tr-TR')
  const options = normalized ? foods.filter((f) => foodLabel(f).toLocaleLowerCase('tr-TR').includes(normalized)) : foods
  const food = foods.find((f) => f.id === foodId)
  const hasPortion = food?.portionAmount != null && food.portionLabel
  const parsed = parseNumber(amount)
  const quantity = unit === 'portion' && hasPortion ? parsed * food.portionAmount! : parsed
  const preview = food && Number.isFinite(quantity) && quantity > 0 ? nutrientsFor(food, quantity) : null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!food) return setFoodError('Bir besin seçin')
    setFoodError(undefined)
    const ok = await submit(
      () => repositories.mealPlans.addItem({ planMealId: meal.id, foodId: food.id, quantity, sortOrder, notes: null }),
      `${food.name} öğüne eklendi.`,
    )
    if (ok) onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Öğüne besin ekle" className="grid gap-3 sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1.4fr_7rem_9rem_auto] lg:items-start">
      <TextField label="Besin ara" type="search" autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} />
      <SelectField
        label="Besin"
        required
        value={foodId}
        error={foodError ?? errors.foodId}
        onChange={(e) => {
          setFoodId(e.target.value)
          setUnit('base')
        }}
      >
        <option value="">{options.length === 0 ? 'Eşleşen besin yok' : 'Besin seçin'}</option>
        {options.map((f) => (
          <option key={f.id} value={f.id}>
            {foodLabel(f)}
          </option>
        ))}
      </SelectField>
      <TextField label="Miktar" required inputMode="decimal" value={amount} error={errors.quantity} onChange={(e) => setAmount(e.target.value)} />
      <SelectField label="Birim" value={unit} onChange={(e) => setUnit(e.target.value as 'base' | 'portion')}>
        <option value="base">{food?.baseUnit ?? 'g'}</option>
        {hasPortion && (
          <option value="portion">
            {food.portionLabel} ({formatNumber(food.portionAmount!)} {food.baseUnit})
          </option>
        )}
      </SelectField>
      <div className="flex gap-2 lg:pt-6">
        <Button type="submit" variant="primary" disabled={busy}>
          Ekle
        </Button>
        <Button onClick={onDone} disabled={busy}>
          Vazgeç
        </Button>
      </div>
      {preview && (
        <p className="text-xs text-slate-600 sm:col-span-2 lg:col-span-5">
          {formatNumber(quantity)} {food?.baseUnit}: <NutrientLine totals={preview} />
        </p>
      )}
    </form>
  )
}
