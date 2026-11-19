import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyUpdate, checkForUpdate, reportUpdate, resetUpdateState, updateReady } from './app-update'

beforeEach(resetUpdateState)

const registration = (overrides: Partial<Pick<ServiceWorkerRegistration, 'installing' | 'waiting'>> = {}, update = () => Promise.resolve()) => ({
  installing: null,
  waiting: null,
  update,
  ...overrides,
})
const worker = {} as ServiceWorker

describe('uygulama güncellemesi', () => {
  it('service worker yoksa denetlenemez', async () => {
    expect(await checkForUpdate()).toBe('unsupported')
  })

  it('yeni sürüm yoksa "current" döner', async () => {
    const update = vi.fn(() => Promise.resolve())
    reportUpdate({ registration: registration({}, update) })
    expect(await checkForUpdate()).toBe('current')
    expect(update).toHaveBeenCalledTimes(1)
    expect(updateReady()).toBe(false)
  })

  it('yeni sürüm bulunup kurulunca "available" döner', async () => {
    const reg = registration({ installing: worker }, () => Promise.resolve())
    reportUpdate({ registration: reg })
    const pending = checkForUpdate()
    // Kurulum bitti: bekleyen sürüm hazır.
    setTimeout(() => Object.assign(reg, { installing: null, waiting: worker }), 50)
    expect(await pending).toBe('available')
    expect(updateReady()).toBe(true)
  })

  it('bağlantı yoksa "offline" döner', async () => {
    reportUpdate({ registration: registration({}, () => Promise.reject(new Error('ağ yok'))) })
    expect(await checkForUpdate()).toBe('offline')
  })

  it('alttaki öneri kapatılsa da bekleyen sürüm hazır sayılır ve uygulanabilir', async () => {
    const apply = vi.fn(() => Promise.resolve())
    reportUpdate({ registration: registration({ waiting: worker }), apply, needRefresh: true })
    reportUpdate({ needRefresh: false })
    expect(updateReady()).toBe(true)
    await applyUpdate()
    expect(apply).toHaveBeenCalledWith(true)
  })
})
