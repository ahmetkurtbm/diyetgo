/**
 * Demo verilerinin localStorage'da saklanması.
 *
 * - Tüm veri tek anahtarda (`STORAGE_KEY`) tutulur ve her değişiklik tek `setItem` ile yazılır;
 *   birden fazla koleksiyona dokunan işlemler yarıda kalıp tutarsız veri bırakamaz.
 * - Seed yalnızca anahtar hiç yokken yazılır. Mevcut veri, bozuk veya tanınmayan sürümde olsa bile
 *   kendiliğinden ezilmez; kullanıcı açıkça sıfırlamalıdır.
 * - Sıfırlama yalnızca `diyetgo:` önekli anahtarları siler.
 */
import {
  appointmentSchema,
  clientConditionSchema,
  clientGoalSchema,
  clientMedicationSchema,
  clientRecommendationSchema,
  clientSchema,
  EXCHANGE_GROUPS,
  FOOD_CATALOG,
  foodSchema,
  instantSchema,
  istanbulDateOf,
  mealPlanSchema,
  mealTypeSchema,
  measurementSchema,
  planMealItemSchema,
  planMealSchema,
  recipeIngredientSchema,
} from '@diyetgo/shared'
import { createSeedData, type SeedData } from '@diyetgo/shared/seed'
import { RepositoryError } from '../repositories'
import { MemoryStorage } from './memory-storage'

export const STORAGE_KEY = 'diyetgo:demo:v1'
export const STORAGE_PREFIX = 'diyetgo:'
/** Son yedeğin zamanı; haftalık yedek hatırlatması için. */
export const BACKUP_KEY = 'diyetgo:backup:last'
/**
 * Veri biçiminin sürümü. Eski sürümler açılışta kayıpsız yükseltilir (bkz. `upgrade`):
 * - 2: ölçümlere uyluk çevresi (`thighCm`); danışanlara ilaç, hastalık ve öneri koleksiyonları.
 * - 3: besinlere pişirme yöntemi ve tarif alanları (`cookingMethod`, `recipeYieldG`); tarif malzemeleri.
 * - 4: planlara tür ve haftalık adetler (`kind`, `weeklyQuotas`); mevcut planlar günlük menüdür.
 * - 5: başlangıç besin listesi (`FOOD_CATALOG`) eksikse eklenir; mevcut besinlere dokunulmaz.
 * - 6: listeye eklenen kahvaltılıklar ve yemekler aynı şekilde eklenir.
 * - 7: besin değişimleri (`EXCHANGE_GROUPS`, `baseUnit: 'exchange'`) eksikse eklenir.
 */
const VERSION = 7

export type DemoData = SeedData
type Envelope = { version: typeof VERSION; seededAt: string; data: DemoData }

/** Dizideki her nesne kayda eksik alanları varsayılan değerle ekler; mevcut değerlere dokunmaz. */
const withDefaults = (records: unknown, defaults: Record<string, unknown>) =>
  Array.isArray(records) ? records.map((r: unknown) => (typeof r === 'object' && r !== null ? { ...defaults, ...r } : r)) : records

/** Başlangıç besin listesinden ve değişimlerden, kimliği henüz bulunmayan besinleri ekler. */
function withCatalogFoods(foods: unknown, today: string) {
  if (!Array.isArray(foods)) return foods
  const ids = new Set(foods.map((f: unknown) => (typeof f === 'object' && f !== null ? (f as { id?: unknown }).id : undefined)))
  const names = new Set([...FOOD_CATALOG.map(([name]) => name), ...EXCHANGE_GROUPS.map((g) => g.name)])
  const catalog = createSeedData(today).foods.filter((f) => names.has(f.name) && !ids.has(f.id))
  return [...foods, ...catalog]
}

const upgrades: Record<number, (data: Record<string, unknown>, today: string) => Record<string, unknown>> = {
  1: (data) => ({
    ...data,
    measurements: withDefaults(data.measurements, { thighCm: null }),
    clientMedications: [],
    clientConditions: [],
    clientRecommendations: [],
  }),
  2: (data) => ({ ...data, foods: withDefaults(data.foods, { cookingMethod: null, recipeYieldG: null }), recipeIngredients: [] }),
  3: (data) => ({ ...data, mealPlans: withDefaults(data.mealPlans, { kind: 'daily', weeklyQuotas: [] }) }),
  4: (data, today) => ({ ...data, foods: withCatalogFoods(data.foods, today) }),
  5: (data, today) => ({ ...data, foods: withCatalogFoods(data.foods, today) }),
  6: (data, today) => ({ ...data, foods: withCatalogFoods(data.foods, today) }),
}

