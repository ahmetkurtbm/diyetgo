import { lazy, Suspense } from 'react'
import App from './App.tsx'
import type { DataSource } from './data'
import { StartupErrorPage } from './features/startup/StartupErrorPage'

// Oturum yalnızca API modunda gerekir; kimlik doğrulama kodu demo paketine girmez.
const AuthGate = lazy(() => import('./features/auth/AuthGate'))

/** Veri kaynağına göre uygulamayı açar: başlatma hatası, demo modu veya oturumlu API modu. */
export function Root({ source }: { source: DataSource }) {
  if (!source.ok) {
    return (
      <StartupErrorPage
        message={source.kind === 'demo_storage' ? source.error.message : source.message}
        onReset={
          source.kind === 'demo_storage'
            ? () => {
                source.resetStorage()
                window.location.reload()
              }
            : undefined
        }
      />
    )
  }
  const app = <App repositories={source.repositories} />
  if (source.repositories.mode !== 'api') return app
  return (
    <Suspense fallback={null}>
      <AuthGate>{app}</AuthGate>
    </Suspense>
  )
}
