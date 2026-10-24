import type { ClientGoal, Nutrients } from '@diyetgo/shared'
import { AnimatedBar } from '../../components/ui/motion'
import { formatNumber } from '../../lib/format'

/** Her makronun rengi `index.css` içindeki `--color-macro-*` token'larındandır. */
const metrics = [
  { key: 'energyKcal', label: 'Enerji', unit: 'kcal', digits: 0, dot: 'bg-macro-energy', bar: 'bg-macro-energy' },
  { key: 'proteinG', label: 'Protein', unit: 'g', digits: 1, dot: 'bg-macro-protein', bar: 'bg-macro-protein' },
  { key: 'carbsG', label: 'Karbonhidrat', unit: 'g', digits: 1, dot: 'bg-macro-carbs', bar: 'bg-macro-carbs' },
  { key: 'fatG', label: 'Yağ', unit: 'g', digits: 1, dot: 'bg-macro-fat', bar: 'bg-macro-fat' },
] as const

/** Kompakt öğün toplamı: `520 kcal · P 25 · K 60 · Y 18 g` */
export function NutrientLine({ totals }: { totals: Nutrients }) {
  return (
    <span className="text-xs text-slate-600 tabular-nums">
      {formatNumber(totals.energyKcal, 0)} kcal · <span className="font-semibold text-sky-700">P</span> {formatNumber(totals.proteinG)} ·{' '}
      <span className="font-semibold text-violet-700">K</span> {formatNumber(totals.carbsG)} · <span className="font-semibold text-rose-700">Y</span>{' '}
      {formatNumber(totals.fatG)} g
    </span>
  )
}

/** Günlük toplam; aktif hedef varsa hedefe oranı gösterir. */
export function NutrientSummary({ totals, goal }: { totals: Nutrients; goal?: ClientGoal }) {
  return (
    <div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map(({ key, label, unit, digits, dot, bar }) => {
          const target = goal?.[key]
          const ratio = target ? totals[key] / target : null
          const over = ratio !== null && ratio > 1.1
          return (
            <div key={key} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span aria-hidden className={`size-2 rounded-full ${dot}`} />
                {label}
              </dt>
              <dd className="mt-1">
                <span className="text-lg font-semibold text-slate-900 tabular-nums">{formatNumber(totals[key], digits)}</span>{' '}
                <span className="text-xs text-slate-500">{unit}</span>
                {target !== undefined && ratio !== null && (
                  <>
                    <span className="block text-xs text-slate-500 tabular-nums">
                      Hedef {formatNumber(target, digits)} {unit} ·{' '}
                      <span className={over ? 'font-semibold text-amber-800' : undefined}>%{formatNumber(ratio * 100, 0)}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200/70" aria-hidden>
                      <AnimatedBar percent={ratio * 100} className={over ? 'bg-macro-over' : bar} />
                    </span>
                  </>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        {goal ? 'Hedefle karşılaştırma bilgi amaçlıdır; teşhis veya tedavi önerisi değildir.' : 'Bu gün için tanımlı bir hedef yok.'} Toplamlar besin değerlerinden canlı hesaplanır.
      </p>
    </div>
  )
}
