import { EXCHANGE_GROUPS, FOOD_CATALOG } from '@diyetgo/shared'
import { createSeedData } from '@diyetgo/shared/seed'
import { describe, expect, it, vi } from 'vitest'
import { RepositoryError } from '../repositories'
import { MemoryStorage } from './memory-storage'
import { clearDemoStorage, openDemoStore, STORAGE_KEY, type DemoStore } from './store'

const NOW = new Date('2026-03-10T09:00:00.000Z')
const now = () => NOW

function open(storage: Storage | null): DemoStore {
  const result = openDemoStore({ storage, now })
  if (!result.ok) throw new Error(result.error.message)
  return result.store
}

describe('ilk açılış ve kalıcılık', () => {
  it('ilk açılışta seed verisini bir kez yazar', () => {
    const storage = new MemoryStorage()
    const store = open(storage)
    expect(store.persistent).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(store.read().data).toEqual(createSeedData('2026-03-10'))
    expect(store.read().seededAt).toBe(NOW.toISOString())
  })

  it('sonraki açılışlarda (sayfa yenileme) kullanıcı verilerini ezmez', () => {
    const storage = new MemoryStorage()
    const first = open(storage)
    const data = first.read().data
    data.clients[0]!.firstName = 'Değiştirildi'
    data.foods = []
    first.write(data)

    // Farklı bir günde yeniden açılsa bile seed tekrar yazılmaz.
    const later = openDemoStore({ storage, now: () => new Date('2026-04-01T09:00:00.000Z') })
    if (!later.ok) throw new Error('açılamadı')
    expect(later.store.read().data.clients[0]!.firstName).toBe('Değiştirildi')
    expect(later.store.read().data.foods).toEqual([])
    expect(later.store.read().seededAt).toBe(NOW.toISOString())
  })

  it('her okumada bağımsız bir kopya döndürür', () => {
    const store = open(new MemoryStorage())
    store.read().data.clients.length = 0
    expect(store.read().data.clients.length).toBeGreaterThan(0)
  })

  it('localStorage yoksa bellekte çalışır ve kalıcı olmadığını bildirir', () => {
    const store = open(null)
    expect(store.persistent).toBe(false)
    expect(store.read().data.clients.length).toBeGreaterThan(0)
  })
})

describe('bozuk veya tanınmayan veri asla ezilmez', () => {
  it.each([
    ['bozuk JSON', '{bozuk', 'corrupt'],
    ['JSON olmayan değer', '42', 'corrupt'],
    ['bilinmeyen sürüm', JSON.stringify({ version: 99, seededAt: NOW.toISOString(), data: {} }), 'unsupported_version'],
    ['eksik koleksiyon', JSON.stringify({ version: 1, seededAt: NOW.toISOString(), data: { clients: [] } }), 'invalid'],
  ])('%s', (_name, raw, reason) => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, raw)
    const result = openDemoStore({ storage, now })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.reason).toBe(reason)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it('şemaya uymayan kayıt içeren veriyi reddeder ve korur', () => {
    const storage = new MemoryStorage()
    const data = createSeedData('2026-03-10')
    data.foods[0]!.energyKcal = -5
    const raw = JSON.stringify({ version: 7, seededAt: NOW.toISOString(), data })
    storage.setItem(STORAGE_KEY, raw)
    const result = openDemoStore({ storage, now })
    expect(result.ok).toBe(false)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })
})

describe('sürüm yükseltme', () => {
  /** Sürüm 1 biçimi: uyluk çevresi, ilaç/hastalık/öneri, pişirme yöntemi ve tarifler yok. */
  function versionOneData() {
    const { clientMedications: _m, clientConditions: _c, clientRecommendations: _r, recipeIngredients: _i, ...data } = createSeedData('2026-03-10')
    return {
      ...data,
      measurements: data.measurements.map(({ thighCm: _t, ...m }) => m),
      // Sürüm 1'de tarif ve başlangıç besin listesi yoktu: yalnızca ilk 15 örnek besin.
      foods: data.foods.slice(0, 15).map(({ cookingMethod: _cm, recipeYieldG: _y, ...f }) => f),
      mealPlans: data.mealPlans.filter((p) => p.kind === 'daily').map(({ kind: _k, weeklyQuotas: _q, ...p }) => p),
      planMeals: data.planMeals.filter((m) => data.mealPlans.find((p) => p.id === m.mealPlanId)?.kind === 'daily'),
    }
  }

  it('sürüm 1 veriyi kayıpsız yükseltir ve yeni biçimde kaydeder', () => {
    const storage = new MemoryStorage()
    const old = versionOneData()
    old.clients[0]!.firstName = 'Kullanıcının değişikliği'
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, seededAt: '2026-01-01T00:00:00.000Z', data: old }))

    const store = open(storage)
    const { version, seededAt, data } = store.read()
    expect(version).toBe(7)
    expect(seededAt).toBe('2026-01-01T00:00:00.000Z')
    expect(data.clients[0]!.firstName).toBe('Kullanıcının değişikliği')
    expect(data.measurements).toHaveLength(old.measurements.length)
    expect(data.measurements.every((m) => m.thighCm === null)).toBe(true)
    expect(data).toMatchObject({ clientMedications: [], clientConditions: [], clientRecommendations: [], recipeIngredients: [] })
    expect(data.foods.slice(0, 15).every((f) => f.cookingMethod === null && f.recipeYieldG === null)).toBe(true)
    // Başlangıç besin listesi eklenir, mevcut besinler korunur.
    expect(data.foods).toHaveLength(15 + FOOD_CATALOG.length + EXCHANGE_GROUPS.length)
    expect(data.foods.map((f) => f.name)).toEqual(expect.arrayContaining(FOOD_CATALOG.map(([name]) => name)))
    expect(data.mealPlans.every((p) => p.kind === 'daily' && p.weeklyQuotas.length === 0)).toBe(true)
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(7)
  })

  it('yükseltmeden sonra da geçersiz olan sürüm 1 veriyi ezmez', () => {
    const storage = new MemoryStorage()
    const old = versionOneData()
    old.foods[0]!.energyKcal = -5
    const raw = JSON.stringify({ version: 1, seededAt: NOW.toISOString(), data: old })
    storage.setItem(STORAGE_KEY, raw)
    expect(openDemoStore({ storage, now }).ok).toBe(false)
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })
})

