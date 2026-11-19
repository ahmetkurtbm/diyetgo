/**
 * Uygulama güncellemesi (service worker) durumu. `UpdatePrompt` service worker'ı kaydeder ve buraya
 * bildirir; Ayarlar'daki "Sürüm" bölümü aynı durumu kullanarak güncellemeyi elle denetler veya uygular.
 */
/** `ServiceWorkerRegistration`'ın kullandığımız bölümü (testlerde sahte kayıt verilebilsin). */
type Registration = { update(): Promise<unknown>; installing: ServiceWorker | null; waiting: ServiceWorker | null }
type Apply = (reload?: boolean) => Promise<void>

export type UpdateCheck = 'available' | 'current' | 'unsupported' | 'offline'

let registration: Registration | undefined
let apply: Apply | undefined
let needRefresh = false
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((listener) => listener())

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Yeni sürüm indirilmiş ve etkinleştirilmeyi bekliyor mu? Alttaki öneriyi "daha sonra" ile kapatmış
 * kullanıcı için de doğrudur: bekleyen service worker hâlâ vardır.
 */
export const updateReady = () => needRefresh || Boolean(registration?.waiting)

/** `UpdatePrompt` çağırır: kayıt, "yeni sürüm hazır" bilgisi ve uygulama işlevi. */
export function reportUpdate(next: { registration?: Registration; needRefresh?: boolean; apply?: Apply }): void {
  if (next.registration !== undefined) registration = next.registration
  if (next.apply !== undefined) apply = next.apply
  if (next.needRefresh !== undefined && next.needRefresh !== needRefresh) needRefresh = next.needRefresh
  notify()
}

/** Yeni sürümü etkinleştirir ve sayfayı yeniler. */
export async function applyUpdate(): Promise<void> {
  await apply?.(true)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Sunucuda yeni sürüm olup olmadığını denetler. Yeni sürüm bulunursa indirilmesi (kurulması)
 * beklenir; hazır olunca `available` döner. Service worker yoksa (geliştirme, eski tarayıcı) `unsupported`.
 */
export async function checkForUpdate(timeoutMs = 20_000): Promise<UpdateCheck> {
  // Ayarlar, service worker kaydı tamamlanmadan açılmış olabilir (ilk yükleme): kayıt tarayıcıdan da aranır.
  registration ??= (await navigator.serviceWorker?.getRegistration()) ?? undefined
  const current = registration
  if (!current) return 'unsupported'
  try {
    await current.update()
  } catch {
    return 'offline'
  }
  const deadline = Date.now() + timeoutMs
  while (!updateReady() && current.installing && Date.now() < deadline) await sleep(250)
  notify()
  return updateReady() ? 'available' : 'current'
}

/** Yalnızca testler için. */
export function resetUpdateState(): void {
  registration = undefined
  apply = undefined
  needRefresh = false
  notify()
}