/**
 * Eski sürümdeki veriyi adım adım güncel biçime çevirir; mevcut kayıtlar korunur, yalnızca yeni alanlar
 * boş değerle eklenir. Tanınmayan sürüm veya yapı olduğu gibi döner; `validate` reddeder.
 */
function upgrade(value: unknown, today: string): unknown {
  if (typeof value !== 'object' || value === null) return value
  let envelope = value as { version?: unknown; data?: unknown }
  while (typeof envelope.version === 'number' && upgrades[envelope.version] && typeof envelope.data === 'object' && envelope.data !== null) {
    envelope = { ...envelope, version: envelope.version + 1, data: upgrades[envelope.version]!(envelope.data as Record<string, unknown>, today) }
  }
  return envelope === value ? value : envelope
}

const collectionSchemas = {
  clients: clientSchema,
  measurements: measurementSchema,
  foods: foodSchema,
  mealTypes: mealTypeSchema,
  mealPlans: mealPlanSchema,
  planMeals: planMealSchema,
  planMealItems: planMealItemSchema,
  appointments: appointmentSchema,
  clientGoals: clientGoalSchema,
  clientMedications: clientMedicationSchema,
  clientConditions: clientConditionSchema,
  clientRecommendations: clientRecommendationSchema,
  recipeIngredients: recipeIngredientSchema,
} satisfies Record<keyof DemoData, { safeParse(value: unknown): { success: boolean } }>

export type DemoStore = {
  /** `false` ise veriler yalnızca bellekte tutulur ve sayfa yenilenince kaybolur. */
  persistent: boolean
  /** Güncel veriyi depolamadan okur; her çağrı yeni bir kopya döndürür. */
  read(): Envelope
  write(data: DemoData): void
  reset(): void
  /** Yedek dosyası içeriği. Yedek zamanını kaydetmez: dosya kaydedildikten sonra `recordBackup` çağrılır. */
  exportBackup(): string
  /** Yedeğin alındığı anı kaydeder (haftalık hatırlatma bunu kullanır). */
  recordBackup(): void
  /** Yedeği eski sürümse yükseltir, doğrular ve yükler; geçersizse `validation` hatası verir. */
  importBackup(text: string): void
  lastBackupAt(): string | null
  subscribe(listener: () => void): () => void
  /** Başka bir sekmedeki değişiklik gibi dış olayları abonelere iletir. */
  notify(): void
}

export type OpenError = { reason: 'corrupt' | 'unsupported_version' | 'invalid'; message: string }
export type OpenResult = { ok: true; store: DemoStore } | { ok: false; error: OpenError }

/** Yalnızca Diyetgo'ya ait (`diyetgo:` önekli) anahtarları siler; diğer siteler/uygulamalar etkilenmez. */
export function clearDemoStorage(storage: Storage): void {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
}

