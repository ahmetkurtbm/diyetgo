/**
 * Serbest menünün PDF/önizleme görünümü: A4 genişliğinde, pembe tonlu ve çiçek süslü belge.
 * Boyutlar piksel olarak sabittir (A4 = 794 px genişlik) ki PDF çıktısı ekrana göre değişmesin.
 * `data-pdf-block` işaretli öğeler sayfa kesilirken bölünmez (bkz. `pageCuts`).
 */
import type { PlanDocument } from '@diyetgo/shared'
import { forwardRef } from 'react'
import { decorationDataUrl, PAGE_PX, SIDE_PX } from '../../lib/plan-decor'

const INK = '#4a1d33'
const ROSE = '#be185d'
const SOFT = '#fdf2f8'
const LINE = '#fbcfe8'

type Props = {
  doc: PlanDocument
  /** `true` ise sayfa süsü arka plan olarak çizilir (önizleme); PDF'te süs her sayfaya ayrıca çizilir. */
  decorated?: boolean
}

function Divider() {
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
      <span style={{ flex: 1, height: 1, background: LINE }} />
      <svg width="18" height="18" viewBox="-9 -9 18 18">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-4.2" rx="2.6" ry="4.2" fill="#f472b6" transform={`rotate(${a})`} />
        ))}
        <circle r="1.8" fill="#fde68a" />
      </svg>
      <span style={{ flex: 1, height: 1, background: LINE }} />
    </div>
  )
}

export const PlanDocumentView = forwardRef<HTMLDivElement, Props>(function PlanDocumentView({ doc, decorated = false }, ref) {
  return (
    <div
      ref={ref}
      style={{
        width: PAGE_PX.width,
        boxSizing: 'border-box',
        padding: `0 ${SIDE_PX + 36}px`,
        color: INK,
        fontFamily: 'var(--font-sans)',
        fontSize: 15,
        lineHeight: 1.5,
        ...(decorated ? { backgroundImage: `url("${decorationDataUrl()}")`, backgroundSize: `${PAGE_PX.width}px ${PAGE_PX.height}px`, backgroundRepeat: 'repeat-y', paddingTop: 56, paddingBottom: 56 } : {}),
      }}
    >
      <div data-pdf-block style={{ textAlign: 'center', paddingBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 4, color: ROSE, fontWeight: 700 }}>BESLENME PLANI</p>
        <h1 style={{ margin: '8px 0 0', fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.2, color: '#831843', fontWeight: 600 }}>{doc.title}</h1>
        <Divider />
        <div style={{ background: SOFT, border: `1px solid ${LINE}`, borderRadius: 14, padding: '12px 18px', textAlign: 'left', display: 'grid', gap: 4 }}>
          <Row label="Danışan" value={doc.clientName} />
          <Row label="Tarih" value={doc.periodLabel} />
          {doc.dietitianName && <Row label="Diyetisyen" value={doc.dietitianName} />}
        </div>
      </div>

      {doc.days.map((day) =>
        day.meals.map((meal, index) => (
          <div key={`${day.heading}-${meal.name}`} data-pdf-block style={{ paddingBottom: 14 }}>
            {index === 0 && (
              <h2
                style={{
                  margin: '14px 0 10px',
                  padding: '6px 16px',
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #f9a8d4, #fbcfe8)',
                  color: '#831843',
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  fontWeight: 600,
                  display: 'inline-block',
                }}
              >
                {day.heading}
              </h2>
            )}
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: ROSE }}>✿ {meal.name}</h3>
            <ul style={{ margin: 0, paddingLeft: 22, listStyle: 'none' }}>
              {meal.lines.map((line, i) => (
                <li key={i} style={{ position: 'relative', paddingLeft: 4 }}>
                  <span aria-hidden style={{ position: 'absolute', left: -16, color: '#f472b6' }}>
                    •
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )),
      )}

      {doc.notes.length > 0 && (
        <div data-pdf-block style={{ paddingBottom: 14 }}>
          <Divider />
          <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 17, color: '#831843' }}>Notlar</h2>
          <ul style={{ margin: 0, paddingLeft: 22, listStyle: 'none' }}>
            {doc.notes.map((line, i) => (
              <li key={i} style={{ position: 'relative', paddingLeft: 4 }}>
                <span aria-hidden style={{ position: 'absolute', left: -16, color: '#f472b6' }}>
                  •
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
})

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p style={{ margin: 0 }}>
      <span style={{ display: 'inline-block', width: 92, color: ROSE, fontWeight: 700 }}>{label}</span>
      {value}
    </p>
  )
}
