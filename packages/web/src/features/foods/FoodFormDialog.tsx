import {
  cookingMethodSchema,
  energyFromMacros,
  ingredientsWeight,
  recipeIngredientIssue,
  resolveRecipeFoods,
  type CookingMethod,
  type Food,
  type FoodInput,
  type RecipeIngredientsInput,
} from '@diyetgo/shared'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { RepositoryError } from '../../data/repositories'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField, TextField } from '../../components/ui/form'
import { useToast } from '../../components/ui/toast-context'
import { errorMessage } from '../../lib/errors'
import { emptyToNull, numberToText, parseNumber, parseOptionalNumber } from '../../lib/forms'
import { formatNumber } from '../../lib/format'
import { baseUnitLabels, cookingMethodLabels, perUnitLabel } from '../../lib/labels'
import { useSubmit } from '../../lib/use-submit'

export type FoodKind = 'food' | 'recipe'

type Props = { open: boolean; kind: FoodKind; food?: Food; onClose: () => void }

export function FoodFormDialog({ open, kind, food, onClose }: Props) {
  const formId = useId()
  const [busy, setBusy] = useState(false)
  const recipe = kind === 'recipe'
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size={recipe ? 'lg' : 'md'}
      title={food ? (recipe ? 'Tarifi düzenle' : 'Besini düzenle') : recipe ? 'Yeni tarif / yemek' : 'Yeni besin'}
      description={
        recipe
          ? 'Malzemeleri ve pişmiş toplam ağırlığı girin; 100 g değerleri malzemelerden hesaplanır.'
          : 'Besin değerlerini 100 g veya 100 ml başına girin; değişimde 1 değişim başına.'
      }
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {food ? 'Kaydet' : recipe ? 'Tarif ekle' : 'Besin ekle'}
          </Button>
        </>
      }
    >
      {open && <FoodForm key={food?.id ?? kind} formId={formId} kind={kind} food={food} onBusyChange={setBusy} onSaved={onClose} />}
    </Dialog>
  )
}

function UsageWarning({ foodId }: { foodId: string }) {
  const usage = useRepositoryQuery((r) => r.foods.countPlansUsing(foodId), [foodId])
  if (!usage.data) return null
  return (
    <p role="note" className="mb-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      Bu besin {usage.data} planda kullanılıyor. Değerleri değiştirirseniz bu planların kalori ve makro toplamları da güncellenir.
    </p>
  )
}

type IngredientRow = { key: number; foodId: string; quantity: string }

