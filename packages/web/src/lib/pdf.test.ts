import { describe, expect, it } from 'vitest'
import { A4_PT, buildPdf, MAX_CANVAS_PIXELS, MIN_RENDER_SCALE, pageCuts, renderScale } from './pdf'

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

describe('buildPdf', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])

  it('geçerli bir PDF yapısı üretir: başlık, sayfa sayısı, xref ve dosya sonu', () => {
    const bytes = buildPdf([
      { jpeg, width: 1588, height: 2246 },
      { jpeg, width: 1588, height: 2246 },
    ])
    const pdf = text(bytes)
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(pdf).toContain('/Count 2')
    expect(pdf).toContain(`/MediaBox [0 0 ${A4_PT.width} ${A4_PT.height}]`)
    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(2)
    expect(pdf).toContain('/Filter /DCTDecode')
  })

  it('xref tablosundaki konumlar nesnelerin gerçek yerini gösterir', () => {
    const bytes = buildPdf([{ jpeg, width: 100, height: 140 }])
    const pdf = text(bytes)
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)![1])
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe('xref')
    const entries = [...pdf.slice(xrefAt).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]))
    expect(entries).toHaveLength(5) // katalog, ağaç, sayfa, içerik, görsel
    entries.forEach((offset, i) => expect(pdf.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`))
  })

  it('JPEG baytlarını değiştirmeden gömer ve boş sayfa listesini reddeder', () => {
    const bytes = buildPdf([{ jpeg, width: 10, height: 14 }])
    const at = bytes.findIndex((_, i) => bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff && bytes[i + 3] === 0xe0)
    expect([...bytes.slice(at, at + jpeg.length)]).toEqual([...jpeg])
    expect(() => buildPdf([])).toThrow(RangeError)
  })
})

describe('pageCuts', () => {
  it('tek sayfaya sığıyorsa bölmez', () => expect(pageCuts([100, 200], 300, 1000)).toEqual([[0, 300]]))

  it('sayfayı sığan son blok kenarında keser', () => {
    expect(pageCuts([300, 600, 900, 1200, 1500], 1700, 1000)).toEqual([
      [0, 900],
      [900, 1700],
    ])
  })

  it('sayfadan büyük tek blok sayfa sınırında kesilir', () => {
    expect(pageCuts([2500], 2500, 1000)).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 2500],
    ])
  })
})

describe('renderScale', () => {
  it('kısa belgede tam ölçeği korur, uzun belgede canvas alanını güvenli sınırın altında tutur', () => {
    expect(renderScale(794, 1500)).toBe(2)
    const scale = renderScale(794, 30_000)
    expect(scale).toBeLessThan(2)
    expect(794 * scale * (30_000 * scale)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS * 1.0001)
    // Çok uzun belgede bile alt sınırın altına inmez (okunaklı kalsın).
    expect(renderScale(794, 200_000)).toBe(MIN_RENDER_SCALE)
  })
})
