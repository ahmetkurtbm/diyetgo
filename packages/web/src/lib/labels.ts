import { ageOn, type AppointmentStatus, type Client, type Sex } from '@diyetgo/shared'
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

export function fullName(client: Pick<Client, 'firstName' | 'lastName'>): string {
  return `${client.firstName} ${client.lastName}`
}
