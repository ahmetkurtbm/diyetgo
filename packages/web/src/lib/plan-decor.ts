/**
 * Plan belgesinin sayfa süsü: sağ ve solda pembe şeritler ve çiçekler. Aynı SVG hem ekrandaki önizlemede
 * hem PDF'in her sayfasında kullanılır, böylece ikisi birbirine benzer.
 */
export const PAGE_PX = { width: 794, height: 1123 } as const
/** Süsün kapladığı yan şerit genişliği; içerik bunun dışında kalır. */
export const SIDE_PX = 64

const PETAL = ['#f9a8d4', '#f472b6', '#fbcfe8', '#ec4899']

function flower(cx: number, cy: number, r: number, rotate: number, tone: number): string {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = rotate + i * 72
    return `<ellipse cx="${cx}" cy="${cy - r * 0.62}" rx="${r * 0.42}" ry="${r * 0.66}" transform="rotate(${angle} ${cx} ${cy})" fill="${PETAL[tone % PETAL.length]}" opacity="0.92"/>`
  }).join('')
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="#fde68a"/><circle cx="${cx}" cy="${cy}" r="${r * 0.1}" fill="#f59e0b" opacity="0.7"/>`
}

function leaf(cx: number, cy: number, length: number, rotate: number): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${length * 0.28}" ry="${length * 0.5}" transform="rotate(${rotate} ${cx} ${cy})" fill="#a7c4a0" opacity="0.75"/>`
}

/** Bir yan şeridin çiçekleri; `mirror` sağ şerit için yatay aynalar. */
function side(mirror: boolean): string {
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
  const vine = `<path d="M ${x(30)} 0 C ${x(8)} 140 ${x(52)} 280 ${x(28)} 420 S ${x(8)} 700 ${x(32)} 840 S ${x(50)} 1010 ${x(26)} 1123" stroke="#86a98b" stroke-width="2" fill="none" opacity="0.6"/>`
  const parts = stems.map(([cx, cy, r, rot, tone]) => `${leaf(x(cx + (mirror ? -16 : 16)), cy + 14, 30, mirror ? -40 : 40)}${leaf(x(cx + (mirror ? 14 : -14)), cy - 12, 24, mirror ? 50 : -50)}${flower(x(cx), cy, r, rot, tone)}`)
  const buds = [140, 290, 430, 580, 710, 850, 985].map((cy, i) => `<circle cx="${x(i % 2 ? 40 : 14)}" cy="${cy}" r="${i % 2 ? 4 : 5}" fill="#f9a8d4" opacity="0.85"/>`)
  return vine + parts.join('') + buds.join('')
}

export function decorationSvg(): string {
  const { width, height } = PAGE_PX
  const strip = (left: boolean) =>
    `<rect x="${left ? 0 : width - SIDE_PX}" y="0" width="${SIDE_PX}" height="${height}" fill="url(#${left ? 'gl' : 'gr'})"/>` +
    `<line x1="${left ? SIDE_PX : width - SIDE_PX}" y1="0" x2="${left ? SIDE_PX : width - SIDE_PX}" y2="${height}" stroke="#f9a8d4" stroke-width="1" opacity="0.7"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="gl" x1="0" x2="1"><stop offset="0" stop-color="#fbcfe8"/><stop offset="1" stop-color="#fff1f6"/></linearGradient>` +
    `<linearGradient id="gr" x1="1" x2="0"><stop offset="0" stop-color="#fbcfe8"/><stop offset="1" stop-color="#fff1f6"/></linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="#fffafc"/>${strip(true)}${strip(false)}${side(false)}${side(true)}</svg>`
  )
}

export const decorationDataUrl = () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(decorationSvg())}`

export function loadDecoration(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Sayfa süsü yüklenemedi'))
    image.src = decorationDataUrl()
  })
}
