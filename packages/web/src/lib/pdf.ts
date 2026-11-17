/**
 * Bağımlılıksız basit PDF yazıcı: her sayfa tek bir JPEG görselidir (metin seçilemez ama Türkçe
 * karakterler ve yazı tipleri tarayıcıda çizildiği gibi korunur). A4 boyutundadır.
 */

/** A4, punto cinsinden. */
export const A4_PT = { width: 595.28, height: 841.89 } as const

export type PdfPage = { jpeg: Uint8Array; width: number; height: number }

const encoder = new TextEncoder()

/** `pages` boşsa hata verir. Dönen bayt dizisi `application/pdf` olarak kaydedilir. */
export function buildPdf(pages: readonly PdfPage[]): Uint8Array<ArrayBuffer> {
  if (pages.length === 0) throw new RangeError('En az bir sayfa gerekir')
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    chunks.push(bytes)
    length += bytes.length
  }
  const object = (id: number, body: () => void) => {
    offsets[id] = length
    push(`${id} 0 obj\n`)
    body()
    push('endobj\n')
  }

  // Nesne numaraları: 1 katalog, 2 sayfa ağacı, sonra her sayfa için sayfa, içerik ve görsel.
  const pageId = (i: number) => 3 + i * 3
  push('%PDF-1.4\n%âãÏÓ\n')
  object(1, () => push('<< /Type /Catalog /Pages 2 0 R >>\n'))
  object(2, () => push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] >>\n`))
  pages.forEach((page, i) => {
    const content = `q ${A4_PT.width} 0 0 ${A4_PT.height} 0 0 cm /Im0 Do Q`
    object(pageId(i), () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT.width} ${A4_PT.height}] /Resources << /XObject << /Im0 ${pageId(i) + 2} 0 R >> >> /Contents ${pageId(i) + 1} 0 R >>\n`,
      ),
    )
    object(pageId(i) + 1, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\n`))
    object(pageId(i) + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`)
      push(page.jpeg)
      push('\nendstream\n')
    })
  })

  const count = pageId(pages.length - 1) + 3
  const xref = length
  push(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(length)
  let position = 0
  for (const chunk of chunks) {
    out.set(chunk, position)
    position += chunk.length
  }
  return out
}

/**
 * Uzun içeriği sayfalara böler. `bottoms` bölünmemesi istenen blokların alt kenarlarıdır (px, artan
 * sırada); her sayfa mümkün olduğunca son sığan blok kenarında biter. Sığmayan tek bir blok sayfa
 * yüksekliğinden büyükse sayfa sınırında kesilir.
 */
export function pageCuts(bottoms: readonly number[], total: number, pageHeight: number): [from: number, to: number][] {
  const pages: [number, number][] = []
  let start = 0
  while (total - start > pageHeight) {
    const limit = start + pageHeight
    const fit = bottoms.filter((b) => b > start && b <= limit)
    const end = fit.length > 0 ? Math.max(...fit) : limit
    pages.push([start, end])
    start = end
  }
  pages.push([start, total])
  return pages
}
