import { ageOn, type AppointmentStatus, type Client, type MealPlan, type Sex } from '@diyetgo/shared'
import { today } from './format'

/** Bugüne göre yaş; doğum tarihi yoksa veya gelecekteyse `—`. */
export function ageLabel(client: Pick<Client, 'birthDate'>): string {
  const date = today()
  return client.birthDate && client.birthDate <= date ? `${ageOn(client.birthDate, date)} yaş` : '—'
}

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

export function fullName(client: Pick<Client, 'firstName' | 'lastName'>): string {
  return `${client.firstName} ${client.lastName}`
}
