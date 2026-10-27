import { CalendarDays, Info, LayoutDashboard, LogOut, Menu, NotebookPen, Settings, Users, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { useAccount } from './account-context'
import { PageTransition } from '../ui/motion'
import { ThemeSwitcher } from './ThemeSwitcher'

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

/** Diyetgo logosu: işaret `public/favicon.svg`, yazı logodaki gibi "diyet" koyu, "go" yeşil. */
function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-8 rounded-[9px]" />
      {/* "go", 20 px kalın yazı (büyük metin) için WCAG AA'nın 3:1 kontrastını sağlayan lime-600 tonundadır. */}
      <span className="font-display text-xl font-bold tracking-tight lowercase">
        <span className="text-slate-900">diyet</span>
        <span className="text-lime-600">go</span>
      </span>
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
                    `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 ${
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
        </div>
      ))}
    </div>
  )
}

/** Masaüstü üst menü: gruplar yan yana, aralarında ince ayraç; grup adı ekran okuyucu için. */
function TopNav() {
  const id = useId()
  return (
    <nav aria-label="Ana menü" className="hidden items-center lg:flex">
      {navigation.map((group, index) => (
        <div key={group.title} className="flex items-center">
          {index > 0 && <span aria-hidden className="mx-2 h-5 w-px bg-slate-200" />}
          <p id={`${id}-${index}`} className="sr-only">
            {group.title}
          </p>
          <ul aria-labelledby={`${id}-${index}`} className="flex items-center gap-0.5">
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
                      isActive ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
    </nav>
  )
}

/** Demo modunun sınırlarını belirtir; tarayıcı depolaması yoksa verinin kaybolacağını vurgular. */
function DemoNotice({ persistent, compact = false }: { persistent: boolean; compact?: boolean }) {
  const tone = persistent ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'
  const message = persistent
    ? 'Veriler yalnızca bu tarayıcıda tutulur; cihazlar arasında paylaşılmaz ve yedeklenmez.'
    : 'Tarayıcı depolaması kullanılamıyor; değişiklikler sayfa yenilenince kaybolur.'

  if (compact) {
    return (
      <div role="note" aria-label="Demo modu" className={`border-b ${tone}`}>
        <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2 text-xs sm:px-6">
          <Info aria-hidden className="size-4 shrink-0" />
          <span className="font-semibold">Demo modu</span>
          <span>{message}</span>
          <span className="font-semibold">Gerçek kişisel veya sağlık verisi girmeyin.</span>
        </p>
      </div>
    )
  }

  return (
    <div role="note" aria-label="Demo modu" className={`rounded-lg border p-3 text-xs ${tone}`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Info aria-hidden className="size-4 shrink-0" />
        Demo modu
      </p>
      <p className="mt-1">{message}</p>
      <p className="mt-1 font-semibold">Gerçek kişisel veya sağlık verisi girmeyin.</p>
    </div>
  )
}

/** Oturum açmış diyetisyen ve çıkış (yalnızca API modunda). */
function AccountCard() {
  const account = useAccount()
  const [leaving, setLeaving] = useState(false)
  if (!account) return null
  const initials = account.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase('tr-TR'))
    .join('')
  return (
    <div className="flex items-center gap-3 rounded-lg p-1">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">
        {initials || '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{account.name}</span>
        <span className="block truncate text-xs text-slate-500">{account.email}</span>
      </span>
      <button
        type="button"
        aria-label="Çıkış yap"
        title="Çıkış yap"
        disabled={leaving}
        onClick={async () => {
          setLeaving(true)
          try {
            await account.signOut()
          } finally {
            setLeaving(false)
          }
        }}
        className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
      >
        <LogOut aria-hidden className="size-4" />
      </button>
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
      className="m-0 h-full max-h-none w-72 max-w-[85vw] bg-surface p-0 shadow-xl backdrop:bg-black/50 lg:hidden"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
            <Brand />
            <button type="button" aria-label="Menüyü kapat" onClick={onClose} className="flex size-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <nav aria-label="Ana menü" className="flex-1 overflow-y-auto px-3 py-4">
            <NavGroups onNavigate={onClose} />
          </nav>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Tema</span>
            <ThemeSwitcher />
          </div>
          {isDemo && (
            <div className="border-t border-slate-200 p-3">
              <DemoNotice persistent={persistent} />
            </div>
          )}
          {!isDemo && (
            <div className="border-t border-slate-200 p-3">
              <AccountCard />
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
  const isDemo = useRepositories().mode === 'demo'
  const demo = useRepositoryQuery((r) => (r.demo ? r.demo.info() : Promise.resolve(null)), [])
  const persistent = demo.data?.persistent ?? true

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <TopNav />
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <ThemeSwitcher />
            </div>
            {!isDemo && (
              <div className="hidden lg:block">
                <AccountCard />
              </div>
            )}
            <button
              type="button"
              aria-label="Menüyü aç"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen(true)}
              className="flex size-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </header>
      {isDemo && (
        <aside aria-label="Demo bilgisi">
          <DemoNotice persistent={persistent} compact />
        </aside>
      )}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} isDemo={isDemo} persistent={persistent} />

      <main key={pathname} className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  )
}
