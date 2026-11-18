/**
 * Serbest menünün "Öneriler" bölümü: tüm plan için tamamen elle yazılır (ör. günde su miktarı, haftalık
 * sebze/balık/baklagil sıklığı) ve PDF'te şekilli ayrı bir bölüm olur. Plan geneli olduğu için planın
 * `notes` alanında tutulur.
 */
import { correctMealText, LIMITS, type MealPlan } from '@diyetgo/shared'
import { Save, SpellCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { TextareaField } from '../../components/ui/form'
import { Card, CardHeader } from '../../components/ui/layout'
import { useToast } from '../../components/ui/toast-context'
import { useRepositories } from '../../data/context'
import { errorMessage } from '../../lib/errors'

export function TextRecommendationsEditor({ plan }: { plan: MealPlan }) {
  const repositories = useRepositories()
  const toast = useToast()
  const [text, setText] = useState(plan.notes ?? '')
  const [busy, setBusy] = useState(false)
  const dirty = text.trim() !== (plan.notes ?? '').trim()

  async function save() {
    setBusy(true)
    try {
      const { clientId, title, startDate, endDate, kind, weeklyQuotas } = plan
      await repositories.mealPlans.update(plan.id, { clientId, title, startDate, endDate, kind, weeklyQuotas, notes: text.trim() === '' ? null : text.trim() })
      toast.success('Öneriler kaydedildi.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-6" aria-label="Öneriler">
      <CardHeader
        title="Öneriler"
        description="Her satır PDF'te simgeli ayrı bir öneri olur. Menünün altında şekilli bir bölüm olarak çıkar."
        actions={
          <>
            <Button size="sm" onClick={() => setText(correctMealText(text))}>
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
      <div className="px-5 py-4">
        <TextareaField
          label="Öneri metni"
          aria-label="Öneriler içeriği"
          lang="tr"
          spellCheck
          rows={5}
          maxLength={LIMITS.notes}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Günde 2-2,5 litre su için\nHaftada 2 gün sebze yemeği\nHaftada 2 gün balık\nHaftada 3-4 gün kuru baklagil'}
        />
      </div>
    </Card>
  )
}
