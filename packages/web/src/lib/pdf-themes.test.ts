import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, PDF_THEMES, themeById } from './pdf-themes'
import { decorationSvg } from './plan-decor'

describe('PDF temaları', () => {
  it('her temanın kimliği, rengi, çiçek türü veya deseni benzersizdir', () => {
    expect(new Set(PDF_THEMES.map((t) => t.id)).size).toBe(PDF_THEMES.length)
    expect(new Set(PDF_THEMES.map((t) => t.accent)).size).toBe(PDF_THEMES.length)
    expect(new Set(PDF_THEMES.map((t) => t.flower)).size).toBe(PDF_THEMES.length)
    expect(new Set(PDF_THEMES.map((t) => t.pattern)).size).toBe(PDF_THEMES.length)
  })

  it('bilinmeyen kimlikte varsayılan temaya döner', () => {
    expect(themeById('yok')).toBe(DEFAULT_THEME)
    expect(themeById('mavi').id).toBe('mavi')
  })

  it('her tema geçerli, birbirinden farklı bir sayfa süsü (SVG) üretir', () => {
    const svgs = PDF_THEMES.map((t) => decorationSvg(t))
    for (const svg of svgs) {
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
    }
    expect(new Set(svgs).size).toBe(PDF_THEMES.length)
  })
})
