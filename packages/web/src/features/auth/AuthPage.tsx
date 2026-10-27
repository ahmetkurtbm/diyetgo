/**
 * Diyetisyen girişi (API modu): giriş, hesap oluşturma, parola sıfırlama isteği ve yeni parola.
 * Parola sıfırlama bağlantısı `?token=` ile bu sayfaya döner.
 */
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/form'
import { authClient, authErrorMessage } from '../../data/api/auth-client'

const MIN_PASSWORD = 10
export const RESET_PATH = '/parola-sifirla'

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'reset'

function initialMode(): Mode {
  return new URLSearchParams(window.location.search).has('token') ? 'reset' : 'sign-in'
}

function Brand() {
  return (
    <span className="flex items-center justify-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-11 rounded-xl" />
      <span className="text-3xl font-extrabold tracking-tight lowercase">
        <span className="text-slate-900">diyet</span>
        <span className="text-lime-600">go</span>
      </span>
    </span>
  )
}

function Tabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => onChange(value)}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === value ? 'bg-surface text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
    >
      {label}
    </button>
  )
  return (
    <div role="tablist" aria-label="Hesap" className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {tab('sign-in', 'Giriş yap')}
      {tab('sign-up', 'Hesap oluştur')}
    </div>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex gap-2 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
      <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export function AuthPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    setPassword('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if ((mode === 'sign-up' || mode === 'reset') && password.length < MIN_PASSWORD) {
      setError(`Parola en az ${MIN_PASSWORD} karakter olmalı.`)
      return
    }
    setBusy(true)
    try {
      if (mode === 'sign-in') {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) return setError(authErrorMessage(error))
        onSignedIn()
      } else if (mode === 'sign-up') {
        const { error } = await authClient.signUp.email({ name: name.trim(), email, password })
        if (error) return setError(authErrorMessage(error))
        onSignedIn()
      } else if (mode === 'forgot') {
        const { error } = await authClient.requestPasswordReset({ email, redirectTo: RESET_PATH })
        if (error) return setError(authErrorMessage(error))
        // Hesabın var olup olmadığı açıklanmaz.
        setNotice('Bu e-postayla bir hesap varsa parola sıfırlama bağlantısı gönderildi.')
      } else {
        const token = new URLSearchParams(window.location.search).get('token') ?? ''
        const { error } = await authClient.resetPassword({ newPassword: password, token })
        if (error) return setError(authErrorMessage(error))
        window.history.replaceState(null, '', '/')
        switchMode('sign-in')
        setNotice('Parolanız değiştirildi. Yeni parolanızla giriş yapabilirsiniz.')
      }
    } catch {
      setError("Sunucuya ulaşılamadı. Yerel API'nin çalıştığından emin olun (npm run dev:server).")
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<Mode, { title: string; description: string; submit: string }> = {
    'sign-in': { title: 'Tekrar hoş geldiniz', description: 'Danışanlarınıza ve planlarınıza erişmek için giriş yapın.', submit: 'Giriş yap' },
    'sign-up': { title: 'Diyetisyen hesabı oluşturun', description: 'Danışanlarınız yalnızca sizin hesabınızda görünür.', submit: 'Hesap oluştur' },
    forgot: { title: 'Parolanızı mı unuttunuz?', description: 'E-postanızı girin; parola sıfırlama bağlantısı gönderelim.', submit: 'Bağlantı gönder' },
    reset: { title: 'Yeni parola belirleyin', description: 'En az 10 karakterlik yeni bir parola seçin.', submit: 'Parolayı değiştir' },
  }
  const copy = titles[mode]

  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Brand />
        <section className="mt-8 animate-pop-in rounded-xl border border-slate-200 bg-surface p-6 sm:p-8">
          {(mode === 'sign-in' || mode === 'sign-up') && <Tabs mode={mode} onChange={switchMode} />}
          <h1 className="mt-6 text-xl font-semibold text-slate-900">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{copy.description}</p>

          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            {notice && <Notice>{notice}</Notice>}
            {mode === 'sign-up' && <TextField label="Ad soyad" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
            {mode !== 'reset' && <TextField label="E-posta" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            {mode !== 'forgot' && (
              <TextField
                label={mode === 'reset' ? 'Yeni parola' : 'Parola'}
                type="password"
                required
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                hint={mode === 'sign-in' ? undefined : `En az ${MIN_PASSWORD} karakter.`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            {error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? 'Lütfen bekleyin…' : copy.submit}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === 'sign-in' && (
              <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => switchMode('forgot')}>
                Parolamı unuttum
              </button>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => switchMode('sign-in')}>
                Girişe dön
              </button>
            )}
          </div>
        </section>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck aria-hidden className="size-4" />
          Yerel geliştirme sürümü. Gerçek kişisel veya sağlık verisi girmeyin.
        </p>
      </div>
    </main>
  )
}
