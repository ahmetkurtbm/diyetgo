import { describe, expect, it } from 'vitest'
import { isBackupDue } from './backup'

describe('haftalık yedek hatırlatması', () => {
  const now = new Date('2026-03-10T09:00:00.000Z')
  it('son yedekten (yoksa örnek verilerden) bir hafta sonra hatırlatır', () => {
    expect(isBackupDue({ seededAt: '2026-03-05T09:00:00.000Z', lastBackupAt: null }, now)).toBe(false)
    expect(isBackupDue({ seededAt: '2026-03-01T09:00:00.000Z', lastBackupAt: null }, now)).toBe(true)
    expect(isBackupDue({ seededAt: '2026-01-01T09:00:00.000Z', lastBackupAt: '2026-03-08T09:00:00.000Z' }, now)).toBe(false)
    expect(isBackupDue({ seededAt: '2026-01-01T09:00:00.000Z', lastBackupAt: '2026-03-03T09:00:00.000Z' }, now)).toBe(true)
  })
})
