import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { Toaster } from './components/ui/Toaster'
import { RepositoryContext } from './data/context'
import type { Repositories } from './data/repositories'
import { ComingSoonPage } from './features/placeholder/ComingSoonPage'
import { NotFoundPage } from './features/placeholder/NotFoundPage'
import { SettingsPage } from './features/settings/SettingsPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<ComingSoonPage title="Genel bakış" />} />
        <Route path="clients/*" element={<ComingSoonPage title="Danışanlar" />} />
        <Route path="foods/*" element={<ComingSoonPage title="Besinler" />} />
        <Route path="plans/*" element={<ComingSoonPage title="Beslenme planları" />} />
        <Route path="appointments/*" element={<ComingSoonPage title="Randevular" />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

/** Sağlayıcıları bir araya getirir; testler `AppRoutes`'u bellek içi router ile kullanır. */
export function AppProviders({ repositories, children }: { repositories: Repositories; children: ReactNode }) {
  return (
    <RepositoryContext value={repositories}>
      <Toaster>{children}</Toaster>
    </RepositoryContext>
  )
}

export default function App({ repositories }: { repositories: Repositories }) {
  return (
    <AppProviders repositories={repositories}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  )
}
