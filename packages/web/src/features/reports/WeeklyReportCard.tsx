/**
 * Danışana gönderilen haftalık rapor görseli. Telefon ekranına göre dikey ve sabit genişliktedir;
 * `WeeklyReportDialog` bu öğeyi PNG'ye çevirir. Yalnızca statik içerik vardır (etkileşim, animasyon
 * yok); böylece ekrandaki önizleme ile indirilen görsel aynıdır.
 */
import type { DatedValue } from '@diyetgo/shared'
import { CalendarClock, MessageSquareQuote, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useId, type Ref } from 'react'
import { formatDate, formatNumber, formatShortDate, formatTime, formatWeekdayDate } from '../../lib/format'
import type { WeeklyReportData } from './weekly-report-data'

const INK = '#13301f'
const LIME = '#9ccc65'

/** `−1,2` / `+0,4` / `0` (gerçek eksi işaretiyle). */
function signed(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits))
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : '−'}${formatNumber(Math.abs(rounded), digits)}`
}

function TrendIcon({ value }: { value: number | null }) {
  if (value === null || Number(value.toFixed(1)) === 0) return <Minus aria-hidden className="size-4" />
  return value < 0 ? <TrendingDown aria-hidden className="size-4" /> : <TrendingUp aria-hidden className="size-4" />
}

function formatRange(start: string, end: string): string {
  const [sy, sm] = start.split('-')
  const [ey, em] = end.split('-')
  if (sy === ey && sm === em) return `${Number(start.slice(8))}–${formatDate(end)}`
  return `${formatShortDate(start)} – ${formatDate(end)}`
}

function ChangeChip({ value, unit, caption }: { value: number | null; unit: string; caption: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-emerald-900/5">
      <span className="flex size-7 items-center justify-center rounded-lg" style={{ background: INK, color: LIME }}>
        <TrendIcon value={value} />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-slate-900 tabular-nums">{value === null ? '—' : `${signed(value)} ${unit}`}</span>
        <span className="block text-[11px] text-slate-500">{caption}</span>
      </span>
    </div>
  )
}

/** Kart içindeki alanın genişliği (400 − kenar boşlukları); grafik bu alana tam oturur. */
const CHART = { width: 296, top: 30, right: 10, bottom: 22, left: 10 }

/** Statik alan grafiği (kilo ve vücut ölçüleri); son nokta vurgulanır, ilk ve son tarih alt eksende yazılıdır. */
function TrendChart({ points, unit, height = 136 }: { points: DatedValue[]; unit: string; height?: number }) {
  const gradientId = `trend-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const H = height
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, 1)
  const innerW = CHART.width - CHART.left - CHART.right
  const innerH = H - CHART.top - CHART.bottom
  const first = Date.parse(points[0]!.date)
  const last = Date.parse(points.at(-1)!.date)
  const x = (date: string) => CHART.left + ((Date.parse(date) - first) / Math.max(last - first, 1)) * innerW
  const y = (value: number) => CHART.top + (1 - (value - min + span * 0.15) / (span * 1.3)) * innerH
  const coords = points.map((p) => [x(p.date), y(p.value)] as const)
  const line = coords.map(([cx, cy], i) => `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)} ${cy.toFixed(1)}`).join(' ')
  const baseline = H - CHART.bottom
  const area = `${line} L${coords.at(-1)![0].toFixed(1)} ${baseline} L${coords[0]![0].toFixed(1)} ${baseline} Z`
  const [lx, ly] = coords.at(-1)!

  return (
    <svg viewBox={`0 0 ${CHART.width} ${H}`} width={CHART.width} height={H} aria-hidden className="block">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={LIME} stopOpacity="0.55" />
          <stop offset="1" stopColor={LIME} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={CHART.left} x2={CHART.width - CHART.right} y1={CHART.top + f * innerH} y2={CHART.top + f * innerH} stroke="#e2e8f0" strokeDasharray="3 4" />
      ))}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="#4d7c0f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([cx, cy], i) => (
        <circle key={points[i]!.date} cx={cx} cy={cy} r={i === coords.length - 1 ? 5 : 3} fill={i === coords.length - 1 ? INK : '#ffffff'} stroke="#4d7c0f" strokeWidth="2" />
      ))}
      {/* Etiket son noktanın üstünde durur; kenarlardan taşmaması için yatayda sınırlanır. */}
      <g transform={`translate(${Math.min(Math.max(lx, 30), CHART.width - 30)} ${Math.max(ly - 16, 13)})`}>
        <rect x="-28" y="-11" width="56" height="18" rx="9" fill={INK} />
        <text x="0" y="2" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#ffffff">
          {formatNumber(points.at(-1)!.value)} {unit}
        </text>
      </g>
      <text x={CHART.left} y={H - 6} fontSize="10" fill="#64748b">
        {formatShortDate(points[0]!.date)}
      </text>
      <text x={CHART.width - CHART.right} y={H - 6} fontSize="10" fill="#64748b" textAnchor="end">
        {formatShortDate(points.at(-1)!.date)}
      </text>
    </svg>
  )
}