function FoodForm({
  formId,
  kind,
  food,
  onBusyChange,
  onSaved,
}: {
  formId: string
  kind: FoodKind
  food?: Food
  onBusyChange: (busy: boolean) => void
  onSaved: () => void
}) {
  const repositories = useRepositories()
  const toast = useToast()
  const { errors, submit } = useSubmit()
  const recipe = kind === 'recipe'
  const catalog = useRepositoryQuery(
    async (r) => (recipe ? { foods: await r.foods.list({ includeArchived: true }), ingredients: await r.foods.listIngredients() } : null),
    [recipe],
  )
  const [values, setValues] = useState({
    name: food?.name ?? '',
    brand: food?.brand ?? '',
    baseUnit: food?.baseUnit ?? 'g',
    energyKcal: numberToText(food?.energyKcal),
    proteinG: numberToText(food?.proteinG),
    carbsG: numberToText(food?.carbsG),
    fatG: numberToText(food?.fatG),
    portionLabel: food?.portionLabel ?? '',
    portionAmount: numberToText(food?.portionAmount),
    source: food?.source ?? '',
    isSample: food?.isSample ?? false,
    cookingMethod: (food?.cookingMethod ?? '') as CookingMethod | '',
    recipeYieldG: numberToText(food?.recipeYieldG),
  })
  const [rows, setRows] = useState<IngredientRow[] | null>(null)
  const [nextKey, setNextKey] = useState(1)
  const set = (field: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value })
  const per = perUnitLabel(values.baseUnit)

  // Düzenlenen tarifin mevcut malzemeleri, katalog yüklenince bir kez forma alınır.
  const savedIngredients = catalog.data?.ingredients.filter((i) => i.recipeId === food?.id) ?? []
  const ingredientRows: IngredientRow[] = rows ?? savedIngredients.map((i, index) => ({ key: -index - 1, foodId: i.foodId, quantity: numberToText(i.quantity) }))
  const currentIngredientIds = new Set(savedIngredients.map((i) => i.foodId))
  const ingredientChoices = (catalog.data?.foods ?? []).filter((f) => f.id !== food?.id && recipeIngredientIssue(f, currentIngredientIds) === null)
  const foodsById = catalog.data ? resolveRecipeFoods(catalog.data.foods, catalog.data.ingredients) : new Map<string, Food>()

  const updateRow = (key: number, patch: Partial<IngredientRow>) => setRows(ingredientRows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const parsedIngredients = ingredientRows
    .map((r) => ({ foodId: r.foodId, quantity: parseNumber(r.quantity) }))
    .filter((i) => i.foodId !== '' && Number.isFinite(i.quantity) && i.quantity > 0)
  const rawWeight = ingredientsWeight(parsedIngredients)
  const yieldG = parseOptionalNumber(values.recipeYieldG)
  const preview =
    recipe && catalog.data && yieldG !== null && Number.isFinite(yieldG) && yieldG > 0
      ? resolveRecipeFoods(
          [...catalog.data.foods.filter((f) => f.id !== food?.id), { id: 'preview', energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, recipeYieldG: yieldG }],
          parsedIngredients.map((i) => ({ ...i, recipeId: 'preview' })),
        ).get('preview')!
      : null

  const macros = { proteinG: parseNumber(values.proteinG), carbsG: parseNumber(values.carbsG), fatG: parseNumber(values.fatG) }
  const macroEnergy = Object.values(macros).every((v) => Number.isFinite(v) && v >= 0) ? energyFromMacros(macros) : null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const incomplete = ingredientRows.some((r) => (r.foodId === '') !== (r.quantity.trim() === '') || (r.foodId !== '' && !(parseNumber(r.quantity) > 0)))
    if (recipe && incomplete) {
      toast.error('Her malzeme satırında besin ve sıfırdan büyük bir miktar olmalı (boş satırları kaldırın).')
      return
    }
    const input: FoodInput = {
      name: values.name,
      brand: emptyToNull(values.brand),
      baseUnit: recipe ? 'g' : values.baseUnit,
      // Tarifin değerleri malzemelerden hesaplanır; kayıttaki değerler kullanılmaz.
      energyKcal: recipe ? 0 : parseNumber(values.energyKcal),
      ...(recipe ? { proteinG: 0, carbsG: 0, fatG: 0 } : macros),
      portionLabel: emptyToNull(values.portionLabel),
      portionAmount: parseOptionalNumber(values.portionAmount),
      source: emptyToNull(values.source),
      isSample: values.isSample,
      cookingMethod: values.cookingMethod === '' ? null : values.cookingMethod,
      recipeYieldG: recipe ? (yieldG ?? Number.NaN) : null,
    }
    const ingredients: RecipeIngredientsInput = parsedIngredients
    onBusyChange(true)
    const ok = await submit(async () => {
      const saved = food ? await repositories.foods.update(food.id, input) : await repositories.foods.create(input)
      if (recipe) {
        try {
          await repositories.foods.setIngredients(saved.id, ingredients)
        } catch (error) {
          // Tarif kaydedildi ama malzemeler kaydedilemediyse kullanıcı düzenleyerek tamamlayabilir.
          throw new RepositoryError(error instanceof RepositoryError ? error.code : 'storage', `Tarif kaydedildi ancak malzemeler kaydedilemedi: ${errorMessage(error)}`, {
            fieldErrors: error instanceof RepositoryError ? { ...error.fieldErrors } : {},
          })
        }
      }
      return saved
    }, food ? (recipe ? 'Tarif güncellendi.' : 'Besin güncellendi.') : recipe ? 'Tarif eklendi.' : 'Besin eklendi.')
    onBusyChange(false)
    if (ok) onSaved()
  }

  return (
    <>
      {food && <UsageWarning foodId={food.id} />}
      <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField label={recipe ? 'Tarif / yemek adı' : 'Besin adı'} required autoComplete="off" value={values.name} error={errors.name} onChange={set('name')} />
        {recipe ? (
          <SelectField label="Pişirme yöntemi" value={values.cookingMethod} error={errors.cookingMethod} onChange={set('cookingMethod')}>
            <option value="">Belirtilmedi</option>
            {cookingMethodSchema.options.map((m) => (
              <option key={m} value={m}>
                {cookingMethodLabels[m]}
              </option>
            ))}
          </SelectField>
        ) : (
          <TextField label="Marka" hint="Paketli ürünler için" autoComplete="off" value={values.brand} error={errors.brand} onChange={set('brand')} />
        )}

        {recipe ? (
          <fieldset className="space-y-3 sm:col-span-2">
            <legend className="text-sm font-medium text-slate-700">Malzemeler</legend>
            {catalog.status === 'loading' && <p className="text-sm text-slate-500">Besinler yükleniyor…</p>}
            {ingredientRows.length === 0 && catalog.data && <p className="text-sm text-slate-500">Henüz malzeme yok. Malzemeleri çiğ (hazırlanmamış) miktarlarıyla ekleyin.</p>}
            {ingredientRows.map((row, index) => {
              const ingredient = foodsById.get(row.foodId)
              return (
                <div key={row.key} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
                  <SelectField label={`${index + 1}. malzeme`} value={row.foodId} onChange={(e) => updateRow(row.key, { foodId: e.target.value })}>
                    <option value="">Besin seçin</option>
                    {ingredient && !ingredientChoices.some((f) => f.id === ingredient.id) && <option value={ingredient.id}>{ingredient.name}</option>}
                    {ingredientChoices.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.archivedAt ? ' (arşivde)' : ''}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label={`Miktar (${ingredient?.baseUnit ?? 'g'})`}
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  />
                  <Button variant="ghost" size="md" aria-label={`${index + 1}. malzemeyi kaldır`} onClick={() => setRows(ingredientRows.filter((r) => r.key !== row.key))}>
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              )
            })}
            {errors.ingredients && <p className="text-xs text-red-600">{errors.ingredients}</p>}
            <Button
              size="sm"
              onClick={() => {
                setRows([...ingredientRows, { key: nextKey, foodId: '', quantity: '' }])
                setNextKey(nextKey + 1)
              }}
            >
              <Plus aria-hidden className="size-4" />
              Malzeme ekle
            </Button>
          </fieldset>
        ) : (
          <>
            <SelectField label="Temel birim" value={values.baseUnit} error={errors.baseUnit} onChange={(e) => setValues({ ...values, baseUnit: e.target.value as FoodInput['baseUnit'] })}>
              <option value="g">Gram (g) — katı besinler</option>
              <option value="ml">Mililitre (ml) — sıvılar</option>
              <option value="exchange">Değişim — ekmek, süt, et… değişimi</option>
            </SelectField>
            <SelectField label="Hazırlama yöntemi" value={values.cookingMethod} error={errors.cookingMethod} onChange={set('cookingMethod')}>
              <option value="">Belirtilmedi</option>
              {cookingMethodSchema.options.map((m) => (
                <option key={m} value={m}>
                  {cookingMethodLabels[m]}
                </option>
              ))}
            </SelectField>
            <TextField
              label={`Enerji (kcal, ${per})`}
              required
              inputMode="decimal"
              value={values.energyKcal}
              error={errors.energyKcal}
              hint={macroEnergy === null ? undefined : `Makrolardan hesaplanan (4/4/9): ${formatNumber(macroEnergy, 0)} kcal. Lif ve yuvarlama nedeniyle farklı olabilir.`}
              onChange={set('energyKcal')}
            />
            <TextField label={`Protein (g, ${per})`} required inputMode="decimal" value={values.proteinG} error={errors.proteinG} onChange={set('proteinG')} />
            <TextField label={`Karbonhidrat (g, ${per})`} required inputMode="decimal" value={values.carbsG} error={errors.carbsG} onChange={set('carbsG')} />
            <TextField label={`Yağ (g, ${per})`} required inputMode="decimal" value={values.fatG} error={errors.fatG} onChange={set('fatG')} />
          </>
        )}

        {recipe && (
          <>
            <TextField
              label="Pişmiş toplam ağırlık (g)"
              required
              inputMode="decimal"
              value={values.recipeYieldG}
              error={errors.recipeYieldG}
              hint={rawWeight > 0 ? `Çiğ malzeme toplamı: ${formatNumber(rawWeight, 0)} g. Pişirmede su kaybı veya kazancı olabilir; tartarak girin.` : undefined}
              onChange={set('recipeYieldG')}
            />
            <div className="rounded-md bg-slate-50 p-3 text-sm ring-1 ring-slate-100" aria-live="polite">
              <p className="text-xs font-medium text-slate-500">100 g tarif (hesaplanan)</p>
              {preview ? (
                <p className="mt-1 font-semibold text-slate-900 tabular-nums">
                  {formatNumber(preview.energyKcal, 0)} kcal · P {formatNumber(preview.proteinG)} · K {formatNumber(preview.carbsG)} · Y {formatNumber(preview.fatG)} g
                </p>
              ) : (
                <p className="mt-1 text-slate-500">Malzeme ve pişmiş ağırlığı girince görünür.</p>
              )}
            </div>
          </>
        )}
        {!recipe && <div className="hidden sm:block" />}
        <TextField label="Porsiyon adı" hint="Örn. 1 dilim, 1 kase" autoComplete="off" value={values.portionLabel} error={errors.portionLabel} onChange={set('portionLabel')} />
        <TextField
          label={`Porsiyon miktarı (${recipe ? 'g' : baseUnitLabels[values.baseUnit]})`}
          inputMode="decimal"
          value={values.portionAmount}
          error={errors.portionAmount}
          onChange={set('portionAmount')}
        />
        <div className="sm:col-span-2">
          <TextField
            label="Kaynak"
            hint={recipe ? 'Tarifin kaynağı (ör. kendi tarifim, kitap)' : 'Değerlerin alındığı kaynak (ör. ürün etiketi, besin veri tabanı)'}
            autoComplete="off"
            value={values.source}
            error={errors.source}
            onChange={set('source')}
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={values.isSample}
            onChange={(e) => setValues({ ...values, isSample: e.target.checked })}
            className="mt-0.5 size-4 rounded border-slate-300 accent-brand-700"
          />
          <span>
            Örnek veri – doğrulanmamış
            <span className="block text-xs text-slate-500">Değerleri doğrulanmış bir kaynaktan kontrol ettiyseniz işareti kaldırın.</span>
          </span>
        </label>
      </form>
    </>
  )
}
