/**
 * Öğün içeriğini serbest metinle ekleme: diyetisyen "8 yemek kaşığı pirinç pilavı" gibi satırlar yazar,
 * sistem besini ve miktarı önerir (bkz. `parseMealText`), diyetisyen önizlemede düzeltip onaylar.
 */
import { nutrientsFor, parseMealText, sumNutrients, type Food, type PlanMeal } from '@diyetgo/shared'
import { useId, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { TextareaField } from '../../components/ui/form'
import { useToast } from '../../components/ui/toast-context'
import { useRepositories } from '../../data/context'
import { errorMessage } from '../../lib/errors'
import { numberToText, parseNumber } from '../../lib/forms'
import { NutrientLine } from './NutrientSummary'

type Row = { text: string; foodId: string; amount: string }

type Props = { open: boolean; meal: PlanMeal; title: string; sortOrder: number; foods: Food[]; onClose: () => void }

export function MealTextDialog({ open, meal, title, sortOrder, foods, onClose }: Props) {
  const repositories = useRepositories()
  const toast = useToast()
  const formId = useId()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)

  const resolved = (rows ?? []).map((row) => {
    const food = foods.find((f) => f.id === row.foodId)
    const amount = parseNumber(row.amount)
    const valid = food !== undefined && Number.isFinite(amount) && amount > 0
    return { row, food, amount, valid }
  })
  const ready = resolved.filter((r) => r.valid)
  const total = sumNutrients(ready.map((r) => nutrientsFor(r.food!, r.amount)))

  function close() {
    setText('')
    setRows(null)
    onClose()
  }

  function analyze() {
    setRows(parseMealText(text, foods).map((l) => ({ text: l.text, foodId: l.food?.id ?? '', amount: l.amount === null ? '' : numberToText(l.amount) })))
  }

  const update = (index: number, patch: Partial<Row>) => setRows((current) => current!.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  async function add() {
    setBusy(true)
    try {
      for (const [i, r] of ready.entries()) {
        await repositories.mealPlans.addItem({ planMealId: meal.id, foodId: r.food!.id, quantity: r.amount, sortOrder: sortOrder + i, notes: r.row.text })
      }
      toast.success(`${ready.length} besin ${title} öğününe eklendi.`)
      close()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title="Metinden besin ekle"
      description="Her satıra bir besin yazın; miktar ve ölçü (yemek kaşığı, kase, adet…) otomatik grama çevrilir. Önerileri kontrol edip düzeltebilirsiniz."
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            Vazgeç
          </Button>
          {rows === null ? (
            <Button type="submit" form={formId} variant="primary" disabled={text.trim() === ''}>
              Çözümle
            </Button>
          ) : (
            <Button variant="primary" disabled={busy || ready.length === 0} onClick={() => void add()}>
              {ready.length} besini öğüne ekle
            </Button>
          )}
        </>
      }
    >
      {rows === null ? (
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault()
            analyze()
          }}
        >
          <TextareaField
            label="Öğün içeriği"
            rows={6}
            placeholder={'7-8 yemek kaşığı tavuk sote\n8 yemek kaşığı pirinç pilavı\n1 küçük kase yağsız salata\n4 yemek kaşığı yoğurt'}
            hint="Aralık (7-8) yazılırsa ortalaması alınır. Ölçüler yaklaşıktır."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </form>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-3" aria-label="Çözümlenen satırlar">
            {resolved.map(({ row, food, amount, valid }, i) => (
              <li key={i} className={`rounded-lg p-3 ring-1 ${row.foodId ? 'bg-slate-50 ring-slate-200' : 'bg-red-50 ring-red-200'}`}>
                <p className="mb-2 text-sm font-medium text-slate-900">“{row.text}”</p>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <label className="text-xs text-slate-600">
                    Besin
                    <select
                      aria-label={`${row.text} besini`}
                      value={row.foodId}
                      onChange={(e) => update(i, { foodId: e.target.value })}
                      className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
                    >
                      <option value="">Besin bulunamadı – listeden seçin</option>
                      {foods.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-600">
                    Miktar ({food?.baseUnit ?? 'g'})
                    <input
                      aria-label={`${row.text} miktarı`}
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(e) => update(i, { amount: e.target.value })}
                      className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-right text-sm tabular-nums"
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {valid ? <NutrientLine totals={nutrientsFor(food!, amount)} /> : food ? 'Miktarı girin; bu ölçünün gramı bilinmiyor.' : 'Bu satır eklenmeyecek.'}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-700">
            Toplam ({ready.length}/{resolved.length} satır): <NutrientLine totals={total} />
          </p>
          <p className="text-xs text-slate-500">Ölçülerin gram karşılığı ve yemek değerleri yaklaşıktır. Besinin kendi porsiyonu yoksa varsayılanlar kullanılır (ör. 1 yemek kaşığı ≈ 15 g, 1 kase ≈ 200 g).</p>
          <Button size="sm" variant="ghost" onClick={() => setRows(null)}>
            Metni düzenle
          </Button>
        </div>
      )}
    </Dialog>
  )
}
