import { energyFromMacros, macroGramsFromShares, MIN_ADULT_AGE, type Client, type ClientGoal } from '@diyetgo/shared'
import { useId, useState, type FormEvent } from 'react'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField, TextareaField, TextField } from '../../components/ui/form'
import { formatDate, formatNumber, today } from '../../lib/format'
import { emptyToNull, numberToText as toText, parseNumber } from '../../lib/forms'
import { goalMethodLabels, sexLabels } from '../../lib/labels'
import { useSubmit } from '../../lib/use-submit'
import { estimateEnergy } from './energy-estimate'

type Props = { open: boolean; client: Client; goal?: ClientGoal; onClose: () => void }

/** Yaygın kullanılan etkinlik katsayıları (PAL). */
const activityFactors = [
  [1.2, 'Hareketsiz'],
  [1.375, 'Hafif etkin'],
  [1.55, 'Orta düzeyde etkin'],
  [1.725, 'Çok etkin'],
  [1.9, 'Aşırı etkin'],
] as const

export function GoalFormDialog({ open, client, goal, onClose }: Props) {
  const formId = useId()
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={goal ? 'Hedefi düzenle' : 'Yeni hedef'}
      description={
        goal
          ? 'Hedef dönemleri çakışamaz; başlangıç ve bitiş günleri döneme dahildir.'
          : 'Açık uçlu önceki hedef, yeni hedefin başlangıcından bir gün önce kapatılır. Hedef dönemleri çakışamaz.'
      }
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {goal ? 'Kaydet' : 'Hedef ekle'}
          </Button>
        </>
      }
    >
      <GoalForm formId={formId} client={client} goal={goal} onBusyChange={setBusy} onSaved={onClose} />
    </Dialog>
  )
}

