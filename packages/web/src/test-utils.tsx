import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, vi } from 'vitest'
import { AppProviders, AppRoutes } from './App'
import { MemoryStorage } from './data/demo/memory-storage'
import { createDemoRepositories } from './data/demo/repositories'
import { openDemoStore } from './data/demo/store'

/** Testlerde "şimdi": İstanbul'da 10 Mart 2026, 12:00. */
export const TEST_NOW = new Date('2026-03-10T09:00:00.000Z')

/** Yalnızca `Date` sahtelenir; zamanlayıcılar gerçek kalır ki kullanıcı etkileşimleri çalışsın. */
export function fixDate(now = TEST_NOW) {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
  })
  afterEach(() => {
    vi.useRealTimers()
  })
}

/** Uygulamayı verilen adreste, verilen depolamayla (sayfa yenilemeyi taklit etmek için aynı depolama) açar. */
export function renderApp(path: string, storage: Storage = new MemoryStorage()) {
  const opened = openDemoStore({ storage })
  if (!opened.ok) throw new Error(opened.error.message)
  const repositories = createDemoRepositories(opened.store)
  const view = render(
    <AppProviders repositories={repositories}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  )
  return { ...view, storage, repositories, store: opened.store, user: userEvent.setup() }
}

/** Seed'deki sabit kimlikler (bkz. `@diyetgo/shared/seed`). */
export const SEED_IDS = {
  deniz: '00000001-0000-4000-8000-000000000001',
  selin: '00000001-0000-4000-8000-000000000004',
}
