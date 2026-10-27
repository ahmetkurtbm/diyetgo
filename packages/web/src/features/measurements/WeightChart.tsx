import { daysBetween } from '@diyetgo/shared'
import { ChartLine } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { formatDate, formatNumber, formatShortDate } from '../../lib/format'

type Point = { date: string; value: number }

const DEFAULT_WIDTH = 640
const MIN_WIDTH = 280
const HEIGHT = 220
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

const signed = (value: number) => `${value > 0 ? '+' : ''}${formatNumber(value)}`

/**
 * Kilo değişimi için hafif SVG çizgi grafik; ek kütüphane gerektirmez. Grafik kabın genişliğinde
 * çizilir (yazılar mobilde küçülmez). Noktalar fareyle ve klavyeyle (Tab) değer ipucu gösterir.
 */
export function WeightChart({ points }: { points: Point[] }) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted.at(-1)
  const hasChart = sorted.length >= 2
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId()

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setWidth(Math.max(MIN_WIDTH, Math.round(entry.contentRect.width)))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [hasChart])

  if (!first || !last || !hasChart) {
    return (
      <div className="mx-5 my-4 flex items-start gap-3 rounded-md border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
        <ChartLine aria-hidden className="mt-0.5 size-5 shrink-0 text-slate-400" />
        <div>
          <p>{first ? 'Grafik için en az iki kilo ölçümü gerekir.' : 'Grafik için henüz kilo ölçümü yok.'}</p>
          {first && (
            <p className="mt-0.5 text-xs">
              Son kilo: {formatNumber(first.value)} kg ({formatDate(first.date)})
            </p>
          )}
        </div>
      </div>
    )
  }

  const values = sorted.map((p) => p.value)
  const spread = Math.max(...values) - Math.min(...values)
  const min = Math.floor(Math.min(...values) - Math.max(1, spread * 0.15))
  const max = Math.ceil(Math.max(...values) + Math.max(1, spread * 0.15))
  const totalDays = Math.max(1, daysBetween(first.date, last.date))
  const x = (date: string) => PAD.left + (daysBetween(first.date, date) / totalDays) * (width - PAD.left - PAD.right)
  const y = (value: number) => PAD.top + ((max - value) / (max - min)) * (HEIGHT - PAD.top - PAD.bottom)
  const baseline = HEIGHT - PAD.bottom
  const ticks = [min, (min + max) / 2, max]
  const change = last.value - first.value
  const summary = `Kilo değişimi: ${formatNumber(first.value)} kg (${formatDate(first.date)}) → ${formatNumber(last.value)} kg (${formatDate(last.date)}), ${signed(change)} kg`
  const line = sorted.map((p) => `${x(p.date)},${y(p.value)}`).join(' L ')
  const area = `M ${x(first.date)},${baseline} L ${line} L ${x(last.date)},${baseline} Z`

  const activePoint = active === null ? null : sorted[active]
  const previous = active === null || active === 0 ? null : sorted[active - 1]
  const tooltipX = activePoint ? x(activePoint.date) : 0
  // İpucu kenarlara yakınken grafiğin dışına taşmaması için hizası değişir.
  const tooltipShift = tooltipX < 80 ? '0%' : tooltipX > width - 80 ? '-100%' : '-50%'

  return (
    <figure className="px-3 pt-4 pb-2 sm:px-5">
      <div ref={containerRef} className="relative">
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="group" aria-label={summary} className="block h-auto max-w-full overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-brand-600)', stopOpacity: 0.18 }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-brand-600)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {ticks.map((tick) => (
            <g key={tick} aria-hidden>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-slate-200" strokeDasharray="4 4" />
              <text x={PAD.left - 8} y={y(tick)} dy="0.35em" textAnchor="end" className="fill-slate-500 text-[11px]">
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          <text x={PAD.left - 8} y={PAD.top - 6} textAnchor="end" className="fill-slate-500 text-[10px]" aria-hidden>
            kg
          </text>
          <path d={area} fill={`url(#${gradientId})`} aria-hidden />
          <path d={`M ${line}`} fill="none" className="stroke-brand-600" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" aria-hidden />
          {activePoint && (
            <line x1={tooltipX} x2={tooltipX} y1={PAD.top} y2={baseline} className="stroke-slate-300" strokeDasharray="3 3" aria-hidden />
          )}
          {sorted.map((p, i) => (
            <g key={`${p.date}-${i}`}>
              <circle cx={x(p.date)} cy={y(p.value)} r={active === i ? 6 : 4} className="pointer-events-none fill-white stroke-brand-700" strokeWidth={2} />
              {/* Daha geniş, görünmez dokunma ve odak alanı. */}
              <circle
                cx={x(p.date)}
                cy={y(p.value)}
                r={14}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${formatDate(p.date)}: ${formatNumber(p.value)} kg`}
                className="cursor-pointer focus:outline-none focus-visible:stroke-brand-600 focus-visible:stroke-2"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 6} className="fill-slate-500 text-[11px]" aria-hidden>
            {formatShortDate(first.date)}
          </text>
          <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-slate-500 text-[11px]" aria-hidden>
            {formatShortDate(last.date)}
          </text>
        </svg>
        {activePoint && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 rounded-md border border-slate-200 bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
            style={{ left: tooltipX, top: y(activePoint.value) - 12, transform: `translate(${tooltipShift}, -100%)` }}
          >
            <p className="font-semibold text-slate-900 tabular-nums">{formatNumber(activePoint.value)} kg</p>
            <p className="text-slate-500">{formatDate(activePoint.date)}</p>
            {previous && <p className="text-slate-500 tabular-nums">Önceki ölçüme göre {signed(activePoint.value - previous.value)} kg</p>}
          </div>
        )}
      </div>
      <figcaption className="mt-1 text-xs text-slate-500">{summary}</figcaption>
    </figure>
  )
}
