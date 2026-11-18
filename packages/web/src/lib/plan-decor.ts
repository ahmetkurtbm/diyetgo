/**
 * Plan belgesinin sayfa süsü: sağ ve solda renkli şeritler, desen ve çiçekler (tema renklerine göre).
 * Aynı SVG hem ekrandaki önizlemede hem PDF'in her sayfasında kullanılır, böylece ikisi birbirine benzer.
 */
import { type PdfTheme, type StripPattern } from './pdf-themes'

export const PAGE_PX = { width: 794, height: 1123 } as const
/** Süsün kapladığı yan şerit genişliği; içerik bunun dışında kalır. */
export const SIDE_PX = 64

function petalColor(theme: PdfTheme, tone: number): string {
  return theme.petals[tone % theme.petals.length]!
}

const stroke = (theme: PdfTheme) => (theme.petalStroke ? ` stroke="${theme.petalStroke}" stroke-width="0.8"` : '')

/** Tek bir çiçek; biçimi temaya göre değişir. `rotate` derece, `tone` renk sırasıdır. */
function flower(theme: PdfTheme, cx: number, cy: number, r: number, rotate: number, tone: number): string {
  const fill = petalColor(theme, tone)
  const center = (size: number) => `<circle cx="${cx}" cy="${cy}" r="${r * size}" fill="${theme.center}"/><circle cx="${cx}" cy="${cy}" r="${r * size * 0.45}" fill="#f59e0b" opacity="0.65"/>`
  switch (theme.flower) {
    case 'daisy': {
      const petals = Array.from({ length: 12 }, (_, i) => `<ellipse cx="${cx}" cy="${cy - r * 0.55}" rx="${r * 0.15}" ry="${r * 0.5}" transform="rotate(${rotate + i * 30} ${cx} ${cy})" fill="${fill}"${stroke(theme)}/>`).join('')
      return petals + center(0.26)
    }
    case 'tulip': {
      const tilt = (rotate % 24) - 12
      return (
        `<g transform="translate(${cx} ${cy}) rotate(${tilt}) scale(${r / 10})">` +
        `<path d="M-7 2 C-9 -8 -4 -14 0 -17 C4 -14 9 -8 7 2 C4 5 -4 5 -7 2 Z" fill="${fill}"/>` +
        `<path d="M-3.4 3 C-5.5 -7 -1 -12 0 -15 C1 -12 5.5 -7 3.4 3 Z" fill="${petalColor(theme, tone + 1)}" opacity="0.85"/>` +
        `<path d="M0 -17 C-3 -12 -3.5 -5 -2.5 3" stroke="#ffffff" stroke-width="0.6" opacity="0.5" fill="none"/></g>`
      )
    }
    case 'forget': {
      const petals = Array.from({ length: 5 }, (_, i) => {
        const angle = ((rotate + i * 72) * Math.PI) / 180
        return `<circle cx="${cx + Math.sin(angle) * r * 0.5}" cy="${cy - Math.cos(angle) * r * 0.5}" r="${r * 0.34}" fill="${fill}" opacity="0.95"/>`
      }).join('')
      return petals + center(0.2)
    }
    case 'lavender': {
      // Dik bir başak: küçük tomurcuklar, tepeye doğru daralır.
      const buds = Array.from({ length: 7 }, (_, i) => {
        const y = cy - r + i * (r * 0.32)
        const side = i % 2 === 0 ? -1 : 1
        const size = r * (0.2 + 0.03 * (6 - i) * 0.5)
        return `<ellipse cx="${cx + side * r * 0.16}" cy="${y}" rx="${size}" ry="${size * 1.5}" transform="rotate(${side * 25} ${cx + side * r * 0.16} ${y})" fill="${petalColor(theme, tone + i)}"/>`
      }).join('')
      return `<path d="M ${cx} ${cy + r * 1.3} L ${cx} ${cy - r}" stroke="${theme.vine}" stroke-width="1.6"/>${buds}`
    }
    default: {
      const petals = Array.from({ length: 5 }, (_, i) => `<ellipse cx="${cx}" cy="${cy - r * 0.62}" rx="${r * 0.42}" ry="${r * 0.66}" transform="rotate(${rotate + i * 72} ${cx} ${cy})" fill="${fill}" opacity="0.92"/>`).join('')
      return petals + center(0.22)
    }
  }
}

