import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'

/**
 * Veri kaynağı açılamadığında gösterilir. Bozuk veya tanınmayan demo verisi kendiliğinden silinmez;
 * kullanıcı açıkça onaylarsa yalnızca Dietgo demo verileri silinir.
 */
export function StartupErrorPage({ message, onReset }: { message: string; onReset?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-50 p-4">
      <div role="alert" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto mb-3 inline-flex rounded-full bg-red-50 p-3 text-red-600">
          <AlertTriangle aria-hidden className="size-6" />
        </span>
        <h1 className="text-lg font-semibold text-slate-900">Dietgo başlatılamadı</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        {onReset && (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Mevcut veriler korunuyor. Devam etmek için demo verilerini sıfırlayabilirsiniz; bu işlem geri alınamaz.
            </p>
            <Button variant="danger" className="mt-5" onClick={() => setConfirming(true)}>
              Demo verilerini sıfırla
            </Button>
            <ConfirmDialog
              open={confirming}
              title="Demo verileri sıfırlansın mı?"
              description="Bu tarayıcıdaki tüm Dietgo demo verileri silinir ve örnek veriler yeniden yüklenir. Diğer sitelerin verileri etkilenmez."
              confirmLabel="Evet, sıfırla"
              onCancel={() => setConfirming(false)}
              onConfirm={onReset}
            />
          </>
        )}
      </div>
    </main>
  )
}
