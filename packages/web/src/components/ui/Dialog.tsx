import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const

/**
 * Geri tuşu (Android, tarayıcı) açık pencereyi kapatsın diye her açık pencere geçmişe bir kayıt ekler.
 * Yalnızca en üstteki pencere kapanır. Pencere düğmeyle kapanınca eklenen kayıt geri alınır; bu geri
 * alma, alttaki pencereyi kapatmasın diye bir kez yok sayılır.
 */
const openDialogs: string[] = []
let ignoreNextPop = false

function useCloseOnBack(open: boolean, onClose: () => void) {
  const id = useId()
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    let closedByBack = false
    // Yönlendiricinin durum alanları korunur; adres değişmez.
    window.history.pushState({ ...(window.history.state as object | null), diyetgoDialog: id }, '')
    openDialogs.push(id)
    const onPop = () => {
      if (ignoreNextPop) {
        ignoreNextPop = false
        return
      }
      if (openDialogs.at(-1) !== id) return
      closedByBack = true
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      openDialogs.splice(openDialogs.indexOf(id), 1)
      // Pencereden başka sayfaya geçildiyse geçmiş kaydı artık bizim değildir; dokunulmaz.
      if (!closedByBack && (window.history.state as { diyetgoDialog?: string } | null)?.diyetgoDialog === id) {
        ignoreNextPop = openDialogs.length > 0
        window.history.back()
      }
    }
  }, [open, id])
}

/**
 * Tarayıcının yerleşik `<dialog>` öğesi: odak yakalama, Esc ile kapatma ve arka planı
 * etkisizleştirme tarayıcı tarafından sağlanır. Gövde kaydırılır; başlık ve alt düğmeler hep görünür.
 * Geri tuşu da pencereyi kapatır (bkz. `useCloseOnBack`).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: keyof typeof sizes
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useCloseOnBack(open, onClose)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className={`m-auto w-[calc(100%-2rem)] ${sizes[size]} rounded-lg bg-surface p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:animate-pop-in`}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
            </div>
            <Button variant="ghost" size="sm" aria-label="Kapat" onClick={onClose}>
              <X aria-hidden className="size-4" />
            </Button>
          </div>
          {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: ReactNode
  children?: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
