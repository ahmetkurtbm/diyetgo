import { describe, expect, it } from 'vitest'
import { REMINDER_LEAD_MS, upcomingReminders } from './reminders'

const now = new Date('2026-03-10T09:00:00.000Z')
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString()
const appt = (id: string, startsAt: string, status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' = 'scheduled') => ({ id, startsAt, status })

describe('upcomingReminders', () => {
  it('her planlanmış randevu için 1 saat önce ve başlangıç hatırlatması üretir, zamana göre sıralar', () => {
    const list = upcomingReminders([appt('b', at(240)), appt('a', at(90))], now)
    expect(list.map((r) => [r.appointmentId, r.kind, r.at])).toEqual([
      ['a', 'hour_before', at(30)],
      ['a', 'start', at(90)],
      ['b', 'hour_before', at(180)],
      ['b', 'start', at(240)],
    ])
    expect(REMINDER_LEAD_MS).toBe(3_600_000)
  })

  it('geçmişte kalanları atar; kısa süre önce geçenleri (kayma payı) korur', () => {
    // Randevuya 30 dk var: 1 saat önceki hatırlatma geçti ve payın dışında → yalnızca başlangıç.
    expect(upcomingReminders([appt('a', at(30))], now).map((r) => r.kind)).toEqual(['start'])
    // Randevu 30 sn önce başladı: başlangıç hatırlatması pay içinde.
    expect(upcomingReminders([appt('a', at(-0.5))], now).map((r) => r.kind)).toEqual(['start'])
    // 5 dk önce başladı: hiçbiri.
    expect(upcomingReminders([appt('a', at(-5))], now)).toEqual([])
  })

  it('yalnızca planlanmış randevuları hatırlatır', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as const) expect(upcomingReminders([appt('a', at(120), status)], now)).toEqual([])
  })

  it('ufuk dışındakileri atar ve randevu saati değişince yeni anahtar üretir', () => {
    expect(upcomingReminders([appt('a', at(26 * 60))], now)).toEqual([])
    expect(upcomingReminders([appt('a', at(26 * 60))], now, { horizonMs: 48 * 3_600_000 })).toHaveLength(2)
    const before = upcomingReminders([appt('a', at(120))], now)[0]!.key
    const moved = upcomingReminders([appt('a', at(150))], now)[0]!.key
    expect(moved).not.toBe(before)
  })
})
