/**
 * Uygulama açıkken randevu hatırlatıcılarını kurar: randevudan 1 saat önce ve randevu saatinde sistem
 * bildirimi, ses ve ekranda uyarı. Uygulama kapalıyken bildirim gelmez (bunun için sunucudan
 * gönderilen push gerekir; backend henüz yayında değil).
 */
import { upcomingReminders, type Client } from '@diyetgo/shared'
import { useEffect, useState } from 'react'
import { useToast } from '../../components/ui/toast-context'
import { useRepositoryQuery } from '../../data/context'
import { playChime } from '../../lib/chime'
import { formatTime } from '../../lib/format'
import { fullName } from '../../lib/labels'
import { firedKeys, markFired, remindersEnabled, showSystemNotification } from './reminder-settings'

const HORIZON_MS = 25 * 60 * 60 * 1000
const GRACE_MS = 2 * 60 * 1000
/** Zaman penceresi ilerlesin diye liste bu aralıkla yeniden yüklenir. */
const REFRESH_MS = 30 * 60 * 1000

export function reminderMessage(kind: 'hour_before' | 'start', client: Pick<Client, 'firstName' | 'lastName'> | undefined, startsAt: string) {
  const name = client ? fullName(client) : 'Danışan'
  return { title: kind === 'hour_before' ? 'Randevuya 1 saat var' : 'Randevu saati geldi', body: `${name} · ${formatTime(startsAt)}` }
}

export function useAppointmentReminders(): void {
  const toast = useToast()
  const [tick, setTick] = useState(0)
  const query = useRepositoryQuery(
    async (r) => {
      const now = Date.now()
      const [appointments, clients] = await Promise.all([
        r.appointments.list({ from: new Date(now - GRACE_MS).toISOString(), to: new Date(now + HORIZON_MS).toISOString(), status: 'scheduled' }),
        r.clients.list({ includeArchived: true }),
      ])
      return { appointments, clients }
    },
    [tick],
  )

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const data = query.data
  useEffect(() => {
    if (!data) return
    const clients = new Map(data.clients.map((c) => [c.id, c]))
    const appointments = new Map(data.appointments.map((a) => [a.id, a]))
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const reminder of upcomingReminders(data.appointments, new Date(), { horizonMs: HORIZON_MS, graceMs: GRACE_MS })) {
      const delay = Math.max(0, Date.parse(reminder.at) - Date.now())
      timers.push(
        setTimeout(() => {
          // Kullanıcı kapatmışsa veya aynı hatırlatma (ör. başka sekmede) gösterilmişse atlanır.
          if (!remindersEnabled() || firedKeys().has(reminder.key)) return
          markFired(reminder.key)
          const appointment = appointments.get(reminder.appointmentId)
          const { title, body } = reminderMessage(reminder.kind, appointment && clients.get(appointment.clientId), reminder.startsAt)
          void showSystemNotification(title, body, reminder.key)
          void playChime()
          toast.success(`${title}: ${body}`)
        }, delay),
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [data, toast])
}
