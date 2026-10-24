/**
 * API modunda uygulamayı oturuma bağlar: oturum yoksa giriş ekranı, varsa uygulama gösterilir.
 * Oturum düştüğünde (API 401 döndürdüğünde) giriş ekranına dönülür; uygulama yeniden kurulduğu için
 * önceki diyetisyenin verisi ekranda kalmaz.
 */
import { useEffect, useMemo, type ReactNode } from 'react'
import { AccountContext, type Account } from '../../components/layout/account-context'
import { LoadingState } from '../../components/ui/feedback'
import { UNAUTHORIZED_EVENT } from '../../data/api/repositories'
import { authClient } from '../../data/api/auth-client'
import { AuthPage } from './AuthPage'

export function AuthGate({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const { refetch } = session

  useEffect(() => {
    const onUnauthorized = () => refetch()
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [refetch])

  const user = session.data?.user
  const account = useMemo<Account | null>(
    () =>
      user
        ? {
            name: user.name,
            email: user.email,
            signOut: async () => {
              await authClient.signOut()
              refetch()
            },
          }
        : null,
    [user, refetch],
  )

  if (session.isPending) return <LoadingState label="Oturum kontrol ediliyor…" />
  if (!account) return <AuthPage onSignedIn={() => refetch()} />
  return (
    // Hesap değişince uygulama sıfırdan kurulur (önbellekteki veri karışmaz).
    <AccountContext value={account} key={user!.id}>
      {children}
    </AccountContext>
  )
}

export default AuthGate
