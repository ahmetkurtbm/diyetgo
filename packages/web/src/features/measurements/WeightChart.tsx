import { daysBetween } from '@diyetgo/shared'
import { formatDate, formatNumber, formatShortDate } from '../../lib/format'

type Point = { date: string; value: number }

const WIDTH = 640
const HEIGHT = 220
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

/** Kilo değişimi için hafif SVG çizgi grafik; ek kütüphane gerektirmez. */
export function WeightChart({ points }: { points: Point[] }) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted.at(-1)
  if (!first || !last || sorted.length < 2) {
    return <p className="px-5 py-6 text-sm text-slate-500">Grafik için en az iki kilo ölçümü gerekir.</p>
  }

  const values = sorted.map((p) => p.value)
  const spread = Math.max(...values) - Math.min(...values)
  const min = Math.floor(Math.min(...values) - Math.max(1, spread * 0.15))
  const max = Math.ceil(Math.max(...values) + Math.max(1, spread * 0.15))
  const totalDays = Math.max(1, daysBetween(first.date, last.date))
  const x = (date: string) => PAD.left + (daysBetween(first.date, date) / totalDays) * (WIDTH - PAD.left - PAD.right)
  const y = (value: number) => PAD.top + ((max - value) / (max - min)) * (HEIGHT - PAD.top - PAD.bottom)
  const ticks = [min, (min + max) / 2, max]
  const change = last.value - first.value
  const summary = `Kilo değişimi: ${formatNumber(first.value)} kg (${formatDate(first.date)}) → ${formatNumber(last.value)} kg (${formatDate(last.date)}), ${change >= 0 ? '+' : ''}${formatNumber(change)} kg`

  return (
    <figure className="px-3 pt-4 pb-2 sm:px-5">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={summary} className="h-auto w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-slate-200" strokeDasharray="4 4" />
            <text x={PAD.left - 8} y={y(tick)} dy="0.35em" textAnchor="end" className="fill-slate-400 text-[11px]">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        <polyline
          points={sorted.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')}
          fill="none"
          className="stroke-brand-600"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {sorted.map((p, i) => (
          <circle key={`${p.date}-${i}`} cx={x(p.date)} cy={y(p.value)} r={4} className="fill-white stroke-brand-700" strokeWidth={2}>
            <title>{`${formatDate(p.date)}: ${formatNumber(p.value)} kg`}</title>
          </circle>
        ))}
        <text x={PAD.left} y={HEIGHT - 6} className="fill-slate-400 text-[11px]">
          {formatShortDate(first.date)}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-slate-400 text-[11px]">
          {formatShortDate(last.date)}
        </text>
      </svg>
      <figcaption className="mt-1 text-xs text-slate-500">{summary}</figcaption>
    </figure>
  )
}
