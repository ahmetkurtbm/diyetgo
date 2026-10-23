/**
 * Gösterim biçimlendirmesi. Zaman dilimi dönüşümü `@diyetgo/shared`'daki `TIME_ZONE` ile yapılır;
 * makinenin yerel saat dilimi kullanılmaz.
 */
import { TIME_ZONE } from '@diyetgo/shared'

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

/** UTC zaman → İstanbul saatiyle `10 Mart 2026 10:00` */
export function formatDateTime(instant: string): string {
  return dateTimeFormat.format(new Date(instant))
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits })
}
