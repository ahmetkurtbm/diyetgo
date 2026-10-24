import { CalendarDays, Info, LayoutDashboard, Leaf, Menu, NotebookPen, Settings, Users, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useRepositoryQuery } from '../../data/context'
import { PageTransition } from '../ui/motion'

const navigation = [
  {
    title: 'Takip',
    items: [
      { to: '/', label: 'Genel bakış', icon: LayoutDashboard, end: true },
      { to: '/clients', label: 'Danışanlar', icon: Users },
      { to: '/appointments', label: 'Randevular', icon: CalendarDays },
    ],
  },
  {
    title: 'Beslenme',
    items: [
      { to: '/foods', label: 'Besinler', icon: UtensilsCrossed },
      { to: '/plans', label: 'Beslenme planları', icon: NotebookPen },
    ],
  },
  { title: 'Sistem', items: [{ to: '/settings', label: 'Ayarlar', icon: Settings }] },
]

function Brand() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
      <span className="rounded-lg bg-linear-to-br from-emerald-500 to-teal-700 p-1.5 text-white shadow-md shadow-emerald-600/30">
        <Leaf aria-hidden className="size-4" />
      </span>
      Dietgo
    </span>
  )
}

function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const id = useId()
  return (
    <div className="space-y-5">
      {navigation.map((group, index) => (
        <div key={group.title}>
          <p id={`${id}-${index}`} className="mb-1 px-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {group.title}
          </p>
          <ul aria-labelledby={`${id}-${index}`} className="space-y-1">
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-linear-to-r from-brand-700 to-teal-700 text-white shadow-sm shadow-emerald-700/30'
                        : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800'
                    }`
                  }
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Demo modunun sınırlarını belirtir; tarayıcı depolaması yoksa verinin kaybolacağını vurgular. */
function DemoNotice({ persistent }: { persistent: boolean }) {
  return (
    <div
      role="note"
      aria-label="Demo modu"
      className={`rounded-md border p-3 text-xs ${persistent ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'}`}
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Info aria-hidden className="size-4 shrink-0" />
        Demo modu
      </p>
      <p className="mt-1">
        {persistent
          ? 'Veriler yalnızca bu tarayıcıda tutulur; cihazlar arasında paylaşılmaz ve yedeklenmez.'
          : 'Tarayıcı depolaması kullanılamıyor; değişiklikler sayfa yenilenince kaybolur.'}
      </p>
      <p className="mt-1 font-semibold">Gerçek kişisel veya sağlık verisi girmeyin.</p>
    </div>
  )
}

/** Mobil menü: yerleşik `<dialog>` odak yakalamayı, Escape'i ve arka planı etkisizleştirmeyi sağlar. */
function MobileMenu({ open, onClose, isDemo, persistent }: { open: boolean; onClose: () => void; isDemo: boolean; persistent: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Arka plandaki sayfanın kaydırılmasını engeller.
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      id="mobile-menu"
      aria-label="Menü"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // İçerik dialog'u tamamen kapladığından dialog'un kendisine gelen tıklama yalnızca karartılmış dış alandan gelir.
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="m-0 h-full max-h-none w-72 max-w-[85vw] bg-white p-0 shadow-xl backdrop:bg-slate-900/40 lg:hidden"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
            <Brand />
            <button type="button" aria-label="Menüyü kapat" onClick={onClose} className="rounded-md p-2 text-slate-600 hover:bg-slate-100">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <nav aria-label="Ana menü" className="flex-1 overflow-y-auto px-3 py-4">
            <NavGroups onNavigate={onClose} />
          </nav>
          {isDemo && (
            <div className="border-t border-slate-200 p-3">
              <DemoNotice persistent={persistent} />
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const demo = useRepositoryQuery((r) => (r.demo ? r.demo.info() : Promise.resolve(null)), [])
  const isDemo = demo.data !== null
  const persistent = demo.data?.persistent ?? true

  return (
    <div className="min-h-svh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-6">
          <Brand />
        </div>
        <nav aria-label="Ana menü" className="flex-1 overflow-y-auto px-3 py-2">
          <NavGroups />
        </nav>
        {isDemo && (
          <div className="border-t border-slate-200 p-3">
            <DemoNotice persistent={persistent} />
          </div>
        )}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          {isDemo && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${persistent ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'}`}>
              Demo
            </span>
          )}
          <button
            type="button"
            aria-label="Menüyü aç"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(true)}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
          >
            <Menu aria-hidden className="size-5" />
          </button>
        </div>
      </header>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} isDemo={isDemo} persistent={persistent} />

      <main key={pathname} className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  )
}
