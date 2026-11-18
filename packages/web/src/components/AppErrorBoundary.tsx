import { Component, type ReactNode } from 'react'
import { StartupErrorPage } from '../features/startup/StartupErrorPage'

type Props = { children: ReactNode; onReset?: () => void }

/**
 * Ekran çizilirken beklenmeyen bir hata olursa boş ekran yerine bir hata ekranı gösterir. Demo modunda
 * bozuk veri ekranın hep çökmesine yol açabileceği için verileri sıfırlama seçeneği de sunulur.
 */
export class AppErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Uygulama hatası', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <StartupErrorPage
        title="Bir sorun oluştu"
        message="Sayfa gösterilirken beklenmeyen bir hata oluştu. Sayfayı yenilemeyi deneyin."
        onReload={() => window.location.reload()}
        onReset={this.props.onReset}
      />
    )
  }
}
