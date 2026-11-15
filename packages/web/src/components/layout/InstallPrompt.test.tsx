import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstallPrompt } from './InstallPrompt'

const setUserAgent = (ua: string, touchPoints = 0) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
  vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(touchPoints)
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Uygulamayı yükleme önerisi', () => {
  it("iPad'de (Mac gibi görünen dokunmatik Safari) Ana Ekrana Ekle yönergesini gösterir; kapatılınca hatırlanır", async () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 5)
    const view = render(<InstallPrompt />)
    expect(screen.getByText('Ana Ekrana Ekle', { exact: false })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Yükleme önerisini kapat' }))
    expect(screen.queryByRole('complementary', { name: 'Uygulamayı yükle' })).toBeNull()
    view.unmount()
    render(<InstallPrompt />)
    expect(screen.queryByRole('complementary', { name: 'Uygulamayı yükle' })).toBeNull()
  })

  it('tarayıcı yüklemeyi destekliyorsa yükle düğmesi yükleme penceresini açar', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/130.0')
    render(<InstallPrompt />)
    expect(screen.queryByRole('button', { name: 'Uygulamayı yükle' })).toBeNull()
    const prompt = vi.fn(() => Promise.resolve())
    act(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) }))
    })
    await userEvent.click(screen.getByRole('button', { name: 'Uygulamayı yükle' }))
    expect(prompt).toHaveBeenCalled()
  })

  it('masaüstü Safari gibi yükleme yolu olmayan tarayıcıda hiçbir şey göstermez', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 0)
    render(<InstallPrompt />)
    expect(screen.queryByRole('complementary', { name: 'Uygulamayı yükle' })).toBeNull()
  })
})
