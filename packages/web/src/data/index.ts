import { createApiRepositories } from './api/repositories'
import { createDemoRepositories } from './demo/repositories'
import { clearDemoStorage, getBrowserStorage, openDemoStore, STORAGE_KEY, type OpenError } from './demo/store'
import type { Repositories } from './repositories'

export type DataSource =
  | { ok: true; repositories: Repositories }
  | { ok: false; kind: 'demo_storage'; error: OpenError; resetStorage: () => void }
  | { ok: false; kind: 'unsupported_mode'; message: string }

/** `VITE_DATA_MODE`'a göre veri kaynağını oluşturur: `demo` (localStorage) veya `api` (yerel Express API). */
export function createDataSource(): DataSource {
  const mode = import.meta.env.VITE_DATA_MODE ?? 'demo'
  if (mode === 'api') return { ok: true, repositories: createApiRepositories() }
  if (mode !== 'demo') {
    return { ok: false, kind: 'unsupported_mode', message: `"${mode}" veri modu desteklenmiyor. VITE_DATA_MODE=demo veya VITE_DATA_MODE=api kullanın.` }
  }

  const storage = getBrowserStorage()
  let opened
  try {
    opened = openDemoStore({ storage })
  } catch {
    // İlk seed yazılamadıysa (ör. kota) veriler bellekte tutulur; arayüz bunu "kaydedilmiyor" olarak gösterir.
    opened = openDemoStore({ storage: null })
  }
  if (!opened.ok) {
    return { ok: false, kind: 'demo_storage', error: opened.error, resetStorage: () => storage && clearDemoStorage(storage) }
  }

  const { store } = opened
  // Başka bir sekmedeki değişiklikleri bu sekmeye yansıt.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) store.notify()
  })
  return { ok: true, repositories: createDemoRepositories(store) }
}
