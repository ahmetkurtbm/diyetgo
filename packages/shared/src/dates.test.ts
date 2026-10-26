import { afterEach, describe, expect, it } from 'vitest'
import { addDays, daysBetween, istanbulDateOf, istanbulDayRangeUtc, istanbulTimeOf, istanbulTimeToUtc, TIME_ZONE } from './dates'

describe('addDays / daysBetween', () => {
  it('ay, yıl ve artık yıl geçişlerini doğru yapar', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-03-10', 0)).toBe('2026-03-10')
  })

  it('geçersiz takvim günü ve tam sayı olmayan gün sayısı için hata verir', () => {
    expect(() => addDays('2026-02-29', 1)).toThrow(RangeError)
    expect(() => addDays('2026-13-01', 1)).toThrow(RangeError)
    expect(() => addDays('10.03.2026', 1)).toThrow(RangeError)
    expect(() => addDays('2026-03-10', 1.5)).toThrow(RangeError)
    expect(() => addDays('2026-03-10', Number.NaN)).toThrow(RangeError)
  })

  it('gün farkını hesaplar', () => {
    expect(daysBetween('2026-03-10', '2026-03-10')).toBe(0)
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2)
    expect(daysBetween('2028-02-27', '2028-03-01')).toBe(3)
    expect(daysBetween('2026-03-10', '2026-03-01')).toBe(-9)
  })
})

describe('Europe/Istanbul dönüşümleri', () => {
  it('saat dilimi sabiti', () => {
    expect(TIME_ZONE).toBe('Europe/Istanbul')
  })

  it('gece yarısına yakın anları doğru takvim gününe yerleştirir', () => {
    expect(istanbulDateOf('2026-03-10T20:59:59.999Z')).toBe('2026-03-10') // 23:59:59.999
    expect(istanbulDateOf('2026-03-10T21:00:00.000Z')).toBe('2026-03-11') // 00:00
    expect(istanbulDateOf('2026-03-10T21:30:00.000Z')).toBe('2026-03-11') // 00:30
    expect(istanbulDateOf('2026-12-31T21:00:00.000Z')).toBe('2027-01-01')
    expect(istanbulDateOf(new Date('2028-02-28T21:00:00.000Z'))).toBe('2028-02-29')
  })

  it('bir anın İstanbul saatini HH:MM olarak verir', () => {
    expect(istanbulTimeOf('2026-03-10T21:30:00.000Z')).toBe('00:30')
    expect(istanbulTimeOf('2026-03-10T20:59:59.999Z')).toBe('23:59')
    expect(istanbulTimeOf(new Date('2026-03-10T07:05:00.000Z'))).toBe('10:05')
    expect(istanbulTimeOf('2015-01-15T08:00:00.000Z')).toBe('10:00') // 2016 öncesi UTC+2
    expect(() => istanbulTimeOf('saat')).toThrow(RangeError)
  })

  it('istanbulTimeOf ve istanbulTimeToUtc gidiş-dönüş tutarlıdır', () => {
    for (const [date, h, m] of [['2026-03-11', 0, 0], ['2026-03-11', 23, 59], ['2028-02-29', 12, 30]] as const) {
      const utc = istanbulTimeToUtc(date, h, m)
      expect(istanbulDateOf(utc)).toBe(date)
      expect(istanbulTimeOf(utc)).toBe(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  })

  it('İstanbul saatini UTC zamana çevirir', () => {
    expect(istanbulTimeToUtc('2026-03-11', 0, 30)).toBe('2026-03-10T21:30:00.000Z')
    expect(istanbulTimeToUtc('2026-03-11', 23, 59)).toBe('2026-03-11T20:59:00.000Z')
    expect(istanbulTimeToUtc('2027-01-01', 0, 0)).toBe('2026-12-31T21:00:00.000Z')
  })

  it('Türkiye yaz saati uygulamasının sona erdiği 2016 öncesi ofsetleri de doğru hesaplar', () => {
    expect(istanbulTimeToUtc('2015-01-15', 0, 0)).toBe('2015-01-14T22:00:00.000Z') // UTC+2
    expect(istanbulTimeToUtc('2015-07-15', 0, 0)).toBe('2015-07-14T21:00:00.000Z') // UTC+3
  })

  it('günün UTC aralığı yarı açıktır ve gidiş-dönüş tutarlıdır', () => {
    const range = istanbulDayRangeUtc('2026-03-11')
    expect(range).toEqual({ start: '2026-03-10T21:00:00.000Z', end: '2026-03-11T21:00:00.000Z' })
    for (const date of ['2026-03-11', '2026-12-31', '2028-02-29', '2027-01-01']) {
      const { start, end } = istanbulDayRangeUtc(date)
      expect(istanbulDateOf(start)).toBe(date)
      expect(istanbulDateOf(new Date(Date.parse(end) - 1))).toBe(date)
      expect(istanbulDateOf(end)).toBe(addDays(date, 1))
    }
  })

  it('geçersiz girdiler için hata verir', () => {
    expect(() => istanbulDateOf('bugün')).toThrow(RangeError)
    expect(() => istanbulDateOf(new Date(Number.NaN))).toThrow(RangeError)
    expect(() => istanbulTimeToUtc('2026-03-11', 24, 0)).toThrow(RangeError)
    expect(() => istanbulTimeToUtc('2026-03-11', 10, 60)).toThrow(RangeError)
    expect(() => istanbulTimeToUtc('2026-02-30', 10, 0)).toThrow(RangeError)
  })
})

// Shared paketi Node tiplerini kullanmaz; test yalnızca TZ değişkenine erişir.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env

describe('makinenin saat diliminden bağımsızlık', () => {
  const originalTz = env.TZ
  afterEach(() => {
    if (originalTz === undefined) delete env.TZ
    else env.TZ = originalTz
  })

  // Ocak 2026 için `getTimezoneOffset` değerleri (dakika, UTC'nin gerisindeyse pozitif).
  const zones: [string, number][] = [
    ['UTC', 0],
    ['America/New_York', 300],
    ['Asia/Tokyo', -540],
    ['Pacific/Kiritimati', -840],
  ]

  it.each(zones)('TZ=%s iken sonuçlar aynıdır', (tz, expectedOffset) => {
    env.TZ = tz
    // Kendi kendini doğrulama: TZ değişikliği bu süreçte gerçekten etkili olmazsa test burada başarısız olur.
    expect(new Date('2026-01-15T12:00:00.000Z').getTimezoneOffset()).toBe(expectedOffset)

    expect(istanbulDateOf('2026-03-10T20:59:59.999Z')).toBe('2026-03-10')
    expect(istanbulDateOf('2026-03-10T21:00:00.000Z')).toBe('2026-03-11')
    expect(istanbulTimeToUtc('2026-03-11', 0, 30)).toBe('2026-03-10T21:30:00.000Z')
    expect(istanbulTimeOf('2026-03-10T21:30:00.000Z')).toBe('00:30')
    expect(istanbulDayRangeUtc('2026-12-31')).toEqual({ start: '2026-12-30T21:00:00.000Z', end: '2026-12-31T21:00:00.000Z' })
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  })
})
