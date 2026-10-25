import { describe, expect, it } from 'vitest'
import { dayTotals, energyFromMacros, ingredientsWeight, mealTotals, nutrientsFor, resolveRecipeFoods, sumNutrients, ZERO_NUTRIENTS } from './nutrition'

// Kurgusal test besinleri; değerler 100 g/ml başınadır.
const oats = { energyKcal: 380, proteinG: 13, carbsG: 60, fatG: 7 }
const milk = { energyKcal: 46, proteinG: 3.3, carbsG: 4.8, fatG: 1.5 }

function expectNutrients(actual: ReturnType<typeof nutrientsFor>, expected: ReturnType<typeof nutrientsFor>) {
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    expect(actual[key]).toBeCloseTo(expected[key], 10)
  }
}

describe('nutrientsFor', () => {
  it('100 birim başına değerleri miktara göre ölçekler', () => {
    expect(nutrientsFor(oats, 0)).toEqual(ZERO_NUTRIENTS)
    expectNutrients(nutrientsFor(oats, 100), oats)
    expectNutrients(nutrientsFor(oats, 50), { energyKcal: 190, proteinG: 6.5, carbsG: 30, fatG: 3.5 })
    expectNutrients(nutrientsFor(oats, 250), { energyKcal: 950, proteinG: 32.5, carbsG: 150, fatG: 17.5 })
  })

  it('ml cinsinden besinlerde de aynı formülü kullanır', () => {
    expectNutrients(nutrientsFor(milk, 200), { energyKcal: 92, proteinG: 6.6, carbsG: 9.6, fatG: 3 })
  })

  it('sonucu yuvarlamaz', () => {
    expect(nutrientsFor(oats, 30).fatG).toBeCloseTo(2.1, 10)
    expect(nutrientsFor({ ...oats, fatG: 3.5 }, 30).fatG).toBeCloseTo(1.05, 10)
  })

  it('negatif, NaN veya sonsuz miktarı reddeder', () => {
    expect(() => nutrientsFor(oats, -1)).toThrow(RangeError)
    expect(() => nutrientsFor(oats, Number.NaN)).toThrow(RangeError)
    expect(() => nutrientsFor(oats, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('besin değerinde NaN veya sonsuz değeri reddeder', () => {
    expect(() => nutrientsFor({ ...oats, energyKcal: Number.NaN }, 50)).toThrow(RangeError)
    expect(() => nutrientsFor({ ...oats, fatG: Number.NEGATIVE_INFINITY }, 50)).toThrow(RangeError)
  })
})

describe('sumNutrients', () => {
  it('boş listede sıfır döndürür ve değerleri toplar', () => {
    expect(sumNutrients([])).toEqual(ZERO_NUTRIENTS)
    expectNutrients(sumNutrients([nutrientsFor(oats, 40), nutrientsFor(milk, 200)]), {
      energyKcal: 152 + 92,
      proteinG: 5.2 + 6.6,
      carbsG: 24 + 9.6,
      fatG: 2.8 + 3,
    })
  })

  it('listede NaN veya sonsuz değer varsa hata verir', () => {
    expect(() => sumNutrients([{ ...ZERO_NUTRIENTS, proteinG: Number.NaN }])).toThrow(RangeError)
    expect(() => sumNutrients([{ ...ZERO_NUTRIENTS, energyKcal: Number.POSITIVE_INFINITY }])).toThrow(RangeError)
  })
})

describe('energyFromMacros', () => {
  it('4/4/9 katsayılarıyla hesaplar', () => {
    expect(energyFromMacros({ proteinG: 10, carbsG: 20, fatG: 5 })).toBe(165)
  })

  it('besin kaydındaki kcal değerinden ayrı bir kavramdır ve farklı çıkabilir', () => {
    // Yulaf: 4×13 + 4×60 + 9×7 = 355 kcal; kayıttaki değer 380 kcal (lif, yuvarlama vb.).
    expect(energyFromMacros(oats)).toBe(355)
    expect(energyFromMacros(oats)).not.toBe(oats.energyKcal)
  })

  it('NaN veya sonsuz değeri reddeder', () => {
    expect(() => energyFromMacros({ proteinG: Number.NaN, carbsG: 0, fatG: 0 })).toThrow(RangeError)
    expect(() => energyFromMacros({ proteinG: 0, carbsG: 0, fatG: Number.POSITIVE_INFINITY })).toThrow(RangeError)
  })
})

describe('mealTotals / dayTotals', () => {
  const foodsById = new Map([
    ['oats', oats],
    ['milk', milk],
  ])
  const meals = [
    { id: 'm1', dayNumber: 1 },
    { id: 'm2', dayNumber: 1 },
    { id: 'm3', dayNumber: 2 },
  ]
  const items = [
    { planMealId: 'm1', foodId: 'oats', quantity: 40 },
    { planMealId: 'm1', foodId: 'milk', quantity: 200 },
    { planMealId: 'm2', foodId: 'milk', quantity: 100 },
    { planMealId: 'm3', foodId: 'oats', quantity: 100 },
  ]

  it('öğün toplamı yalnızca o öğünün içeriklerini kapsar', () => {
    expect(mealTotals('m1', items, foodsById).energyKcal).toBeCloseTo(152 + 92, 10)
    expect(mealTotals('m2', items, foodsById).energyKcal).toBeCloseTo(46, 10)
    expect(mealTotals('bos', items, foodsById)).toEqual(ZERO_NUTRIENTS)
  })

  it('gün toplamı o günün tüm öğünlerini kapsar', () => {
    expect(dayTotals(1, meals, items, foodsById).energyKcal).toBeCloseTo(152 + 92 + 46, 10)
    expect(dayTotals(2, meals, items, foodsById).energyKcal).toBeCloseTo(380, 10)
    expect(dayTotals(3, meals, items, foodsById)).toEqual(ZERO_NUTRIENTS)
  })

  it('canlı hesaplar: besin değeri değişince toplam da değişir', () => {
    const updated = new Map(foodsById).set('milk', { ...milk, energyKcal: 64 })
    expect(mealTotals('m2', items, updated).energyKcal).toBeCloseTo(64, 10)
  })

  it('eksik besini sessizce sıfır saymaz', () => {
    expect(() => mealTotals('m1', [...items, { planMealId: 'm1', foodId: 'yok', quantity: 10 }], foodsById)).toThrow(
      /Besin bulunamadı/,
    )
  })
})

describe('tarif değerleri', () => {
  const base = { recipeYieldG: null }
  const foods = [
    { id: 'oats', energyKcal: 380, proteinG: 13, carbsG: 60, fatG: 7, ...base },
    { id: 'milk', energyKcal: 46, proteinG: 3.3, carbsG: 4.8, fatG: 1.5, ...base },
    { id: 'porridge', energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, recipeYieldG: 200 },
    { id: 'empty', energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, recipeYieldG: 100 },
  ]
  const ingredients = [
    { recipeId: 'porridge', foodId: 'oats', quantity: 50 },
    { recipeId: 'porridge', foodId: 'milk', quantity: 150 },
  ]

  it('tarifin 100 g değeri = malzemelerin toplamı ÷ pişmiş ağırlık × 100', () => {
    const resolved = resolveRecipeFoods(foods, ingredients)
    // Toplam: yulaf 190 kcal + süt 69 kcal = 259 kcal; 200 g pişmiş → 100 g'da 129,5 kcal.
    expect(resolved.get('porridge')!.energyKcal).toBeCloseTo(129.5)
    expect(resolved.get('porridge')!.proteinG).toBeCloseTo((6.5 + 4.95) / 2)
    expect(resolved.get('oats')).toEqual(foods[0])
    expect(resolved.get('empty')!.energyKcal).toBe(0)
    expect(ingredientsWeight(ingredients)).toBe(200)
  })

  it('malzeme güncellenince tarif değeri canlı olarak değişir', () => {
    const updated = foods.map((f) => (f.id === 'milk' ? { ...f, energyKcal: 64 } : f))
    expect(resolveRecipeFoods(updated, ingredients).get('porridge')!.energyKcal).toBeCloseTo((190 + 96) / 2)
  })
})

describe('değişim', () => {
  it('değişimde değerler 1 değişim başınadır; miktar değişim sayısıdır', () => {
    const bread = { energyKcal: 68, proteinG: 2, carbsG: 15, fatG: 0, baseUnit: 'exchange' as const }
    expect(nutrientsFor(bread, 2)).toEqual({ energyKcal: 136, proteinG: 4, carbsG: 30, fatG: 0 })
  })
})