export function WeeklyReportCard({ data, note, ref }: { data: WeeklyReportData; note: string; ref?: Ref<HTMLDivElement> }) {
  const { client, week, weight, chart, bodyMetrics, nextAppointment } = data
  return (
    <div ref={ref} className="w-[400px] shrink-0 bg-[#eef3ea] p-4">
      <article className="overflow-hidden rounded-[28px] bg-white text-slate-800 shadow-xl shadow-emerald-950/10">
        <header className="relative overflow-hidden px-6 pt-6 pb-7 text-white" style={{ background: `linear-gradient(135deg, ${INK} 0%, #1f4d32 100%)` }}>
          <span aria-hidden className="absolute -top-10 -right-8 size-36 rounded-full" style={{ background: LIME, opacity: 0.18 }} />
          <span aria-hidden className="absolute -bottom-12 right-16 size-24 rounded-full" style={{ background: LIME, opacity: 0.12 }} />
          <div className="relative flex items-center justify-between">
            <span className="flex items-center gap-2">
              <img src="/favicon.svg" alt="" className="size-8 rounded-[9px] ring-1 ring-white/15" />
              <span className="text-lg font-extrabold tracking-tight">
                diyet<span style={{ color: LIME }}>go</span>
              </span>
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/15">Haftalık rapor</span>
          </div>
          <p className="relative mt-5 text-2xl font-bold">Merhaba {client.firstName},</p>
          <p className="relative mt-1 text-sm text-white/75">{formatRange(week.start, week.end)} haftasının özeti</p>
        </header>

        <div className="-mt-4 space-y-4 px-5 pb-5">
          {weight ? (
            <section className="relative rounded-2xl p-4 shadow-sm ring-1 ring-emerald-900/5" style={{ background: 'linear-gradient(135deg, #f3f9ec 0%, #ffffff 70%)' }}>
              <div className="flex items-start justify-between">
                <span>
                  <span className="block text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Güncel kilo</span>
                  <span className="mt-0.5 block">
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums">{formatNumber(weight.current.value)}</span>
                    <span className="ml-1 text-base font-semibold text-slate-500">kg</span>
                  </span>
                </span>
                <span className="text-right text-[11px] text-slate-500">
                  Son ölçüm
                  <span className="block font-semibold text-slate-700">{formatDate(weight.current.date)}</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ChangeChip value={weight.changeSincePrevious} unit="kg" caption={weight.previous ? `${formatShortDate(weight.previous.date)} ölçümüne göre` : 'Önceki ölçüm yok'} />
                <ChangeChip value={weight.totalChange} unit="kg" caption={`${formatShortDate(weight.first.date)} başlangıcından`} />
              </div>
              {chart.length >= 2 && (
                <div className="mt-3">
                  <TrendChart points={chart} unit="kg" />
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 ring-1 ring-slate-100">Henüz kilo ölçümü yok.</section>
          )}

          {bodyMetrics.length > 0 && (
            <section className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Vücut ölçülerin</p>
              {bodyMetrics.map(({ key, label, unit, summary, chart: series }) => (
                <div key={key} className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    <span className="text-right">
                      <span className="text-lg font-bold text-slate-900 tabular-nums">{formatNumber(summary.current.value)}</span>
                      <span className="ml-0.5 text-xs font-medium text-slate-500">{unit}</span>
                      <span className="ml-2 text-[11px] font-semibold tabular-nums" style={{ color: '#4d7c0f' }}>
                        {summary.previous ? `${signed(summary.totalChange)} ${unit} toplam` : 'İlk ölçüm'}
                      </span>
                    </span>
                  </div>
                  {series.length >= 2 && (
                    <div className="-mx-3 mt-1 -mb-1">
                      <TrendChart points={series} unit={unit} height={96} />
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {nextAppointment && (
            <section className="flex items-center gap-3 rounded-2xl p-4 text-white" style={{ background: INK }}>
              <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: LIME, color: INK }}>
                <CalendarClock aria-hidden className="size-5" />
              </span>
              <span>
                <span className="block text-[11px] text-white/70">Sonraki randevun</span>
                <span className="block text-sm font-semibold">
                  {formatWeekdayDate(nextAppointment.startsAt)} · {formatTime(nextAppointment.startsAt)}
                </span>
              </span>
            </section>
          )}

          {note.trim() && (
            <section className="rounded-2xl border-l-4 bg-lime-50 p-4" style={{ borderColor: LIME }}>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <MessageSquareQuote aria-hidden className="size-3.5" />
                Diyetisyeninden not
              </span>
              <p className="mt-1.5 text-sm whitespace-pre-line text-slate-800">{note.trim()}</p>
            </section>
          )}

          <p className="pt-1 text-center text-[10px] leading-relaxed text-slate-500">
            Bu rapor bilgi amaçlıdır; teşhis veya tedavi önerisi değildir.
            <br />
            diyetgo ile hazırlandı
          </p>
        </div>
      </article>
    </div>
  )
}
