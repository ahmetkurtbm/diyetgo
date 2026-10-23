import type { ClientGoal, Nutrients } from '@diyetgo/shared'
import { formatNumber } from '../../lib/format'

const metrics = [
  { key: 'energyKcal', label: 'Enerji', unit: 'kcal', digits: 0 },
  { key: 'proteinG', label: 'Protein', unit: 'g', digits: 1 },
  { key: 'carbsG', label: 'Karbonhidrat', unit: 'g', digits: 1 },
  { key: 'fatG', label: 'Yağ', unit: 'g', digits: 1 },
] as const

/** Kompakt öğün toplamı: `520 kcal · P 25 · K 60 · Y 18 g` */
export function NutrientLine({ totals }: { totals: Nutrients }) {
  return (
    <span className="text-xs text-slate-600 tabular-nums">
      {formatNumber(totals.energyKcal, 0)} kcal · P {formatNumber(totals.proteinG)} · K {formatNumber(totals.carbsG)} · Y {formatNumber(totals.fatG)} g
    </span>
  )
}

/** Günlük toplam; aktif hedef varsa hedefe oranı gösterir. */
export function NutrientSummary({ totals, goal }: { totals: Nutrients; goal?: ClientGoal }) {
  return (
    <div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map(({ key, label, unit, digits }) => {
          const target = goal?.[key]
          const ratio = target ? totals[key] / target : null
          return (
            <div key={key}>
              <dt className="text-xs font-medium text-slate-500">{label}</dt>
              <dd className="mt-1">
                <span className="text-lg font-semibold text-slate-900 tabular-nums">{formatNumber(totals[key], digits)}</span>{' '}
                <span className="text-xs text-slate-500">{unit}</span>
                {target !== undefined && ratio !== null && (
                  <>
                    <span className="block text-xs text-slate-500 tabular-nums">
                      Hedef {formatNumber(target, digits)} {unit} · %{formatNumber(ratio * 100, 0)}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <span className={`block h-full rounded-full ${ratio > 1.1 ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
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
