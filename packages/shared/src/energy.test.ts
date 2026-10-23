import { describe, expect, it } from 'vitest'
import { ageOn, dailyEnergy, macroGramsFromShares, mifflinStJeorBmr } from './energy'
import { energyFromMacros } from './nutrition'

describe('ageOn', () => {
  it('doğum günü o gün dahil yaşı artırır', () => {
    expect(ageOn('1990-04-12', '2026-04-11')).toBe(35)
    expect(ageOn('1990-04-12', '2026-04-12')).toBe(36)
    expect(ageOn('1990-04-12', '1990-04-12')).toBe(0)
  })

  it('29 Şubat doğumlular artık olmayan yılda yaşını 1 Mart\'ta tamamlar', () => {
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17)
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18)
    expect(ageOn('2008-02-29', '2028-02-29')).toBe(20)
  })

  it('doğumdan önceki tarih için hata verir', () => {
    expect(() => ageOn('1990-04-12', '1990-04-11')).toThrow(RangeError)
  })
})

describe('mifflinStJeorBmr', () => {
  it('elle hesaplanmış örneklerle eşleşir', () => {
    // 10×70 + 6.25×165 − 5×30 − 161 = 1420.25
    expect(mifflinStJeorBmr({ sex: 'female', weightKg: 70, heightCm: 165, ageYears: 30 })).toBeCloseTo(1420.25, 10)
    // 10×80 + 6.25×180 − 5×40 + 5 = 1730
    expect(mifflinStJeorBmr({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 40 })).toBeCloseTo(1730, 10)
  })

  it('cinsiyet farkı 166 kcal\'dir', () => {
    const input = { weightKg: 65, heightCm: 170, ageYears: 25 }
    const diff = mifflinStJeorBmr({ ...input, sex: 'male' }) - mifflinStJeorBmr({ ...input, sex: 'female' })
    expect(diff).toBeCloseTo(166, 10)
  })

  it('yalnızca 18 yaş ve üzeri için çalışır', () => {
    const base = { sex: 'female' as const, weightKg: 60, heightCm: 165 }
    expect(() => mifflinStJeorBmr({ ...base, ageYears: 17 })).toThrow(RangeError)
    expect(mifflinStJeorBmr({ ...base, ageYears: 18 })).toBeGreaterThan(0)
  })

  it('geçersiz, NaN veya sonsuz girdileri reddeder', () => {
    const base = { sex: 'male' as const, weightKg: 80, heightCm: 180, ageYears: 40 }
    expect(() => mifflinStJeorBmr({ ...base, weightKg: 0 })).toThrow(RangeError)
    expect(() => mifflinStJeorBmr({ ...base, heightCm: -1 })).toThrow(RangeError)
    expect(() => mifflinStJeorBmr({ ...base, weightKg: Number.NaN })).toThrow(RangeError)
    expect(() => mifflinStJeorBmr({ ...base, heightCm: Number.POSITIVE_INFINITY })).toThrow(RangeError)
    expect(() => mifflinStJeorBmr({ ...base, ageYears: Number.NaN })).toThrow(RangeError)
  })
})

describe('dailyEnergy', () => {
  it('BMR ile etkinlik katsayısını çarpar', () => {
    expect(dailyEnergy(1420.25, 1.55)).toBeCloseTo(2201.3875, 10)
    expect(dailyEnergy(1500, 1.2)).toBeCloseTo(1800, 10)
    expect(dailyEnergy(1500, 2.5)).toBeCloseTo(3750, 10)
  })

  it('aralık dışı, NaN veya sonsuz değerleri reddeder', () => {
    expect(() => dailyEnergy(1500, 1.19)).toThrow(RangeError)
    expect(() => dailyEnergy(1500, 2.51)).toThrow(RangeError)
    expect(() => dailyEnergy(0, 1.5)).toThrow(RangeError)
    expect(() => dailyEnergy(Number.NaN, 1.5)).toThrow(RangeError)
    expect(() => dailyEnergy(1500, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

describe('macroGramsFromShares', () => {
  it('yüzdeleri 4/4/9 katsayılarıyla grama çevirir', () => {
    const grams = macroGramsFromShares(2000, { proteinPct: 30, carbsPct: 40, fatPct: 30 })
    expect(grams.proteinG).toBeCloseTo(150, 10)
    expect(grams.carbsG).toBeCloseTo(200, 10)
    expect(grams.fatG).toBeCloseTo(66.6667, 4)
    expect(energyFromMacros(grams)).toBeCloseTo(2000, 10)
  })

  it('ondalıklı yüzdelerde toplam 100 kabul edilir', () => {
    expect(() => macroGramsFromShares(1800, { proteinPct: 33.3, carbsPct: 33.4, fatPct: 33.3 })).not.toThrow()
  })

  it('toplamı 100 olmayan, negatif, NaN veya sonsuz değerleri reddeder', () => {
    expect(() => macroGramsFromShares(2000, { proteinPct: 30, carbsPct: 40, fatPct: 29 })).toThrow(RangeError)
    expect(() => macroGramsFromShares(2000, { proteinPct: -10, carbsPct: 80, fatPct: 30 })).toThrow(RangeError)
    expect(() => macroGramsFromShares(-1, { proteinPct: 30, carbsPct: 40, fatPct: 30 })).toThrow(RangeError)
    expect(() => macroGramsFromShares(Number.NaN, { proteinPct: 30, carbsPct: 40, fatPct: 30 })).toThrow(RangeError)
    expect(() => macroGramsFromShares(2000, { proteinPct: Number.NaN, carbsPct: 40, fatPct: 30 })).toThrow(RangeError)
    expect(() =>
      macroGramsFromShares(Number.POSITIVE_INFINITY, { proteinPct: 30, carbsPct: 40, fatPct: 30 }),
    ).toThrow(RangeError)
  })
})
