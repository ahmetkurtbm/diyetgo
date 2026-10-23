/**
 * Gösterim biçimlendirmesi. Zaman dilimi dönüşümü `@diyetgo/shared`'daki `TIME_ZONE` ile yapılır;
 * makinenin yerel saat dilimi kullanılmaz.
 */
import { istanbulDateOf, TIME_ZONE } from '@diyetgo/shared'

/** İstanbul saatine göre bugünün takvim günü. */
export function today(): string {
  return istanbulDateOf(new Date())
}

// Takvim günleri saat bilgisi taşımaz; UTC gece yarısı olarak yorumlanıp UTC'de biçimlendirilir.
const dateFormat = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** `2026-03-10` → `10 Mart 2026` */
export function formatDate(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`))
}

const shortDateFormat = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('tr-TR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
const weekdayDateFormat = new Intl.DateTimeFormat('tr-TR', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })

/** `2026-03-10` → `10 Mar` */
export function formatShortDate(date: string): string {
  return shortDateFormat.format(new Date(`${date}T00:00:00Z`))
}

/** UTC zaman → İstanbul saatiyle `10:00` */
export function formatTime(instant: string): string {
  return timeFormat.format(new Date(instant))
}

/** UTC zaman → İstanbul saatiyle `Sal 10 Mar` */
export function formatWeekdayDate(instant: string): string {
  return weekdayDateFormat.format(new Date(instant))
}

/** UTC zaman → İstanbul saatiyle `10 Mart 2026 10:00` */
export function formatDateTime(instant: string): string {
  return dateTimeFormat.format(new Date(instant))
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits })
}
