/** Randevu hatırlatıcıları: izin istemi (üst çubuk) ve Ayarlar bölümü. */
import { Bell, BellOff, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/layout'
import { playChime, unlockAudio } from '../../lib/chime'
import { dismissPrompt, notificationState, promptDismissed, remindersEnabled, setRemindersEnabled, type NotificationState } from './reminder-settings'

/** İzin yalnızca bir tıklamadan sonra istenebilir; tıklama sesin kilidini de açar. */
async function requestPermission(): Promise<NotificationState> {
  unlockAudio()
  if (notificationState() === 'unsupported') return 'unsupported'
  try {
    await Notification.requestPermission()
  } catch {
    // Eski tarayıcılar geri çağırma kullanır; durum aşağıda yeniden okunur.
  }
  return notificationState()
}

/** Bildirim izni henüz sorulmadıysa üstte kısa bir davet gösterir. */
export function ReminderPrompt() {
  const [state, setState] = useState(notificationState)
  const [dismissed, setDismissed] = useState(promptDismissed)
  if (state !== 'default' || dismissed || !remindersEnabled()) return null

  async function allow() {
    setState(await requestPermission())
    void playChime()
  }

  return (
    <aside aria-label="Randevu bildirimleri" className="border-b border-brand-200 bg-brand-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-brand-800 sm:px-6">
        <p className="flex items-center gap-2">
          <Bell aria-hidden className="size-4 shrink-0" />
          Randevudan 1 saat önce ve randevu saatinde bildirim ve sesle hatırlatalım mı?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void allow()}
            className="inline-flex h-9 items-center rounded-md bg-brand-700 px-3 font-medium text-white hover:bg-brand-800 pointer-coarse:h-11"
          >
            Bildirimlere izin ver
          </button>
          <button
            type="button"
            onClick={() => {
              dismissPrompt()
              setDismissed(true)
            }}
            className="h-9 rounded-md px-3 hover:bg-brand-100 pointer-coarse:h-11"
          >
            Şimdi değil
          </button>
        </div>
      </div>
    </aside>
  )
}

export function RemindersSection() {
  const [enabled, setEnabled] = useState(remindersEnabled)
  const [state, setState] = useState(notificationState)

  return (
    <Card>
      <CardHeader
        title="Randevu hatırlatıcıları"
        description="Her planlanmış randevudan 1 saat önce ve randevu saatinde bildirim ve ses ile hatırlatılırsınız. İptal edilen veya tamamlanan randevular hatırlatılmaz."
        actions={
          <Button
            size="sm"
            onClick={() => {
              unlockAudio()
              void playChime()
            }}
          >
            <Volume2 aria-hidden className="size-4" />
            Sesi dene
          </Button>
        }
      />
      <div className="space-y-3 px-5 py-4 text-sm">
        <label className="flex items-center gap-2 font-medium text-slate-800">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setRemindersEnabled(e.target.checked)
              setEnabled(e.target.checked)
            }}
            className="size-4 rounded border-slate-300 accent-brand-700"
          />
          Hatırlatıcılar açık
        </label>

        {state === 'granted' && (
          <p className="flex items-center gap-2 text-slate-600">
            <Bell aria-hidden className="size-4 text-brand-700" />
            Sistem bildirimleri açık.
          </p>
        )}
        {state === 'default' && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-slate-600">
              <BellOff aria-hidden className="size-4" />
              Sistem bildirimi için izin verilmedi.
            </p>
            <Button size="sm" variant="primary" onClick={async () => setState(await requestPermission())}>
              Bildirim iznini ver
            </Button>
          </div>
        )}
        {state === 'denied' && (
          <p className="flex items-center gap-2 text-slate-600">
            <BellOff aria-hidden className="size-4" />
            Bildirimler engellenmiş. Tarayıcının site ayarlarından bu site için bildirime izin verin.
          </p>
        )}
        {state === 'unsupported' && (
          <p className="text-slate-600">
            Bu tarayıcıda sistem bildirimi yok. iPhone ve iPad'de uygulamayı önce Safari'den "Ana Ekrana Ekle" ile yükleyin (iOS 16.4 ve üzeri); o zamana kadar yalnızca ses ve ekrandaki uyarı çalışır.
          </p>
        )}

        <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-100">
          Hatırlatıcılar uygulama (veya yüklü uygulama penceresi) açıkken çalışır. Uygulama tamamen kapalıyken bildirim gelmez; bunun için sunucudan gönderilen bildirim gerekir ve backend henüz yayında değil. Telefon ekranı kilitliyken tarayıcı sayaçları geciktirebilir.
        </p>
      </div>
    </Card>
  )
}
