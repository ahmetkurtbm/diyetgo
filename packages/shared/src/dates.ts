/**
 * Takvim günü (`YYYY-MM-DD`) ve zaman (UTC ISO 8601) işlemleri.
 *
 * Kurallar:
 * - Zamanlar UTC olarak saklanır, arayüzde `Europe/Istanbul` ile gösterilir.
 * - Takvim günleri saat bilgisi taşımaz.
 * - Buradaki fonksiyonlar makinenin yerel saat dilimini hiç kullanmaz; yalnızca UTC metotları
 *   ve açık `timeZone` verilmiş `Intl` biçimlendiricileri kullanılır.
 */

export const TIME_ZONE = 'Europe/Istanbul'

const MS_PER_DAY = 86_400_000
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Takvim gününü UTC gece yarısındaki milisaniyeye çevirir; geçersiz günler (ör. 2026-02-30) hata verir. */
function dateToUtcMs(date: string): number {
  const match = DATE_PATTERN.exec(date)
  if (match) {
    const [, y, m, d] = match.map(Number) as [number, number, number, number]
    const ms = Date.UTC(y, m - 1, d)
    if (new Date(ms).toISOString().startsWith(date)) return ms
  }
  throw new RangeError(`Geçersiz takvim günü: ${date}`)
}

function utcMsToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function instantToMs(instant: string): number {
  const ms = Date.parse(instant)
  if (Number.isNaN(ms)) throw new RangeError(`Geçersiz zaman: ${instant}`)
  return ms
}

export function addDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new RangeError(`Gün sayısı tam sayı olmalı (gelen: ${days})`)
  return utcMsToDate(dateToUtcMs(date) + days * MS_PER_DAY)
}

/** `to − from` gün farkı; `to` önceyse negatiftir. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / MS_PER_DAY)
}

const istanbulParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Verilen andaki İstanbul duvar saatini, aynı rakamlara sahip bir UTC milisaniyesi olarak döndürür. */
function istanbulWallClockMs(ms: number): number {
  const parts: Record<string, number> = {}
  for (const { type, value } of istanbulParts.formatToParts(ms)) parts[type] = Number(value)
  return Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!)
}

/** Bir anın İstanbul'daki takvim günü. Örn. `2026-03-10T21:30:00Z` → `2026-03-11`. */
export function istanbulDateOf(instant: string | Date): string {
  const ms = typeof instant === 'string' ? instantToMs(instant) : instant.getTime()
  if (Number.isNaN(ms)) throw new RangeError('Geçersiz zaman')
  return utcMsToDate(istanbulWallClockMs(ms))
}

/** Bir anın İstanbul'daki saati, `HH:MM`. Örn. `2026-03-10T21:30:00Z` → `00:30`. */
export function istanbulTimeOf(instant: string | Date): string {
  const ms = typeof instant === 'string' ? instantToMs(instant) : instant.getTime()
  if (Number.isNaN(ms)) throw new RangeError('Geçersiz zaman')
  return new Date(istanbulWallClockMs(ms)).toISOString().slice(11, 16)
}

/** İstanbul'da verilen gün ve saatin UTC karşılığı (ISO 8601, `Z`). */
export function istanbulTimeToUtc(date: string, hour: number, minute: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError(`Geçersiz saat: ${hour}:${minute}`)
  }
  const wallMs = dateToUtcMs(date) + (hour * 60 + minute) * 60_000
  // Ofset, ilk tahmindeki ana göre bulunur ve bir kez düzeltilir; böylece olası yaz saati
  // geçişlerinde de doğru sonuç verir (Türkiye 2016'dan beri sabit UTC+3 kullanır).
  let utcMs = wallMs - (istanbulWallClockMs(wallMs) - wallMs)
  utcMs = wallMs - (istanbulWallClockMs(utcMs) - utcMs)
  return new Date(utcMs).toISOString()
}

/**
 * İstanbul'daki bir takvim gününün UTC aralığı, yarı açık: `[start, end)`.
 * "Bugünkü randevular" gibi filtrelerde `start <= zaman < end` kullanılmalıdır.
 */
export function istanbulDayRangeUtc(date: string): { start: string; end: string } {
  return { start: istanbulTimeToUtc(date, 0, 0), end: istanbulTimeToUtc(addDays(date, 1), 0, 0) }
}
