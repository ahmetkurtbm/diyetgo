/**
 * Serbest menüyü PDF olarak indirir veya Canva'ya yapıştırmak için kopyalar. Yazılan metin
 * dışa aktarılırken düzeltilir (bkz. `correctMealText`); kayıtlı veri değişmez.
 */
import { planDocumentToHtml, planDocumentToText, type Client, type MealPlan, type MealType, type PlanMeal } from '@diyetgo/shared'
import { ClipboardCopy, FileDown } from 'lucide-react'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { TextField } from '../../components/ui/form'
import { useToast } from '../../components/ui/toast-context'
import { useAccount } from '../../components/layout/account-context'
import { saveBlob, slug } from '../../lib/files'
import { today } from '../../lib/format'
import { buildPdf, pageCuts, type PdfPage } from '../../lib/pdf'
import { loadDecoration, PAGE_PX } from '../../lib/plan-decor'
import { buildPlanDocument } from './plan-document'
import { PlanDocumentView } from './PlanDocumentView'

const SCALE = 2
const MARGIN_PX = 56
const NAME_KEY = 'diyetgo:dietitian-name'

function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Belgeyi görsele çizer, bloklara göre sayfalara böler ve her sayfaya çiçekli zemini ekleyip PDF yazar. */
async function renderPdf(node: HTMLElement): Promise<Blob> {
  // Kütüphane yalnızca çıktı üretilirken yüklenir; ana paket büyümez.
  const { domToCanvas } = await import('modern-screenshot')
  const source = await domToCanvas(node, { scale: SCALE, backgroundColor: null })
  const top = node.getBoundingClientRect().top
  const bottoms = [...node.querySelectorAll('[data-pdf-block]')].map((el) => el.getBoundingClientRect().bottom - top)
  const cuts = pageCuts(bottoms, node.offsetHeight, PAGE_PX.height - 2 * MARGIN_PX)
  const decoration = await loadDecoration()
  const pages: PdfPage[] = []
  for (const [from, to] of cuts) {
    const page = document.createElement('canvas')
    page.width = PAGE_PX.width * SCALE
    page.height = PAGE_PX.height * SCALE
    const context = page.getContext('2d')!
    context.fillStyle = '#fffafc'
    context.fillRect(0, 0, page.width, page.height)
    context.drawImage(decoration, 0, 0, page.width, page.height)
    context.drawImage(source, 0, from * SCALE, source.width, (to - from) * SCALE, 0, MARGIN_PX * SCALE, source.width, (to - from) * SCALE)
    const blob = await new Promise<Blob | null>((resolve) => page.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) throw new Error('Sayfa görseli oluşturulamadı')
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: page.width, height: page.height })
  }
  return new Blob([buildPdf(pages)], { type: 'application/pdf' })
}

type Props = { open: boolean; plan: MealPlan; client: Client; meals: PlanMeal[]; mealTypes: MealType[]; onClose: () => void }

export function PlanExportDialog({ open, plan, client, meals, mealTypes, onClose }: Props) {
  const toast = useToast()
  const account = useAccount()
  const captureRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState(() => account?.name ?? savedName())
  const [busy, setBusy] = useState(false)
  // Önizleme pencerenin genişliğine sığar; telefonda küçülür.
  const zoom = Math.min(0.8, (Math.min(672, window.innerWidth - 32) - 44) / PAGE_PX.width)

  const doc = buildPlanDocument(plan, client, meals, mealTypes, name)
  const empty = doc.days.length === 0

  function rememberName() {
    try {
      localStorage.setItem(NAME_KEY, name.trim())
    } catch {
      // Kaydedilemese de çıktı alınabilir.
    }
  }

  async function download() {
    if (!captureRef.current) return
    setBusy(true)
    try {
      rememberName()
      await document.fonts?.ready
      saveBlob(await renderPdf(captureRef.current), `diyetgo-plan-${slug(client.firstName)}-${today()}.pdf`)
      toast.success('PDF indirildi.')
    } catch {
      toast.error('PDF oluşturulamadı. Lütfen tekrar deneyin.')
    } finally {
      setBusy(false)
    }
  }

  async function copy(rich: boolean) {
    try {
      rememberName()
      const text = planDocumentToText(doc)
      if (rich && typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([planDocumentToHtml(doc)], { type: 'text/html' }) })])
      } else {
        await navigator.clipboard.writeText(text)
      }
      toast.success(rich ? 'Biçimli metin kopyalandı.' : "Kopyalandı; Canva'da yapıştırabilirsiniz.")
    } catch {
      toast.error('Kopyalanamadı. Tarayıcı panoya erişime izin vermiyor olabilir.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="PDF ve Canva"
      description="Yazdıklarınız düzeltilip öğün sırasına göre, danışan adı ve tarihle şık bir belgeye dönüşür."
      footer={
        <>
          <Button onClick={onClose}>Kapat</Button>
          <Button disabled={empty} onClick={() => void copy(true)}>
            <ClipboardCopy aria-hidden className="size-4" />
            Biçimli kopyala
          </Button>
          <Button disabled={empty} onClick={() => void copy(false)}>
            <ClipboardCopy aria-hidden className="size-4" />
            Canva için kopyala
          </Button>
          <Button variant="primary" disabled={empty || busy} onClick={() => void download()}>
            <FileDown aria-hidden className="size-4" />
            {busy ? 'Hazırlanıyor…' : 'PDF indir'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Diyetisyen adı" autoComplete="name" hint="Belgede görünür; bu tarayıcıda hatırlanır." value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        {empty ? (
          <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">Henüz yazılmış öğün yok. Önce günlerin menüsünü yazıp kaydedin.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <div aria-label="Belge önizlemesi" style={{ zoom }}>
              <PlanDocumentView doc={doc} decorated />
            </div>
          </div>
        )}
      </div>
      {/* PDF bu gizli kopyadan üretilir: ölçek ve kaydırmadan etkilenmez, zemin şeffaftır. */}
      {open &&
        !empty &&
        createPortal(
          <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0 }}>
            <PlanDocumentView ref={captureRef} doc={doc} />
          </div>,
          document.body,
        )}
    </Dialog>
  )
}
