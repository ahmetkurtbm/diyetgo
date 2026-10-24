import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage, RESET_PATH } from './AuthPage'

const authClient = vi.hoisted(() => ({
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

vi.mock('../../data/api/auth-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/api/auth-client')>()),
  authClient,
}))

function setup() {
  const onSignedIn = vi.fn()
  render(<AuthPage onSignedIn={onSignedIn} />)
  return { onSignedIn, user: userEvent.setup() }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('Giriş ekranı', () => {
  it('giriş yapar ve hatalı parolada Türkçe hata gösterir', async () => {
    const { onSignedIn, user } = setup()
    authClient.signIn.email.mockResolvedValueOnce({ error: { code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 } })
    await user.type(screen.getByLabelText(/E-posta/), 'diyetisyen@example.com')
    await user.type(screen.getByLabelText(/^Parola/), 'yanlis-parola')
    await user.click(screen.getByRole('button', { name: 'Giriş yap' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'E-posta veya parola hatalı.')
    expect(onSignedIn).not.toHaveBeenCalled()

    authClient.signIn.email.mockResolvedValueOnce({ data: {}, error: null })
    await user.click(screen.getByRole('button', { name: 'Giriş yap' }))
    expect(onSignedIn).toHaveBeenCalledOnce()
    expect(authClient.signIn.email).toHaveBeenLastCalledWith({ email: 'diyetisyen@example.com', password: 'yanlis-parola' })
  })

  it('hesap oluştururken kısa parolayı sunucuya göndermeden reddeder; var olan e-postayı bildirir', async () => {
    const { onSignedIn, user } = setup()
    await user.click(screen.getByRole('tab', { name: 'Hesap oluştur' }))
    await user.type(screen.getByLabelText(/Ad soyad/), 'Yeni Diyetisyen')
    await user.type(screen.getByLabelText(/E-posta/), 'yeni@example.com')
    await user.type(screen.getByLabelText(/^Parola/), 'kisa')
    await user.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect(screen.getByRole('alert').textContent).toBe('Parola en az 10 karakter olmalı.')
    expect(authClient.signUp.email).not.toHaveBeenCalled()

    authClient.signUp.email.mockResolvedValueOnce({ error: { code: 'USER_ALREADY_EXISTS', status: 422 } })
    await user.type(screen.getByLabelText(/^Parola/), '-uzun-parola')
    await user.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/zaten var/)
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('parola sıfırlama isteğinde hesabın var olup olmadığını açıklamaz', async () => {
    const { user } = setup()
    authClient.requestPasswordReset.mockResolvedValueOnce({ data: {}, error: null })
    await user.click(screen.getByRole('button', { name: 'Parolamı unuttum' }))
    await user.type(screen.getByLabelText(/E-posta/), 'biri@example.com')
    await user.click(screen.getByRole('button', { name: 'Bağlantı gönder' }))
    expect((await screen.findByRole('status')).textContent).toMatch(/hesap varsa/)
    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({ email: 'biri@example.com', redirectTo: RESET_PATH })
  })

  it('bağlantıdaki token ile yeni parola belirler ve girişe döner', async () => {
    window.history.replaceState(null, '', `${RESET_PATH}?token=abc123`)
    const { user } = setup()
    authClient.resetPassword.mockResolvedValueOnce({ data: {}, error: null })
    await user.type(screen.getByLabelText(/Yeni parola/), 'yeni-guclu-parola')
    await user.click(screen.getByRole('button', { name: 'Parolayı değiştir' }))
    expect(authClient.resetPassword).toHaveBeenCalledWith({ newPassword: 'yeni-guclu-parola', token: 'abc123' })
    expect((await screen.findByRole('status')).textContent).toMatch(/Parolanız değiştirildi/)
    expect(window.location.pathname).toBe('/')
  })
})