function GoalForm({
  formId,
  client,
  goal,
  onBusyChange,
  onSaved,
}: {
  formId: string
  client: Client
  goal?: ClientGoal
  onBusyChange: (busy: boolean) => void
  onSaved: () => void
}) {
  const repositories = useRepositories()
  const measurements = useRepositoryQuery((r) => r.measurements.listByClient(client.id), [client.id])
  const { errors, submit } = useSubmit()
  const [values, setValues] = useState({
    validFrom: goal?.validFrom ?? today(),
    validTo: goal?.validTo ?? '',
    method: goal?.method ?? ('manual' as ClientGoal['method']),
    activityFactor: String(goal?.activityFactor ?? 1.375),
    energyKcal: toText(goal?.energyKcal),
    proteinG: toText(goal?.proteinG),
    carbsG: toText(goal?.carbsG),
    fatG: toText(goal?.fatG),
    notes: goal?.notes ?? '',
  })
  const [shares, setShares] = useState({ proteinPct: '20', carbsPct: '50', fatPct: '30' })
  const [sharesError, setSharesError] = useState<string>()
  const [methodError, setMethodError] = useState<string>()
  const set = (field: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value })

  const calculated = values.method === 'mifflin_st_jeor'
  const factors: readonly (readonly [number, string])[] = activityFactors.some(([f]) => String(f) === values.activityFactor)
    ? activityFactors
    : [[Number(values.activityFactor), 'Kayıtlı değer'], ...activityFactors]
  const estimate = calculated && measurements.data ? estimateEnergy(client, measurements.data, values.validFrom, Number(values.activityFactor)) : null

  const macros = { proteinG: parseNumber(values.proteinG), carbsG: parseNumber(values.carbsG), fatG: parseNumber(values.fatG) }
  const macrosValid = Object.values(macros).every((v) => Number.isFinite(v) && v >= 0)
  const macroEnergy = macrosValid ? energyFromMacros(macros) : null

  function applyShares() {
    const energy = parseNumber(values.energyKcal)
    const pct = { proteinPct: parseNumber(shares.proteinPct), carbsPct: parseNumber(shares.carbsPct), fatPct: parseNumber(shares.fatPct) }
    if (!Number.isFinite(energy) || energy <= 0) return setSharesError('Önce enerji hedefini girin.')
    if (!Object.values(pct).every((v) => Number.isFinite(v) && v >= 0) || Math.abs(pct.proteinPct + pct.carbsPct + pct.fatPct - 100) > 1e-9) {
      return setSharesError('Yüzdelerin toplamı 100 olmalı.')
    }
    setSharesError(undefined)
    const grams = macroGramsFromShares(energy, pct)
    setValues({ ...values, proteinG: toText(Math.round(grams.proteinG)), carbsG: toText(Math.round(grams.carbsG)), fatG: toText(Math.round(grams.fatG)) })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (calculated && estimate && !estimate.ok) {
      setMethodError('Hesaplama için gerekli bilgiler eksik; elle girişi seçin veya danışan bilgilerini tamamlayın.')
      return
    }
    setMethodError(undefined)
    const input = {
      clientId: client.id,
      validFrom: values.validFrom,
      validTo: emptyToNull(values.validTo),
      energyKcal: parseNumber(values.energyKcal),
      ...macros,
      method: values.method,
      activityFactor: calculated ? Number(values.activityFactor) : null,
      notes: emptyToNull(values.notes),
    }
    onBusyChange(true)
    const ok = goal
      ? await submit(() => repositories.goals.update(goal.id, input), 'Hedef güncellendi.')
      : await submit(
          () => repositories.goals.create(input),
          ({ closed }) => (closed?.validTo ? `Hedef eklendi. Önceki hedef ${formatDate(closed.validTo)} tarihinde sona erecek şekilde kapatıldı.` : 'Hedef eklendi.'),
        )
    onBusyChange(false)
    if (ok) onSaved()
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <TextField label="Başlangıç tarihi" type="date" required value={values.validFrom} error={errors.validFrom} onChange={set('validFrom')} />
      <TextField label="Bitiş tarihi" type="date" hint="Boş bırakılırsa hedef açık uçludur." value={values.validTo} error={errors.validTo} onChange={set('validTo')} />

      <div className="sm:col-span-2">
        <SelectField label="Yöntem" value={values.method} error={methodError} onChange={set('method')}>
          <option value="manual">{goalMethodLabels.manual} (elle giriş)</option>
          <option value="mifflin_st_jeor">{goalMethodLabels.mifflin_st_jeor} ile hesapla</option>
        </SelectField>
      </div>

      {calculated && (
        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
          <SelectField label="Etkinlik katsayısı" value={values.activityFactor} error={errors.activityFactor} onChange={set('activityFactor')}>
            {factors.map(([factor, label]) => (
              <option key={factor} value={String(factor)}>
                {formatNumber(factor, 3)} – {label}
              </option>
            ))}
          </SelectField>
          {estimate === null && <p className="text-sm text-slate-500">Ölçümler yükleniyor…</p>}
          {estimate?.ok === false && (
            <div className="text-sm text-amber-900">
              <p className="font-medium">Hesaplama yapılamıyor:</p>
              <ul className="mt-1 list-disc pl-5">
                {estimate.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {estimate?.ok && (
            <div className="space-y-2 text-sm text-slate-700" data-testid="energy-estimate">
              <p className="text-xs text-slate-500">
                Kullanılan veriler: {sexLabels[estimate.sex]}, {estimate.ageYears} yaş (başlangıç tarihine göre), {formatNumber(estimate.weight.value)} kg (
                {formatDate(estimate.weight.measuredOn)}), {formatNumber(estimate.height.value)} cm ({formatDate(estimate.height.measuredOn)})
              </p>
              <p>
                Bazal metabolizma (BMR): <strong className="tabular-nums">{formatNumber(estimate.bmrKcal, 0)} kcal/gün</strong>
              </p>
              <p>
                Tahmini günlük enerji (BMR × {formatNumber(Number(values.activityFactor), 3)}):{' '}
                <strong className="tabular-nums">{formatNumber(estimate.energyKcal, 0)} kcal/gün</strong>
              </p>
              <Button size="sm" onClick={() => setValues({ ...values, energyKcal: toText(Math.round(estimate.energyKcal)) })}>
                Enerji hedefine aktar
              </Button>
              <p className="text-xs text-slate-500">
                BMR = 10 × kilo + 6,25 × boy − 5 × yaş {estimate.sex === 'male' ? '+ 5' : '− 161'}. Yalnızca {MIN_ADULT_AGE} yaş ve üzeri yetişkinler için kullanılır. Hedefi
                aktardıktan sonra danışana göre değiştirebilirsiniz.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="sm:col-span-2">
        <TextField label="Enerji hedefi (kcal/gün)" required inputMode="decimal" autoComplete="off" value={values.energyKcal} error={errors.energyKcal} onChange={set('energyKcal')} />
      </div>

      <fieldset className="space-y-3 rounded-md border border-slate-200 p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-medium text-slate-700">Yüzdeye göre dağıt (isteğe bağlı)</legend>
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Protein %" inputMode="decimal" value={shares.proteinPct} onChange={(e) => setShares({ ...shares, proteinPct: e.target.value })} />
          <TextField label="Karbonhidrat %" inputMode="decimal" value={shares.carbsPct} onChange={(e) => setShares({ ...shares, carbsPct: e.target.value })} />
          <TextField label="Yağ %" inputMode="decimal" value={shares.fatPct} onChange={(e) => setShares({ ...shares, fatPct: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={applyShares}>
            Gramları hesapla
          </Button>
          {sharesError && <p className="text-xs text-red-600">{sharesError}</p>}
        </div>
        <p className="text-xs text-slate-500">Protein ve karbonhidrat 4, yağ 9 kcal/g kabul edilir.</p>
      </fieldset>

      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <TextField label="Protein (g)" required inputMode="decimal" autoComplete="off" value={values.proteinG} error={errors.proteinG} onChange={set('proteinG')} />
        <TextField label="Karbonhidrat (g)" required inputMode="decimal" autoComplete="off" value={values.carbsG} error={errors.carbsG} onChange={set('carbsG')} />
        <TextField label="Yağ (g)" required inputMode="decimal" autoComplete="off" value={values.fatG} error={errors.fatG} onChange={set('fatG')} />
      </div>
      {macroEnergy !== null && macroEnergy > 0 && (
        <p className="text-xs text-slate-600 tabular-nums sm:col-span-2" data-testid="macro-energy">
          Makrolardan hesaplanan enerji: {formatNumber(macroEnergy, 0)} kcal · P %{formatNumber((4 * macros.proteinG * 100) / macroEnergy, 0)} · K %
          {formatNumber((4 * macros.carbsG * 100) / macroEnergy, 0)} · Y %{formatNumber((9 * macros.fatG * 100) / macroEnergy, 0)}
        </p>
      )}

      <div className="sm:col-span-2">
        <TextareaField label="Notlar" value={values.notes} error={errors.notes} onChange={set('notes')} />
      </div>
    </form>
  )
}
