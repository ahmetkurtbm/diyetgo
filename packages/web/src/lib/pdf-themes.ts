/**
 * PDF temaları: her biri farklı renk, çiçek türü ve yan şerit deseni kullanır. Renkler belgenin
 * kendi içinde sabittir (uygulamanın açık/koyu temasından etkilenmez).
 */
export type FlowerShape = 'round' | 'daisy' | 'tulip' | 'forget' | 'lavender'
export type StripPattern = 'none' | 'dots' | 'stripes' | 'diamonds' | 'waves'

export type PdfTheme = {
  id: string
  name: string
  flower: FlowerShape
  pattern: StripPattern
  /** Sayfa zemini. */
  bg: string
  ink: string
  title: string
  accent: string
  /** Bilgi kutusu ve öneriler zemini. */
  soft: string
  line: string
  pillFrom: string
  pillTo: string
  stripFrom: string
  stripTo: string
  stripLine: string
  /** Çiçek yaprak renkleri; çiçekler sırayla bunlardan seçer. */
  petals: readonly string[]
  petalStroke: string | null
  center: string
  vine: string
  leaf: string
  bullet: string
}

export const PDF_THEMES: readonly PdfTheme[] = [
  {
    id: 'pembe',
    name: 'Pembe çiçek',
    flower: 'round',
    pattern: 'none',
    bg: '#fffafc',
    ink: '#4a1d33',
    title: '#831843',
    accent: '#be185d',
    soft: '#fdf2f8',
    line: '#fbcfe8',
    pillFrom: '#f9a8d4',
    pillTo: '#fbcfe8',
    stripFrom: '#fbcfe8',
    stripTo: '#fff1f6',
    stripLine: '#f9a8d4',
    petals: ['#f9a8d4', '#f472b6', '#fbcfe8', '#ec4899'],
    petalStroke: null,
    center: '#fde68a',
    vine: '#86a98b',
    leaf: '#a7c4a0',
    bullet: '#f472b6',
  },
  {
    id: 'lavanta',
    name: 'Lavanta',
    flower: 'lavender',
    pattern: 'stripes',
    bg: '#fcfbff',
    ink: '#2e1f4a',
    title: '#4c1d95',
    accent: '#7c3aed',
    soft: '#f5f3ff',
    line: '#ddd6fe',
    pillFrom: '#c4b5fd',
    pillTo: '#ddd6fe',
    stripFrom: '#ddd6fe',
    stripTo: '#f5f3ff',
    stripLine: '#c4b5fd',
    petals: ['#a78bfa', '#c4b5fd', '#8b5cf6', '#ddd6fe'],
    petalStroke: null,
    center: '#fde68a',
    vine: '#8aa889',
    leaf: '#a7c4a0',
    bullet: '#a78bfa',
  },
  {
    id: 'nane',
    name: 'Nane papatyası',
    flower: 'daisy',
    pattern: 'diamonds',
    bg: '#fafffb',
    ink: '#12351f',
    title: '#14532d',
    accent: '#15803d',
    soft: '#f0fdf4',
    line: '#bbf7d0',
    pillFrom: '#86efac',
    pillTo: '#bbf7d0',
    stripFrom: '#bbf7d0',
    stripTo: '#f0fdf4',
    stripLine: '#86efac',
    petals: ['#ffffff', '#fefce8', '#ffffff'],
    petalStroke: '#86efac',
    center: '#facc15',
    vine: '#4d7c0f',
    leaf: '#86b97a',
    bullet: '#4ade80',
  },
  {
    id: 'seftali',
    name: 'Şeftali lale',
    flower: 'tulip',
    pattern: 'waves',
    bg: '#fffcf9',
    ink: '#4a2511',
    title: '#9a3412',
    accent: '#ea580c',
    soft: '#fff7ed',
    line: '#fed7aa',
    pillFrom: '#fdba74',
    pillTo: '#fed7aa',
    stripFrom: '#fed7aa',
    stripTo: '#fff7ed',
    stripLine: '#fdba74',
    petals: ['#fb7185', '#fb923c', '#fdba74', '#f97316'],
    petalStroke: null,
    center: '#fde68a',
    vine: '#86a98b',
    leaf: '#a7c4a0',
    bullet: '#fb923c',
  },
  {
    id: 'mavi',
    name: 'Gökyüzü mavisi',
    flower: 'forget',
    pattern: 'dots',
    bg: '#fafcff',
    ink: '#1e3a5f',
    title: '#1e40af',
    accent: '#2563eb',
    soft: '#eff6ff',
    line: '#bfdbfe',
    pillFrom: '#93c5fd',
    pillTo: '#bfdbfe',
    stripFrom: '#bfdbfe',
    stripTo: '#eff6ff',
    stripLine: '#93c5fd',
    petals: ['#93c5fd', '#60a5fa', '#bfdbfe', '#3b82f6'],
    petalStroke: null,
    center: '#fde68a',
    vine: '#86a98b',
    leaf: '#a7c4a0',
    bullet: '#60a5fa',
  },
]

export const DEFAULT_THEME = PDF_THEMES[0]!

export const themeById = (id: string | null | undefined): PdfTheme => PDF_THEMES.find((t) => t.id === id) ?? DEFAULT_THEME
