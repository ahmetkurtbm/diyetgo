/** Randevu hatırlatıcı ayarları ve gösterilmiş hatırlatmalar; tarayıcıda (localStorage) tutulur. */
const ENABLED_KEY = 'diyetgo:reminders:enabled'
const FIRED_KEY = 'diyetgo:reminders:fired'
const PROMPT_KEY = 'diyetgo:reminders:prompt-dismissed'
const MAX_FIRED = 200

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Kaydedilemezse ayar yalnızca bu oturumda geçerli olmaz; hatırlatıcılar çalışmaya devam eder.
  }
}

/** Varsayılan açıktır. */
export const remindersEnabled = () => read(ENABLED_KEY) !== 'false'
export const setRemindersEnabled = (enabled: boolean) => write(ENABLED_KEY, String(enabled))

export const promptDismissed = () => read(PROMPT_KEY) !== null
export const dismissPrompt = () => write(PROMPT_KEY, new Date().toISOString())

export function firedKeys(): Set<string> {
  try {
    return new Set(JSON.parse(read(FIRED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function markFired(key: string): void {
  const keys = [...firedKeys(), key].slice(-MAX_FIRED)
  write(FIRED_KEY, JSON.stringify(keys))
}

/** Bildirim izni: `unsupported` ise tarayıcıda (ör. iPhone Safari sekmesi) sistem bildirimi yoktur. */
export type NotificationState = NotificationPermission | 'unsupported'
export const notificationState = (): NotificationState => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

/** Sistem bildirimi gösterir; izin yoksa sessizce atlar. Service worker varsa onun üzerinden (mobilde gerekli). */
export async function showSystemNotification(title: string, body: string, tag: string): Promise<void> {
  if (notificationState() !== 'granted') return
  const options: NotificationOptions = { body, tag, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', silent: false }
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) await registration.showNotification(title, options)
    else new Notification(title, options)
  } catch {
    // Bildirim gösterilemezse ses ve ekrandaki uyarı yine de verilir.
  }
}
