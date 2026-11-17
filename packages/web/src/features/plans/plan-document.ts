/** Serbest menüyü (öğünlerin `notes` alanı) dışa aktarılacak belgeye çevirir; metin düzeltilir ve sıralanır. */
import { mealLines, planDayDate, type Client, type MealPlan, type MealType, type PlanDocument, type PlanMeal } from '@diyetgo/shared'
import { formatDate, formatLongDate } from '../../lib/format'
import { fullName } from '../../lib/labels'

export function buildPlanDocument(plan: MealPlan, client: Client, meals: readonly PlanMeal[], mealTypes: readonly MealType[], dietitianName: string): PlanDocument {
  const order = new Map(mealTypes.map((t) => [t.id, t]))
  const days = [...new Set(meals.map((m) => m.dayNumber))]
    .sort((a, b) => a - b)
    .map((dayNumber) => ({
      heading: `${dayNumber}. Gün · ${formatLongDate(planDayDate(plan.startDate, dayNumber))}`,
      meals: meals
        .filter((m) => m.dayNumber === dayNumber)
        .sort((a, b) => (order.get(a.mealTypeId)?.sortOrder ?? 0) - (order.get(b.mealTypeId)?.sortOrder ?? 0))
        .map((m) => ({ name: order.get(m.mealTypeId)?.name ?? 'Öğün', lines: mealLines(m.notes) }))
        .filter((m) => m.lines.length > 0),
    }))
    .filter((day) => day.meals.length > 0)
  return {
    title: plan.title,
    clientName: fullName(client),
    dietitianName: dietitianName.trim(),
    periodLabel: plan.endDate ? `${formatDate(plan.startDate)} – ${formatDate(plan.endDate)}` : formatDate(plan.startDate),
    notes: mealLines(plan.notes),
    days,
  }
}
