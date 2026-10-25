import { ageOn, isGoalActiveOn, type AppointmentStatus, type Client, type ClientGoal, type CookingMethod, type Food, type MealPlan, type Sex } from '@diyetgo/shared'
import { today } from './format'

/** Bugüne göre yaş; doğum tarihi yoksa veya gelecekteyse `—`. */
export function ageLabel(client: Pick<Client, 'birthDate'>): string {
  const date = today()
  return client.birthDate && client.birthDate <= date ? `${ageOn(client.birthDate, date)} yaş` : '—'
}

/** Miktarın birimi; değişimde miktar değişim sayısıdır. */
export const baseUnitLabels: Record<Food['baseUnit'], string> = { g: 'g', ml: 'ml', exchange: 'değişim' }

/** Besin değerlerinin hangi miktar için olduğu. */
export const perUnitLabel = (unit: Food['baseUnit']) => (unit === 'exchange' ? '1 değişim başına' : `100 ${unit} başına`)

export const sexLabels: Record<Sex, string> = { female: 'Kadın', male: 'Erkek' }

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'Planlandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
  no_show: 'Gelmedi',
}

export const appointmentStatusTones = {
  scheduled: 'info',
  completed: 'brand',
  cancelled: 'neutral',
  no_show: 'warning',
} as const satisfies Record<AppointmentStatus, string>

export type PlanStatus = 'archived' | 'upcoming' | 'active' | 'finished'

/** Planın verilen güne göre durumu; "aktif" saklanmaz, tarihlerden türetilir (CLAUDE.md §4.4). */
export function planStatus(plan: Pick<MealPlan, 'startDate' | 'endDate' | 'archivedAt'>, date: string): PlanStatus {
  if (plan.archivedAt !== null) return 'archived'
  if (date < plan.startDate) return 'upcoming'
  if (plan.endDate !== null && plan.endDate < date) return 'finished'
  return 'active'
}

export const planStatusLabels: Record<PlanStatus, string> = {
  archived: 'Arşivde',
  upcoming: 'Başlamadı',
  active: 'Devam ediyor',
  finished: 'Tamamlandı',
}

export const planStatusTones = {
  archived: 'neutral',
  upcoming: 'info',
  active: 'brand',
  finished: 'neutral',
} as const satisfies Record<PlanStatus, string>

export const goalMethodLabels: Record<ClientGoal['method'], string> = {
  manual: 'Elle girildi',
  mifflin_st_jeor: 'Mifflin-St Jeor',
}

export type GoalStatus = 'active' | 'upcoming' | 'past'

/** Hedefin verilen güne göre durumu; dönem `validFrom` ve `validTo` dahil kapalı aralıktır. */
export function goalStatus(goal: Pick<ClientGoal, 'validFrom' | 'validTo'>, date: string): GoalStatus {
  if (isGoalActiveOn(goal, date)) return 'active'
  return date < goal.validFrom ? 'upcoming' : 'past'
}

export const goalStatusLabels: Record<GoalStatus, string> = { active: 'Aktif', upcoming: 'Başlamadı', past: 'Sona erdi' }

export const goalStatusTones = { active: 'brand', upcoming: 'info', past: 'neutral' } as const satisfies Record<GoalStatus, string>

export function fullName(client: Pick<Client, 'firstName' | 'lastName'>): string {
  return `${client.firstName} ${client.lastName}`
}

export const cookingMethodLabels: Record<CookingMethod, string> = {
  raw: 'Çiğ',
  boiled: 'Haşlama',
  steamed: 'Buharda',
  grilled: 'Izgara',
  baked: 'Fırında',
  sauteed: 'Sote / kavurma',
  stewed: 'Tencerede (sulu)',
  fried: 'Kızartma (yağda)',
}
