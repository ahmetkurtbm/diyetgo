import { energyFromMacros, type Food, type FoodInput } from '@diyetgo/shared'
import { AlertTriangle } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField, TextField } from '../../components/ui/form'
import { emptyToNull, numberToText, parseNumber, parseOptionalNumber } from '../../lib/forms'
import { formatNumber } from '../../lib/format'
import { useSubmit } from '../../lib/use-submit'

type Props = { open: boolean; food?: Food; onClose: () => void }

export function FoodFormDialog({ open, food, onClose }: Props) {
  const formId = useId()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={food ? 'Besini düzenle' : 'Yeni besin'}
      description="Besin değerlerini 100 g veya 100 ml başına girin."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {food ? 'Kaydet' : 'Besin ekle'}
          </Button>
        </>
      }
    >
      <FoodForm formId={formId} food={food} onBusyChange={setBusy} onSaved={onClose} />
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

function FoodForm({ formId, food, onBusyChange, onSaved }: { formId: string; food?: Food; onBusyChange: (busy: boolean) => void; onSaved: () => void }) {
  const repositories = useRepositories()
  const { errors, submit } = useSubmit()
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
  })
  const set = (field: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value })
  const per = `100 ${values.baseUnit} başına`

  const macros = { proteinG: parseNumber(values.proteinG), carbsG: parseNumber(values.carbsG), fatG: parseNumber(values.fatG) }
  const macroEnergy = Object.values(macros).every((v) => Number.isFinite(v) && v >= 0) ? energyFromMacros(macros) : null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input: FoodInput = {
      name: values.name,
      brand: emptyToNull(values.brand),
      baseUnit: values.baseUnit,
      energyKcal: parseNumber(values.energyKcal),
      ...macros,
      portionLabel: emptyToNull(values.portionLabel),
      portionAmount: parseOptionalNumber(values.portionAmount),
      source: emptyToNull(values.source),
      isSample: values.isSample,
    }
    onBusyChange(true)
    const ok = await submit(() => (food ? repositories.foods.update(food.id, input) : repositories.foods.create(input)), food ? 'Besin güncellendi.' : 'Besin eklendi.')
    onBusyChange(false)
    if (ok) onSaved()
  }

  return (
    <>
      {food && <UsageWarning foodId={food.id} />}
      <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField label="Besin adı" required autoComplete="off" value={values.name} error={errors.name} onChange={set('name')} />
        <TextField label="Marka" hint="Paketli ürünler için" autoComplete="off" value={values.brand} error={errors.brand} onChange={set('brand')} />
        <SelectField label="Temel birim" value={values.baseUnit} error={errors.baseUnit} onChange={(e) => setValues({ ...values, baseUnit: e.target.value as FoodInput['baseUnit'] })}>
          <option value="g">Gram (g) — katı besinler</option>
          <option value="ml">Mililitre (ml) — sıvılar</option>
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
        <div className="hidden sm:block" />
        <TextField label="Porsiyon adı" hint="Örn. 1 dilim, 1 kase" autoComplete="off" value={values.portionLabel} error={errors.portionLabel} onChange={set('portionLabel')} />
        <TextField
          label={`Porsiyon miktarı (${values.baseUnit})`}
          inputMode="decimal"
          value={values.portionAmount}
          error={errors.portionAmount}
          onChange={set('portionAmount')}
        />
        <div className="sm:col-span-2">
          <TextField label="Kaynak" hint="Değerlerin alındığı kaynak (ör. ürün etiketi, besin veri tabanı)" autoComplete="off" value={values.source} error={errors.source} onChange={set('source')} />
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
