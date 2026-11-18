import { describe, expect, it } from 'vitest'
import { correctLine, correctMealText, foldTurkish, mealLines, planDocumentToHtml, planDocumentToText, recommendationIcon, type PlanDocument } from './plan-text'

describe('correctLine', () => {
  it('boşluk, noktalama, aralık ve satır başı büyük harfi düzeltir', () => {
    expect(correctLine('  7 - 8   yemek kaşığı tavuk sote ')).toBe('7-8 yemek kaşığı tavuk sote')
    expect(correctLine('- yarım   su bardağı süt , 1 dilim ekmek')).toBe('Yarım su bardağı süt, 1 dilim ekmek')
    expect(correctLine('8yemek kaşığı pilav')).toBe('8 yemek kaşığı pilav')
    expect(correctLine('iki dilim ekmek')).toBe('İki dilim ekmek')
    expect(correctLine('200gr tavuk')).toBe('200 g tavuk')
    expect(correctLine('1,5 bardak süt')).toBe('1,5 bardak süt')
    expect(correctLine('   ')).toBe('')
  })

  it('Türkçe karakteri eksik bilinen kelimeleri düzeltir, büyük/küçük harfi korur', () => {
    expect(correctLine('4 yemek kasigi yogurt')).toBe('4 yemek kaşığı yoğurt')
    expect(correctLine('YOGURT ve sut')).toBe('YOĞURT ve süt')
    expect(correctLine('haslanmis yumurta ve izgara tavuk')).toBe('Haşlanmış yumurta ve ızgara tavuk')
    expect(correctLine('kucuk kase yagsiz salata')).toBe('Küçük kase yağsız salata')
    expect(correctLine('uzum ve findik')).toBe('Üzüm ve fındık')
  })

  it('doğru yazılmış ve bilinmeyen kelimelere dokunmaz', () => {
    expect(correctLine('Yoğurt ve zeytinyağı')).toBe('Yoğurt ve zeytinyağı')
    expect(correctLine('xyzzy ve qwerty')).toBe('Xyzzy ve qwerty')
  })
})

describe('correctMealText ve mealLines', () => {
  it('boş satırları atar, her satırı madde yapar', () => {
    expect(correctMealText('- 2 dilim ekmek\n\n  1 haslanmis yumurta  \r\n')).toBe('2 dilim ekmek\n1 haşlanmış yumurta')
    expect(mealLines(null)).toEqual([])
    expect(mealLines('a\nb')).toEqual(['A', 'B'])
  })
})

describe('foldTurkish', () => {
  it('Türkçe karakterleri sadeleştirir', () => expect(foldTurkish('ÇIĞÖŞÜ İ')).toBe('cigosu i'))
})

describe('planDocumentTo*', () => {
  const doc: PlanDocument = {
    title: 'Haftalık menü',
    clientName: 'Ayşe Yılmaz',
    dietitianName: 'Dyt. Deniz Kaya',
    periodLabel: '17 Kasım 2026 – 23 Kasım 2026',
    recommendations: ['Günde 2 litre su içiniz'],
    days: [{ heading: '1. Gün · Pazartesi', meals: [{ name: 'Kahvaltı', lines: ['2 dilim ekmek', 'Domates <taze>'] }] }],
  }

  it('Canva için düz metin üretir', () => {
    expect(planDocumentToText(doc)).toBe(
      [
        'Haftalık menü',
        'Danışan: Ayşe Yılmaz',
        'Tarih: 17 Kasım 2026 – 23 Kasım 2026',
        'Diyetisyen: Dyt. Deniz Kaya',
        '',
        '1. Gün · Pazartesi',
        'Kahvaltı:',
        '• 2 dilim ekmek',
        '• Domates <taze>',
        '',
        'Öneriler',
        '• Günde 2 litre su içiniz',
      ].join('\n'),
    )
  })

  it('HTML çıktısında özel karakterleri kaçırır; diyetisyen adı yoksa satırı atar', () => {
    const html = planDocumentToHtml({ ...doc, dietitianName: '' })
    expect(html).toContain('<li>Domates &lt;taze&gt;</li>')
    expect(html).not.toContain('Diyetisyen')
    expect(planDocumentToText({ ...doc, dietitianName: '' })).not.toContain('Diyetisyen')
  })
})

describe('recommendationIcon', () => {
  it('öneri satırına uygun simgeyi seçer', () => {
    expect(recommendationIcon('Günde 2-2,5 litre su için')).toBe('water')
    expect(recommendationIcon('Haftada 2 gün balık tüketin')).toBe('fish')
    expect(recommendationIcon('Haftada 3-4 gün kuru baklagil')).toBe('legume')
    expect(recommendationIcon('Haftada 2 gün sebze yemeği')).toBe('vegetable')
    expect(recommendationIcon('Yavaş yiyin, iyi çiğneyin')).toBe('flower')
  })
})
