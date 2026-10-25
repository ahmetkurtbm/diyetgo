/** Planda kullanılan değişimlerin değerleri ve danışan için eşdeğer örnekleri. */
import { exchangeEquivalents, nutrientsFor, type Food, type PlanMealItem } from '@diyetgo/shared'
import { Card, CardHeader } from '../../components/ui/layout'
import { NutrientLine } from './NutrientSummary'

export function ExchangeGuide({ items, foodsById }: { items: PlanMealItem[]; foodsById: ReadonlyMap<string, Food> }) {
  const used = [...new Set(items.map((i) => i.foodId))]
    .map((id) => foodsById.get(id))
    .filter((f): f is Food => f?.baseUnit === 'exchange')
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  if (used.length === 0) return null
  return (
    <Card className="mt-6" aria-label="Değişim listesi">
      <CardHeader title="Değişim listesi" description="Danışan her değişimi aynı gruptaki eşdeğerlerinden biriyle karşılar. Değerler yaklaşıktır." />
      <ul className="divide-y divide-slate-100">
        {used.map((food) => {
          const equivalents = exchangeEquivalents(food.name)
          return (
            <li key={food.id} className="px-5 py-3">
              <p className="text-sm font-semibold text-slate-900">
                1 {food.name.toLocaleLowerCase('tr-TR')} <NutrientLine totals={nutrientsFor(food, 1)} />
              </p>
              {equivalents.length > 0 && <p className="mt-1 text-sm text-slate-600">{equivalents.join(' · ')}</p>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