function leaf(theme: PdfTheme, cx: number, cy: number, length: number, rotate: number): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${length * 0.28}" ry="${length * 0.5}" transform="rotate(${rotate} ${cx} ${cy})" fill="${theme.leaf}" opacity="0.75"/>`
}

/** Bir yan şeridin çiçekleri; `mirror` sağ şerit için yatay aynalar. */
function side(theme: PdfTheme, mirror: boolean): string {
  const x = (v: number) => (mirror ? PAGE_PX.width - v : v)
  const stems = [
    [30, 70, 17, 10, 0],
    [22, 215, 12, 40, 1],
    [36, 345, 15, 20, 2],
    [20, 500, 18, 55, 3],
    [34, 640, 12, 5, 0],
    [24, 780, 16, 30, 1],
    [36, 915, 13, 48, 2],
    [22, 1050, 18, 15, 3],
  ] as const
  const vine = `<path d="M ${x(30)} 0 C ${x(8)} 140 ${x(52)} 280 ${x(28)} 420 S ${x(8)} 700 ${x(32)} 840 S ${x(50)} 1010 ${x(26)} 1123" stroke="${theme.vine}" stroke-width="2" fill="none" opacity="0.6"/>`
  const leaves = theme.flower !== 'lavender'
  const parts = stems.map(([cx, cy, r, rot, tone]) => {
    const pair = leaves ? `${leaf(theme, x(cx + (mirror ? -16 : 16)), cy + 14, 30, mirror ? -40 : 40)}${leaf(theme, x(cx + (mirror ? 14 : -14)), cy - 12, 24, mirror ? 50 : -50)}` : ''
    return pair + flower(theme, x(cx), cy, r, rot, tone)
  })
  const buds = [140, 290, 430, 580, 710, 850, 985].map((cy, i) => `<circle cx="${x(i % 2 ? 40 : 14)}" cy="${cy}" r="${i % 2 ? 4 : 5}" fill="${petalColor(theme, i)}" opacity="0.85"${stroke(theme)}/>`)
  return vine + parts.join('') + buds.join('')
}

/** Yan şeritlerin üstüne düşük opaklıkla çizilen desen. */
function patternDefs(pattern: StripPattern, color: string): string {
  const body: Record<StripPattern, string> = {
    none: '',
    dots: `<pattern id="pt" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="1.8" fill="${color}"/></pattern>`,
    stripes: `<pattern id="pt" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="12" fill="${color}"/></pattern>`,
    diamonds: `<pattern id="pt" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M9 2 L16 9 L9 16 L2 9 Z" fill="none" stroke="${color}" stroke-width="1"/></pattern>`,
    waves: `<pattern id="pt" width="20" height="12" patternUnits="userSpaceOnUse"><path d="M0 6 Q5 0 10 6 T20 6" fill="none" stroke="${color}" stroke-width="1.2"/></pattern>`,
  }
  return body[pattern]
}

export function decorationSvg(theme: PdfTheme): string {
  const { width, height } = PAGE_PX
  const strip = (left: boolean) => {
    const x = left ? 0 : width - SIDE_PX
    const edge = left ? SIDE_PX : width - SIDE_PX
    return (
      `<rect x="${x}" y="0" width="${SIDE_PX}" height="${height}" fill="url(#${left ? 'gl' : 'gr'})"/>` +
      (theme.pattern === 'none' ? '' : `<rect x="${x}" y="0" width="${SIDE_PX}" height="${height}" fill="url(#pt)" opacity="0.45"/>`) +
      `<line x1="${edge}" y1="0" x2="${edge}" y2="${height}" stroke="${theme.stripLine}" stroke-width="1" opacity="0.7"/>`
    )
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="gl" x1="0" x2="1"><stop offset="0" stop-color="${theme.stripFrom}"/><stop offset="1" stop-color="${theme.stripTo}"/></linearGradient>` +
    `<linearGradient id="gr" x1="1" x2="0"><stop offset="0" stop-color="${theme.stripFrom}"/><stop offset="1" stop-color="${theme.stripTo}"/></linearGradient>` +
    `${patternDefs(theme.pattern, theme.stripLine)}</defs>` +
    `<rect width="${width}" height="${height}" fill="${theme.bg}"/>${strip(true)}${strip(false)}${side(theme, false)}${side(theme, true)}</svg>`
  )
}

export const decorationDataUrl = (theme: PdfTheme) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(decorationSvg(theme))}`

export function loadDecoration(theme: PdfTheme): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Sayfa süsü yüklenemedi'))
    image.src = decorationDataUrl(theme)
  })
}
