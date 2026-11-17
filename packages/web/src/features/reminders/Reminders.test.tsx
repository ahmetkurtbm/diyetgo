import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixDate, renderApp, SEED_IDS, TEST_NOW } from '../../test-utils'

fixDate()

type Shown = { title: string; body: string | undefined; tag: string | undefined }

function stubNotification(permission: NotificationPermission) {
  const shown: Shown[] = []
  const requestPermission = vi.fn(() => {
    Stub.permission = 'granted'
    return Promise.resolve<NotificationPermission>('granted')
  })
  class Stub {
    static permission = permission
    static requestPermission = requestPermission
    constructor(title: string, options?: NotificationOptions) {
      shown.push({ title, body: options?.body, tag: options?.tag })
    }
  }
  vi.stubGlobal('Notification', Stub)
  return { shown, requestPermission }
}

const minutesFromNow = (minutes: number) => new Date(TEST_NOW.getTime() + minutes * 60_000).toISOString()

async function createAppointment(repositories: ReturnType<typeof renderApp>['repositories'], startsInMinutes: number) {
  return repositories.appointments.create({ clientId: SEED_IDS.deniz, startsAt: minutesFromNow(startsInMinutes), endsAt: minutesFromNow(startsInMinutes + 30), status: 'scheduled', notes: null })
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('Randevu hatırlatıcıları', () => {
  it('randevuya 1 saat kala sistem bildirimi gösterir ve ekranda uyarır; aynı hatırlatmayı tekrarlamaz', async () => {
    const { shown } = stubNotification('granted')
    const { repositories, unmount, storage } = renderApp('/')
    await screen.findByRole('heading', { name: 'Genel bakış' })
    // 59 dk sonraki randevunun "1 saat önce" anı 1 dk önce geçti: kayma payı içinde, hemen gösterilir.
    await createAppointment(repositories, 59)

    expect(await screen.findByText(/Randevuya 1 saat var: Deniz Örnek/)).toBeDefined()
    await waitFor(() => expect(shown).toHaveLength(1))
    expect(shown[0]).toMatchObject({ title: 'Randevuya 1 saat var', body: expect.stringContaining('Deniz Örnek') })
    expect(JSON.parse(localStorage.getItem('diyetgo:reminders:fired')!)).toHaveLength(1)

    // Sayfa yenilenince (aynı depolama) aynı hatırlatma yeniden gösterilmez.
    unmount()
    renderApp('/', storage)
    await screen.findByRole('heading', { name: 'Genel bakış' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(shown).toHaveLength(1)
  })

  it('randevu saati geldiğinde ayrıca hatırlatır', async () => {
    const { shown } = stubNotification('granted')
    const { repositories } = renderApp('/')
    await screen.findByRole('heading', { name: 'Genel bakış' })
    // 1 dk önce başlayan randevunun başlangıç anı kayma payı içindedir; 1 saat önceki hatırlatma payın dışındadır.
    await createAppointment(repositories, -1)
    await waitFor(() => expect(shown.map((n) => n.title)).toContain('Randevu saati geldi'), { timeout: 3000 })
  })

  it('hatırlatıcılar kapatılmışsa veya randevu iptal edilmişse hiçbir şey göstermez', async () => {
    const { shown } = stubNotification('default')
    localStorage.setItem('diyetgo:reminders:enabled', 'false')
    const { repositories } = renderApp('/')
    await screen.findByRole('heading', { name: 'Genel bakış' })
    await createAppointment(repositories, 59)
    const cancelled = await createAppointment(repositories, 200)
    await repositories.appointments.update(cancelled.id, { ...cancelled, status: 'cancelled' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(screen.queryByText(/Randevuya 1 saat var/)).toBeNull()
    expect(shown).toHaveLength(0)
  })

  it('izin istemi bildirim iznini ister ve kabul edilince kapanır', async () => {
    const { requestPermission } = stubNotification('default')
    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Bildirimlere izin ver' }))
    expect(requestPermission).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Randevu bildirimleri' })).toBeNull())
  })
})
