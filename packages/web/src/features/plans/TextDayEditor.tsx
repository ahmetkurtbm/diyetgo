/**
 * Serbest menü: seçili günün her öğünü için tamamen elle yazılan metin. Besin eşleştirmesi ve değer
 * hesabı yoktur; metin öğünün `notes` alanında saklanır. Yazım düzeltme yalnızca kutudaki metni
 * düzenler, kaydetmek için "Kaydet" gerekir.
 *
 * Yalnızca kullanıcının değiştirdiği kutular `edits` içinde tutulur; diğerleri kayıtlı değeri gösterir.
 * Böylece bir kayıt sırasında planın yeniden yüklenmesi yazılan ama henüz kaydedilmemiş metni silmez.
 */
import { correctMealText, LIMITS, type MealPlan, type MealType, type PlanMeal } from '@diyetgo/shared'
import { Save, SpellCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { TextareaField } from '../../components/ui/form'
import { Card, CardHeader } from '../../components/ui/layout'
import { useToast } from '../../components/ui/toast-context'
import { useRepositories } from '../../data/context'
import { errorMessage } from '../../lib/errors'

type Props = { plan: MealPlan; day: number; meals: PlanMeal[]; mealTypes: MealType[] }

export function TextDayEditor({ plan, day, meals, mealTypes }: Props) {
  const repositories = useRepositories()
  const toast = useToast()
  const dayMeals = meals.filter((m) => m.dayNumber === day)
  const shown = mealTypes.filter((t) => t.archivedAt === null || dayMeals.some((m) => m.mealTypeId === t.id)).sort((a, b) => a.sortOrder - b.sortOrder)
  const saved = (typeId: string) => dayMeals.find((m) => m.mealTypeId === typeId)?.notes ?? ''
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const textOf = (typeId: string) => edits[typeId] ?? saved(typeId)
  const dirty = shown.some((t) => t.id in edits && edits[t.id]!.trim() !== saved(t.id).trim())

  async function save() {
    setBusy(true)
    try {
      for (const type of shown) {
        const text = textOf(type.id).trim()
        const existing = dayMeals.find((m) => m.mealTypeId === type.id)
        if (text === '' && existing) await repositories.mealPlans.removeMeal(existing.id)
        else if (text !== '' && !existing) await repositories.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: day, mealTypeId: type.id, time: null, notes: text })
        else if (text !== '' && existing && existing.notes !== text) {
          await repositories.mealPlans.updateMeal(existing.id, { mealPlanId: plan.id, dayNumber: day, mealTypeId: type.id, time: existing.time, notes: text })
        }
      }
      setEdits({})
      toast.success(`${day}. gün kaydedildi.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-6" aria-label={`${day}. gün menüsü`}>
      <CardHeader
        title={`${day}. gün menüsü`}
        description="Her öğünü istediğiniz gibi yazın; her satır PDF'te ayrı madde olur. Besin değeri hesaplanmaz."
        actions={
          <>
            <Button size="sm" onClick={() => setEdits(Object.fromEntries(shown.map((t) => [t.id, correctMealText(textOf(t.id))])))}>
              <SpellCheck aria-hidden className="size-4" />
              Yazımı düzelt
            </Button>
            <Button size="sm" variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
              <Save aria-hidden className="size-4" />
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
        {shown.map((type) => (
          <TextareaField
            key={type.id}
            label={type.archivedAt ? `${type.name} (arşivde)` : type.name}
            aria-label={`${type.name} içeriği`}
            lang="tr"
            spellCheck
            rows={5}
            maxLength={LIMITS.notes}
            value={textOf(type.id)}
            onChange={(e) => setEdits({ ...edits, [type.id]: e.target.value })}
            placeholder={'7-8 yemek kaşığı tavuk sote\n8 yemek kaşığı pirinç pilavı\n1 küçük kase yağsız salata'}
          />
        ))}
      </div>
    </Card>
  )
}