/** Kullanılabilir localStorage'ı döndürür; gizli mod veya engelleme durumunda `null`. */
export function getBrowserStorage(): Storage | null {
  try {
    const storage = window.localStorage
    const probe = `${STORAGE_PREFIX}probe`
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

/** Kayıtların hangi koleksiyondaki kayda bağlandığı: [koleksiyon, alan, hedef koleksiyon]. */
const REFERENCES = [
  ['measurements', 'clientId', 'clients'],
  ['mealPlans', 'clientId', 'clients'],
  ['planMeals', 'mealPlanId', 'mealPlans'],
  ['planMeals', 'mealTypeId', 'mealTypes'],
  ['planMealItems', 'planMealId', 'planMeals'],
  ['planMealItems', 'foodId', 'foods'],
  ['appointments', 'clientId', 'clients'],
  ['clientGoals', 'clientId', 'clients'],
  ['clientMedications', 'clientId', 'clients'],
  ['clientConditions', 'clientId', 'clients'],
  ['clientRecommendations', 'clientId', 'clients'],
  ['recipeIngredients', 'recipeId', 'foods'],
  ['recipeIngredients', 'foodId', 'foods'],
] as const

/**
 * Yedekten yüklenen verinin kayıtlar arası bütünlüğü: kimlikler koleksiyon içinde benzersiz olmalı ve
 * her bağ var olan bir kaydı göstermeli (veritabanındaki birincil ve yabancı anahtar kuralları).
 */
function relationIssue(data: Record<string, unknown[]>): string | null {
  const ids = new Map<string, Set<unknown>>()
  for (const name of Object.keys(collectionSchemas)) {
    const set = new Set((data[name] as { id?: unknown }[]).map((r) => r.id))
    if (set.size !== data[name]!.length) return `Yedekte aynı kimlikli birden çok kayıt var (${name}).`
    ids.set(name, set)
  }
  for (const [name, field, target] of REFERENCES) {
    if ((data[name] as Record<string, unknown>[]).some((r) => !ids.get(target)!.has(r[field]))) {
      return `Yedekte bağlı olduğu kaydı olmayan kayıt var (${name}).`
    }
  }
  return null
}

/** Yalnızca bilinen koleksiyonları ve şemadaki alanları tutar; fazlalıklar yedekle depoya yazılmaz. */
function sanitize(data: Record<string, unknown[]>): DemoData {
  return Object.fromEntries(
    Object.entries(collectionSchemas).map(([name, schema]) => [name, data[name]!.map((record) => (schema as unknown as { parse(v: unknown): unknown }).parse(record))]),
  ) as unknown as DemoData
}

function validate(value: unknown): OpenError | null {
  if (typeof value !== 'object' || value === null) return { reason: 'corrupt', message: 'Demo verileri okunamadı.' }
  const envelope = value as Partial<Envelope>
  if (envelope.version !== VERSION) {
    return { reason: 'unsupported_version', message: `Demo verilerinin sürümü (${String(envelope.version)}) tanınmıyor.` }
  }
  if (!instantSchema.safeParse(envelope.seededAt).success || typeof envelope.data !== 'object' || envelope.data === null) {
    return { reason: 'invalid', message: 'Demo verilerinin yapısı geçersiz.' }
  }
  for (const [name, schema] of Object.entries(collectionSchemas)) {
    const records: unknown = (envelope.data as Record<string, unknown>)[name]
    if (!Array.isArray(records) || !records.every((record) => schema.safeParse(record).success)) {
      return { reason: 'invalid', message: `Demo verilerinde geçersiz kayıt var (${name}).` }
    }
  }
  return null
}

export function openDemoStore(options: { storage: Storage | null; now?: () => Date }): OpenResult {
  const now = options.now ?? (() => new Date())
  const persistent = options.storage !== null
  const storage = options.storage ?? new MemoryStorage()
  const listeners = new Set<() => void>()

  const freshEnvelope = (): Envelope => ({
    version: VERSION,
    seededAt: now().toISOString(),
    data: createSeedData(istanbulDateOf(now())),
  })

  const save = (envelope: Envelope) => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(envelope))
    } catch {
      throw new RepositoryError('storage', 'Veriler kaydedilemedi. Tarayıcı depolama alanı dolu olabilir.')
    }
  }

  const notify = () => {
    for (const listener of listeners) listener()
  }

  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) {
    save(freshEnvelope())
  } else {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, error: { reason: 'corrupt', message: 'Demo verileri okunamadı (bozuk veri).' } }
    }
    const upgraded = upgrade(parsed, istanbulDateOf(now()))
    const error = validate(upgraded)
    if (error) return { ok: false, error }
    // Yükseltilen veri yeni biçimde kaydedilir; eski veri yalnızca doğrulama geçtikten sonra değişir.
    if (upgraded !== parsed) save(upgraded as Envelope)
  }

  const store: DemoStore = {
    persistent,
    read() {
      const current = storage.getItem(STORAGE_KEY)
      if (current === null) throw new RepositoryError('storage', 'Demo verileri bulunamadı. Sayfayı yenileyin.')
      return JSON.parse(current) as Envelope
    },
    write(data) {
      save({ ...store.read(), data })
      notify()
    },
    reset() {
      const envelope = freshEnvelope()
      try {
        clearDemoStorage(storage)
      } catch {
        throw new RepositoryError('storage', 'Demo verileri silinemedi.')
      }
      save(envelope)
      notify()
    },
    exportBackup() {
      return JSON.stringify(store.read())
    },
    recordBackup() {
      try {
        storage.setItem(BACKUP_KEY, now().toISOString())
      } catch {
        // Yedek zamanı kaydedilemezse hatırlatma erken gelir; yedek dosyası yine geçerlidir.
      }
      // "Son yedek" bilgisini gösteren ekranlar yenilensin.
      notify()
    },
    importBackup(text) {
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new RepositoryError('validation', 'Dosya okunamadı. Diyetgo yedek dosyası seçin.')
      }
      const upgraded = upgrade(parsed, istanbulDateOf(now()))
      const error = validate(upgraded)
      if (error) throw new RepositoryError('validation', `Yedek yüklenemedi: ${error.message}`)
      const envelope = upgraded as Envelope
      const data = envelope.data as unknown as Record<string, unknown[]>
      const issue = relationIssue(data)
      if (issue) throw new RepositoryError('validation', `Yedek yüklenemedi: ${issue}`)
      save({ version: VERSION, seededAt: envelope.seededAt, data: sanitize(data) })
      notify()
    },
    lastBackupAt() {
      try {
        return storage.getItem(BACKUP_KEY)
      } catch {
        return null
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    notify,
  }
  return { ok: true, store }
}
