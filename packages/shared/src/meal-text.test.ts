import { describe, expect, it } from 'vitest'
import { createSeedData } from './seed'
import { HOUSEHOLD_MEASURES, matchFood, parseMeasure, parseMealText } from './meal-text'

const foods = createSeedData('2026-03-10').foods

describe('parseMeasure', () => {
  it('aralığın ortalamasını, kesri, ondalığı ve yazıyla miktarı okur', () => {
    expect(parseMeasure('7-8 yemek kaşığı tavuk sote')).toEqual({ quantity: 7.5, unit: 'yemek kaşığı', rest: 'tavuk sote' })
    expect(parseMeasure('1/2 su bardağı süt')).toMatchObject({ quantity: 0.5, unit: 'su bardağı' })
    expect(parseMeasure('2,5 dilim ekmek')).toMatchObject({ quantity: 2.5, unit: 'dilim' })
    expect(parseMeasure('yarım kase yoğurt')).toMatchObject({ quantity: 0.5, unit: 'kase' })
    expect(parseMeasure('bir buçuk kepçe çorba')).toMatchObject({ quantity: 1.5, unit: 'kepçe' })
    expect(parseMeasure('- 1 küçük kase salata')).toMatchObject({ quantity: 1, unit: 'küçük kase', rest: 'salata' })
    expect(parseMeasure('150 g tavuk')).toMatchObject({ quantity: 150, unit: 'gram' })
    expect(parseMeasure('Haşlanmış yumurta')).toEqual({ quantity: 1, unit: null, rest: 'haşlanmış yumurta' })
  })
})

describe('matchFood', () => {
  it('Türkçe ek ve büyük/küçük harf farkına rağmen en uygun besini bulur', () => {
    expect(matchFood('tavuk sote', foods)?.name).toBe('Tavuk sote')
    expect(matchFood('pirinç pilavı', foods)?.name).toBe('Pirinç pilavı')
    expect(matchFood('YAĞSIZ SALATA', foods)?.name).toBe('Yağsız salata')
    expect(matchFood('haşlanmış yumurta', foods)?.name).toBe('Haşlanmış yumurta')
    expect(matchFood('uzay yemeği', foods)).toBeNull()
  })
})

describe('parseMealText', () => {
  it('diyetisyenin yazdığı öğünü besin ve grama çevirir', () => {
    const lines = parseMealText('7-8 yemek kaşığı tavuk sote\n8 yemek kaşığı pirinç pilavı\n\n1 küçük kase yağsız salata\n4 yemek kaşığı yoğurt\n2 haşlanmış yumurta\nuzay yemeği', foods)
    expect(lines.map((l) => [l.food?.name ?? null, l.amount])).toEqual([
      ['Tavuk sote', 187.5], // besinin porsiyonu: 1 yemek kaşığı = 25 g
      ['Pirinç pilavı', 160],
      ['Yağsız salata', HOUSEHOLD_MEASURES['küçük kase']], // besinin porsiyonu "1 kase"; küçük kase varsayılandır
      ['Yoğurt (tam yağlı)', 4 * HOUSEHOLD_MEASURES['yemek kaşığı']!],
      ['Haşlanmış yumurta', 100],
      [null, null],
    ])
  })
})

describe('değişim satırları', () => {
  it('"2 ekmek değişimi" değişim sayısı olarak okunur', () => {
    const [bread, milk] = parseMealText('2 ekmek değişimi\n1 süt değişimi', foods)
    expect([bread!.food?.name, bread!.amount]).toEqual(['Ekmek değişimi', 2])
    expect([milk!.food?.name, milk!.amount]).toEqual(['Süt değişimi', 1])
  })
})
