/**
 * Randevu hatırlatıcıları: her planlanmış randevu için iki hatırlatma vardır; randevudan 1 saat önce
 * ve randevu saatinde. Zamanlama saf bir fonksiyondur; bildirim ve ses web paketinde gösterilir.
 */
import type { Appointment } from './schemas'

export type ReminderKind = 'hour_before' | 'start'
export type Reminder = {
  /** Aynı hatırlatmanın iki kez gösterilmemesi için anahtar; randevu saati değişirse yeni anahtar olur. */
  key: string
  appointmentId: string
  kind: ReminderKind
  /** Hatırlatmanın gösterileceği an (UTC ISO). */
  at: string
  startsAt: string
}

export const REMINDER_LEAD_MS = 60 * 60 * 1000

/**
 * `now`dan itibaren `horizonMs` içindeki hatırlatmalar, zamana göre sıralı. Yalnızca `scheduled`
 * randevular için; tamamlanan, iptal edilen ve gelmeyen randevular hatırlatılmaz. Zamanı en çok
 * `graceMs` önce geçmiş hatırlatmalar da gelir (zamanlayıcı kayması, uygulamanın az önce açılması).
 */
export function upcomingReminders(
  appointments: readonly Pick<Appointment, 'id' | 'startsAt' | 'status'>[],
  now: Date,
  { horizonMs = 24 * 60 * 60 * 1000, graceMs = 60_000 }: { horizonMs?: number; graceMs?: number } = {},
): Reminder[] {
  const from = now.getTime() - graceMs
  const to = now.getTime() + horizonMs
  const reminders: Reminder[] = []
  for (const appointment of appointments) {
    if (appointment.status !== 'scheduled') continue
    const start = Date.parse(appointment.startsAt)
    for (const [kind, at] of [['hour_before', start - REMINDER_LEAD_MS], ['start', start]] as const) {
      if (at < from || at > to) continue
      reminders.push({ key: `${appointment.id}:${kind}:${appointment.startsAt}`, appointmentId: appointment.id, kind, at: new Date(at).toISOString(), startsAt: appointment.startsAt })
    }
  }
  return reminders.sort((a, b) => a.at.localeCompare(b.at))
}
