/**
 * Besin değeri hesaplamaları.
 *
 * Besin değerleri 100 g veya 100 ml başına saklanır; miktarlar besinin temel biriminde (g/ml) verilir.
 * Toplamlar canlı hesaplanır: bir besin güncellenirse onu kullanan planların toplamları da değişir.
 *
 * İki ayrı enerji kavramı vardır:
 * - `energyKcal`: Besin kaydındaki (etiket veya kaynak) enerji değerinden hesaplanır. Toplamlarda
 *   kullanılan değer budur.
 * - `energyFromMacros`: Protein, karbonhidrat ve yağdan genel Atwater katsayılarıyla (4/4/9)
 *   hesaplanan tahmindir. Lif, alkol, şeker alkolleri, besine özgü katsayılar ve yuvarlama
 *   nedeniyle `energyKcal` ile farklı çıkabilir; biri diğerinin yerine kullanılmaz.
 */
import { assertFinite } from './numbers'
import type { Food, PlanMeal, PlanMealItem } from './schemas'

export type Nutrients = { energyKcal: number; proteinG: number; carbsG: number; fatG: number }

type NutrientValues = Pick<Food, 'energyKcal' | 'proteinG' | 'carbsG' | 'fatG'>
type ItemAmount = Pick<PlanMealItem, 'foodId' | 'quantity'>

export const ZERO_NUTRIENTS: Readonly<Nutrients> = Object.freeze({ energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })

/** Bir besinin verilen miktardaki değerleri: `100 birimdeki değer × miktar / 100`. Yuvarlama yapılmaz. */
export function nutrientsFor(food: NutrientValues, quantity: number): Nutrients {
  assertFinite(quantity, 'quantity')
  if (quantity < 0) throw new RangeError('Miktar negatif olamaz')
  const factor = quantity / 100
  const result = {} as Nutrients
  for (const key of Object.keys(ZERO_NUTRIENTS) as (keyof Nutrients)[]) {
    assertFinite(food[key], key)
    result[key] = food[key] * factor
  }
  return result
}

export function sumNutrients(list: readonly Nutrients[]): Nutrients {
  const total = { ...ZERO_NUTRIENTS }
  for (const n of list) {
    for (const key of Object.keys(total) as (keyof Nutrients)[]) {
      assertFinite(n[key], key)
      total[key] += n[key]
    }
  }
  return total
}

/** Makrolardan genel Atwater katsayılarıyla (4/4/9) hesaplanan enerji; bkz. dosya başındaki açıklama. */
export function energyFromMacros(n: Pick<Nutrients, 'proteinG' | 'carbsG' | 'fatG'>): number {
  assertFinite(n.proteinG, 'proteinG')
  assertFinite(n.carbsG, 'carbsG')
  assertFinite(n.fatG, 'fatG')
  return 4 * n.proteinG + 4 * n.carbsG + 9 * n.fatG
}

function itemsTotals(items: readonly ItemAmount[], foodsById: ReadonlyMap<string, NutrientValues>): Nutrients {
  return sumNutrients(
    items.map((item) => {
      const food = foodsById.get(item.foodId)
      // Eksik besin sessizce 0 sayılırsa toplamlar yanlış ama geçerli görünür.
      if (!food) throw new Error(`Besin bulunamadı: ${item.foodId}`)
      return nutrientsFor(food, item.quantity)
    }),
  )
}

/** Bir öğünün toplamı. */
export function mealTotals(
  planMealId: string,
  items: readonly (ItemAmount & Pick<PlanMealItem, 'planMealId'>)[],
  foodsById: ReadonlyMap<string, NutrientValues>,
): Nutrients {
  return itemsTotals(items.filter((i) => i.planMealId === planMealId), foodsById)
}

/** Bir plan gününün toplamı. `meals` tek bir plana ait olmalıdır. */
export function dayTotals(
  dayNumber: number,
  meals: readonly Pick<PlanMeal, 'id' | 'dayNumber'>[],
  items: readonly (ItemAmount & Pick<PlanMealItem, 'planMealId'>)[],
  foodsById: ReadonlyMap<string, NutrientValues>,
): Nutrients {
  const mealIds = new Set(meals.filter((m) => m.dayNumber === dayNumber).map((m) => m.id))
  return itemsTotals(items.filter((i) => mealIds.has(i.planMealId)), foodsById)
}
