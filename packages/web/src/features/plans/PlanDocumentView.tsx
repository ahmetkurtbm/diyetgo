/**
 * Serbest menünün PDF/önizleme görünümü: A4 genişliğinde, temaya göre renkli ve çiçek süslü belge.
 * Boyutlar piksel olarak sabittir (A4 = 794 px genişlik) ki PDF çıktısı ekrana göre değişmesin.
 * `data-pdf-block` işaretli öğeler sayfa kesilirken bölünmez (bkz. `pageCuts`).
 */
import { recommendationIcon, type PlanDocument, type RecommendationIcon } from '@diyetgo/shared'
import { forwardRef } from 'react'
import { type PdfTheme } from '../../lib/pdf-themes'
import { decorationDataUrl, PAGE_PX, SIDE_PX } from '../../lib/plan-decor'

type Props = {
  doc: PlanDocument
  theme: PdfTheme
  /** `true` ise sayfa süsü arka plan olarak çizilir (önizleme); PDF'te süs her sayfaya ayrıca çizilir. */
  decorated?: boolean
}

function FlowerMark({ theme }: { theme: PdfTheme }) {
  return (
    <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-4.2" rx="2.6" ry="4.2" fill={theme.petals[0]} transform={`rotate(${a})`} />
      ))}
      <circle r="1.8" fill={theme.center} />
    </svg>
  )
}

function Divider({ theme }: { theme: PdfTheme }) {
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
      <span style={{ flex: 1, height: 1, background: theme.line }} />
      <FlowerMark theme={theme} />
      <span style={{ flex: 1, height: 1, background: theme.line }} />
    </div>
  )
}

/** Öneri satırının simgesi; renkler temadan gelir. */
function Icon({ kind, theme }: { kind: RecommendationIcon; theme: PdfTheme }) {
  const fill = theme.accent
  const shapes: Record<RecommendationIcon, React.ReactNode> = {
    water: <path d="M12 3 C12 3 5.5 10.5 5.5 15 a6.5 6.5 0 0 0 13 0 C18.5 10.5 12 3 12 3 Z" fill={fill} />,
    fish: (
      <>
        <ellipse cx="10" cy="12" rx="7" ry="4.6" fill={fill} />
        <path d="M15.5 12 L21.5 7.5 L21.5 16.5 Z" fill={fill} />
        <circle cx="6.6" cy="11" r="0.9" fill="#ffffff" />
      </>
    ),
    vegetable: (
      <>
        <path d="M4.5 19.5 C4.5 9.5 10.5 4 20 4 C20 13.5 14.5 19.5 4.5 19.5 Z" fill={fill} />
        <path d="M5 19 L15 9" stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.7" />
      </>
    ),
    legume: (
      <>
        <ellipse cx="9" cy="13" rx="3.6" ry="6.6" transform="rotate(25 9 13)" fill={fill} />
        <ellipse cx="15.5" cy="11" rx="3.6" ry="6.6" transform="rotate(25 15.5 11)" fill={fill} opacity="0.75" />
      </>
    ),
    flower: (
      <>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="12" cy="7.5" rx="3.2" ry="5" transform={`rotate(${a} 12 12)`} fill={fill} opacity="0.9" />
        ))}
        <circle cx="12" cy="12" r="2.4" fill={theme.center} />
      </>
    ),
  }
  return (
    <span
      aria-hidden
      style={{ flex: 'none', width: 34, height: 34, borderRadius: 999, background: '#ffffff', border: `1.5px solid ${theme.line}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24">
        {shapes[kind]}
      </svg>
    </span>
  )
}

export const PlanDocumentView = forwardRef<HTMLDivElement, Props>(function PlanDocumentView({ doc, theme, decorated = false }, ref) {
  return (
    <div
      ref={ref}
      style={{
        width: PAGE_PX.width,
        boxSizing: 'border-box',
        padding: `0 ${SIDE_PX + 36}px`,
        color: theme.ink,
        fontFamily: 'var(--font-sans)',
        fontSize: 15,
        lineHeight: 1.5,
        ...(decorated ? { backgroundImage: `url("${decorationDataUrl(theme)}")`, backgroundSize: `${PAGE_PX.width}px ${PAGE_PX.height}px`, backgroundRepeat: 'repeat-y', paddingTop: 56, paddingBottom: 56 } : {}),
      }}
    >
      <div data-pdf-block style={{ textAlign: 'center', paddingBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 4, color: theme.accent, fontWeight: 700 }}>BESLENME PLANI</p>
        <h1 style={{ margin: '8px 0 0', fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.2, color: theme.title, fontWeight: 600 }}>{doc.title}</h1>
        <Divider theme={theme} />
        <div style={{ background: theme.soft, border: `1px solid ${theme.line}`, borderRadius: 14, padding: '12px 18px', textAlign: 'left', display: 'grid', gap: 4 }}>
          <Row theme={theme} label="Danışan" value={doc.clientName} />
          <Row theme={theme} label="Tarih" value={doc.periodLabel} />
          {doc.dietitianName && <Row theme={theme} label="Diyetisyen" value={doc.dietitianName} />}
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
                  background: `linear-gradient(90deg, ${theme.pillFrom}, ${theme.pillTo})`,
                  color: theme.title,
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  fontWeight: 600,
                  display: 'inline-block',
                }}
              >
                {day.heading}
              </h2>
            )}
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: theme.accent }}>✿ {meal.name}</h3>
            <ul style={{ margin: 0, paddingLeft: 22, listStyle: 'none' }}>
              {meal.lines.map((line, i) => (
                <li key={i} style={{ position: 'relative', paddingLeft: 4 }}>
                  <span aria-hidden style={{ position: 'absolute', left: -16, color: theme.bullet }}>
                    •
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )),
      )}

      {doc.recommendations.length > 0 && (
        <div data-pdf-block style={{ paddingBottom: 14 }}>
          <div style={{ margin: '10px 0 0', background: theme.soft, border: `2px solid ${theme.line}`, borderRadius: 22, padding: '14px 18px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
              <FlowerMark theme={theme} />
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 19, color: theme.title, fontWeight: 600 }}>Öneriler</h2>
              <FlowerMark theme={theme} />
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {doc.recommendations.map((line, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#ffffff', border: `1px solid ${theme.line}`, borderRadius: 999, padding: '5px 16px 5px 6px' }}>
                  <Icon kind={recommendationIcon(line)} theme={theme} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div style={{ height: 8 }} />
          </div>
        </div>
      )}
    </div>
  )
})

function Row({ theme, label, value }: { theme: PdfTheme; label: string; value: string }) {
  return (
    <p style={{ margin: 0 }}>
      <span style={{ display: 'inline-block', width: 92, color: theme.accent, fontWeight: 700 }}>{label}</span>
      {value}
    </p>
  )
}
