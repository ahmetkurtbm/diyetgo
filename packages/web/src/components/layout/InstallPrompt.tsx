/**
 * Uygulamayı ana ekrana yükleme. Chrome/Edge/Android `beforeinstallprompt` olayıyla yükleme penceresi
 * açılır. iPhone ve iPad'de (Safari) bu olay yoktur; Apple yüklemeyi yalnızca Paylaş menüsündeki
 * "Ana Ekrana Ekle" ile izin verdiği için yönerge gösterilir. Uygulama zaten yüklüyse hiçbir şey görünmez.
 */
import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const DISMISS_KEY = 'diyetgo:install:dismissed'

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** iPadOS Safari kendini Mac olarak tanıtır; dokunmatik ekrandan ayırt edilir. */
const isAppleMobile = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) !== null
  } catch {
    return false
  }
}

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [apple] = useState(() => !isStandalone() && isAppleMobile())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const onInstalled = () => setEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (dismissed || (!event && !apple)) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    } catch {
      // Kaydedilemezse yalnızca bu oturum için gizlenir.
    }
  }

  async function install() {
    if (!event) return
    await event.prompt()
    await event.userChoice
    setEvent(null)
  }

  return (
    <aside aria-label="Uygulamayı yükle" className="border-b border-brand-200 bg-brand-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-brand-800 sm:px-6">
        {event ? (
          <p>Diyetgo'yu uygulama olarak yükleyin; ana ekrandan tek dokunuşla açılır.</p>
        ) : (
          <p className="flex flex-wrap items-center gap-1">
            Yüklemek için Safari'de
            <Share aria-label="Paylaş" className="size-4" />
            <strong>Paylaş</strong> düğmesine, ardından <strong>Ana Ekrana Ekle</strong>'ye dokunun.
          </p>
        )}
        <div className="flex gap-2">
          {event && (
            <button
              type="button"
              onClick={() => void install()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-700 px-3 font-medium text-white hover:bg-brand-800 pointer-coarse:h-11"
            >
              <Download aria-hidden className="size-4" />
              Uygulamayı yükle
            </button>
          )}
          <button type="button" aria-label="Yükleme önerisini kapat" onClick={dismiss} className="flex size-9 items-center justify-center rounded-md hover:bg-brand-100 pointer-coarse:size-11">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
