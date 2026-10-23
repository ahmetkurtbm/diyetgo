import { CalendarDays, Info, LayoutDashboard, Leaf, Menu, NotebookPen, Settings, Users, UtensilsCrossed, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useRepositoryQuery } from '../../data/context'

const navigation = [
  { to: '/', label: 'Genel bakış', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Danışanlar', icon: Users },
  { to: '/foods', label: 'Besinler', icon: UtensilsCrossed },
  { to: '/plans', label: 'Beslenme planları', icon: NotebookPen },
  { to: '/appointments', label: 'Randevular', icon: CalendarDays },
  { to: '/settings', label: 'Ayarlar', icon: Settings },
]

function Brand() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
      <span className="rounded-md bg-brand-700 p-1.5 text-white">
        <Leaf aria-hidden className="size-4" />
      </span>
      Dietgo
    </span>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {navigation.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

function DemoBanner() {
  const info = useRepositoryQuery((r) => (r.demo ? r.demo.info() : Promise.resolve(null)), [])
  const persistent = info.data?.persistent ?? true
  return (
    <div role="note" className={`flex items-start gap-2 px-4 py-2 text-xs sm:items-center sm:px-6 ${persistent ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'}`}>
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 sm:mt-0" />
      <p>
        {persistent
          ? 'Demo modu: veriler yalnızca bu tarayıcıda tutulur. Gerçek kişisel veya sağlık verisi girmeyin.'
          : 'Demo modu: tarayıcı depolaması kullanılamıyor, değişiklikler sayfa yenilenince kaybolur. Gerçek kişisel veya sağlık verisi girmeyin.'}
      </p>
    </div>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <div className="min-h-svh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-6">
          <Brand />
        </div>
        <nav aria-label="Ana menü" className="flex-1 overflow-y-auto px-3 py-2">
          <NavItems />
        </nav>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
        >
          {menuOpen ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>
      </header>
      {menuOpen && (
        <nav id="mobile-menu" aria-label="Ana menü" className="sticky top-14 z-20 border-b border-slate-200 bg-white px-3 py-2 shadow-sm lg:hidden">
          <NavItems onNavigate={() => setMenuOpen(false)} />
        </nav>
      )}

      <DemoBanner />
      <main key={pathname} className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
