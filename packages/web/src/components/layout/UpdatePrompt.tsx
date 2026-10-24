import { RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/Button'

/**
 * Service worker'ı kaydeder ve yeni sürüm hazır olduğunda yenileme önerir. Sayfa kendiliğinden
 * yenilenmez; böylece yarım kalan bir form kaybolmaz.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-pop-in items-center gap-3 rounded-lg border-l-4 border-l-brand-600 bg-white p-3 text-sm shadow-lg ring-1 ring-slate-200">
      <RefreshCw aria-hidden className="size-4 shrink-0 text-brand-700" />
      <p className="flex-1 text-slate-800">Diyetgo'nun yeni sürümü hazır.</p>
      <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
        Yenile
      </Button>
      <button type="button" aria-label="Daha sonra" onClick={() => setNeedRefresh(false)} className="text-slate-500 hover:text-slate-700">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}
