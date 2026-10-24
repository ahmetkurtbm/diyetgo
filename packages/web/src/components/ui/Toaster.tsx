import { CheckCircle2, X, XCircle } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastApi } from './toast-context'

type Toast = { id: number; tone: 'success' | 'error'; message: string }

const DURATION_MS = 4000

/** İşlem geri bildirimleri; ekran okuyucular `aria-live` bölgesinden duyurur. */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const show = useCallback(
    (tone: Toast['tone'], message: string) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { id, tone, message }])
      setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )
  const api = useMemo<ToastApi>(() => ({ success: (m) => show('success', m), error: (m) => show('error', m) }), [show])

  return (
    <ToastContext value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-lg border-l-4 bg-white p-3 text-sm shadow-lg ring-1 ring-slate-200 ${toast.tone === 'success' ? 'border-l-brand-600' : 'border-l-red-600'}`}
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" />
            ) : (
              <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600" />
            )}
            <p className="flex-1 text-slate-800">{toast.message}</p>
            <button type="button" aria-label="Bildirimi kapat" onClick={() => dismiss(toast.id)} className="text-slate-500 hover:text-slate-700">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  )
}