describe('sıfırlama güvenliği', () => {
  it('yalnızca diyetgo: önekli anahtarları siler; diğer verileri korur', () => {
    const storage = new MemoryStorage()
    storage.setItem('baska-uygulama', 'korunmalı')
    storage.setItem('diyetgo-benzeri', 'önek tam eşleşmiyor, korunmalı')
    storage.setItem('diyetgo:eski-anahtar', 'silinmeli')
    const store = open(storage)
    const data = store.read().data
    data.clients = []
    store.write(data)

    store.reset()
    expect(storage.getItem('baska-uygulama')).toBe('korunmalı')
    expect(storage.getItem('diyetgo-benzeri')).toBe('önek tam eşleşmiyor, korunmalı')
    expect(storage.getItem('diyetgo:eski-anahtar')).toBeNull()
    expect(store.read().data).toEqual(createSeedData('2026-03-10'))
  })

  it('clearDemoStorage tüm diyetgo: anahtarlarını siler, ardışık anahtarları atlamaz', () => {
    const storage = new MemoryStorage()
    for (const key of ['diyetgo:a', 'diyetgo:b', 'x', 'diyetgo:c']) storage.setItem(key, '1')
    clearDemoStorage(storage)
    expect(storage.length).toBe(1)
    expect(storage.getItem('x')).toBe('1')
  })
})

describe('yazma hataları', () => {
  it('kota dolduğunda hata verir ve mevcut veri değişmez', () => {
    const storage = new MemoryStorage()
    const store = open(storage)
    const before = storage.getItem(STORAGE_KEY)
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    const data = store.read().data
    data.clients = []
    expect(() => store.write(data)).toThrow(RepositoryError)
    expect(storage.getItem(STORAGE_KEY)).toBe(before)
  })
})

describe('değişiklik bildirimi', () => {
  it('yazma, sıfırlama ve dış olaylarda aboneleri bilgilendirir', () => {
    const store = open(new MemoryStorage())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.write(store.read().data)
    store.reset()
    store.notify()
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
    store.notify()
    expect(listener).toHaveBeenCalledTimes(3)
  })
})

describe('yedek', () => {
  it('yedek dosyası başka tarayıcıya yüklenince aynı veriyi verir; yedek zamanı kaydedilir', () => {
    const source = open(new MemoryStorage())
    const data = source.read().data
    data.clients[0]!.firstName = 'Yedeklenen'
    source.write(data)
    expect(source.lastBackupAt()).toBeNull()
    const text = source.exportBackup()
    // Yedek zamanı dosya kaydedildikten sonra işlenir.
    expect(source.lastBackupAt()).toBeNull()
    source.recordBackup()
    expect(source.lastBackupAt()).toBe(NOW.toISOString())

    const target = open(new MemoryStorage())
    target.importBackup(text)
    expect(target.read().data.clients[0]!.firstName).toBe('Yedeklenen')
  })

  it('yedek yüklerken bozuk tarihi, tekrarlanan kimliği ve sarkık bağı reddeder; fazlalıkları depoya yazmaz', () => {
    const base = () => JSON.parse(JSON.stringify(openStore().read())) as { version: number; seededAt: string; data: Record<string, Record<string, unknown>[]> }
    function openStore() {
      return open(new MemoryStorage())
    }
    const target = openStore()
    const before = JSON.stringify(target.read())

    const badDate = base()
    badDate.seededAt = 'x'
    expect(() => target.importBackup(JSON.stringify(badDate))).toThrow(/geçersiz/)

    const duplicate = base()
    duplicate.data.clients!.push({ ...duplicate.data.clients![0]! })
    expect(() => target.importBackup(JSON.stringify(duplicate))).toThrow(/aynı kimlikli/)

    const dangling = base()
    dangling.data.planMealItems![0]!.foodId = '00000000-0000-4000-8000-00000000dead'
    expect(() => target.importBackup(JSON.stringify(dangling))).toThrow(/bağlı olduğu kaydı olmayan/)
    expect(JSON.stringify(target.read())).toBe(before)

    const extra = base()
    ;(extra as unknown as Record<string, unknown>).hack = true
    ;(extra.data as Record<string, unknown>).sahte = [{ id: 'x' }]
    extra.data.clients![0]!.fazla = 'alan'
    target.importBackup(JSON.stringify(extra))
    const saved = target.read()
    expect(Object.keys(saved.data)).not.toContain('sahte')
    expect(saved.data.clients[0]).not.toHaveProperty('fazla')
    expect(saved).not.toHaveProperty('hack')
  })

  it('geçersiz yedek mevcut verileri değiştirmez', () => {
    const store = open(new MemoryStorage())
    const before = JSON.stringify(store.read())
    expect(() => store.importBackup('bozuk')).toThrow(/Dosya okunamadı/)
    expect(() => store.importBackup(JSON.stringify({ version: 7, seededAt: NOW.toISOString(), data: { clients: [] } }))).toThrow(/Yedek yüklenemedi/)
    expect(JSON.stringify(store.read())).toBe(before)
  })
})
