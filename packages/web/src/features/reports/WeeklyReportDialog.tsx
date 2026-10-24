import type { Client } from '@diyetgo/shared'
import { Download, Share2, ShieldAlert } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { ErrorState, LoadingState } from '../../components/ui/feedback'
import { useToast } from '../../components/ui/toast-context'
import { useRepositoryQuery } from '../../data/context'
import { today } from '../../lib/format'
import { WeeklyReportCard } from './WeeklyReportCard'
import { loadWeeklyReport } from './weekly-report-data'

const NOTE_MAX = 300

/** Dosya adı için Türkçe karakterleri sadeleştirir: `Şule Çınar` → `sule-cinar`. */
function slug(text: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => map[c]!)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function renderPng(node: HTMLElement): Promise<Blob> {
  // Kütüphane yalnızca görsel üretilirken yüklenir; ana paket büyümez.
  const { domToBlob } = await import('modern-screenshot')
  return domToBlob(node, { scale: 3, type: 'image/png' })
}

function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'rapor.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

/**
 * Haftalık raporu önizler ve PNG olarak indirir veya (destekleyen telefonlarda) paylaşım menüsüyle
 * gönderir. Rapor saklanmaz; her açılışta güncel veriden üretilir.
 */
export function WeeklyReportDialog({ open, client, onClose }: { open: boolean; client: Client; onClose: () => void }) {
  const toast = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const noteId = useId()
  const date = today()
  // Dialog kapalıyken veri yüklenmez.
  const query = useRepositoryQuery((r) => (open ? loadWeeklyReport(r, client, date, new Date()) : Promise.resolve(null)), [open, client.id, date])
  const fileName = `diyetgo-rapor-${slug(client.firstName)}-${date}.png`
  const shareable = open && canShareFiles()

  async function exportImage(mode: 'download' | 'share') {
    if (!cardRef.current) return
    setBusy(true)
    try {
      const blob = await renderPng(cardRef.current)
      const file = new File([blob], fileName, { type: 'image/png' })
      if (mode === 'share') {
        await navigator.share({ files: [file], title: 'Haftalık rapor' })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        toast.success('Rapor görseli indirildi.')
      }
    } catch (error) {
      // Kullanıcı paylaşım menüsünü kapattıysa hata gösterilmez.
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error('Rapor görseli oluşturulamadı. Lütfen tekrar deneyin.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Haftalık rapor"
      description="Danışana gönderilecek özet görseli. Rapor kaydedilmez; güncel verilerden oluşturulur."
      footer={
        <>
          <Button onClick={onClose}>Kapat</Button>
          {shareable && (
            <Button disabled={busy || !query.data} onClick={() => exportImage('share')}>
              <Share2 aria-hidden className="size-4" />
              Paylaş
            </Button>
          )}
          <Button variant="primary" disabled={busy || !query.data} onClick={() => exportImage('download')}>
            <Download aria-hidden className="size-4" />
            {busy ? 'Hazırlanıyor…' : 'Görseli indir'}
          </Button>
        </>
      }
    >
      {query.status === 'loading' || (query.status === 'success' && !query.data) ? (
        <LoadingState label="Rapor hazırlanıyor…" />
      ) : query.status === 'error' && !query.data ? (
        <ErrorState error={query.error} />
      ) : (
        <div className="grid gap-5 md:grid-cols-[auto_1fr]">
          {/* Görsel sabit genişliktedir; dar ekranda yatay kaydırılır. */}
          <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
            <div className="mx-auto w-fit overflow-hidden rounded-[32px] ring-1 ring-slate-200">
              <WeeklyReportCard ref={cardRef} data={query.data!} note={note} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor={noteId} className="text-sm font-medium text-slate-700">
                Diyetisyen notu (isteğe bağlı)
              </label>
              <textarea
                id={noteId}
                value={note}
                maxLength={NOTE_MAX}
                rows={5}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ör. Bu hafta su tüketimine dikkat; akşam öğününde porsiyonu küçültelim."
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-xs focus:border-brand-600 focus:outline-none"
              />
              <span className="mt-1 block text-right text-xs text-slate-500 tabular-nums">
                {note.length} / {NOTE_MAX}
              </span>
            </div>
            <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              Görsel, danışanın kişisel sağlık verilerini içerir. Yalnızca danışanın onay verdiği ve güvendiğiniz bir kanaldan gönderin.
            </p>
            {!shareable && <p className="text-xs text-slate-500">Telefonda açıldığında görseli doğrudan WhatsApp veya e-postayla paylaşmak için "Paylaş" düğmesi görünür.</p>}
          </div>
        </div>
      )}
    </Dialog>
  )
}
