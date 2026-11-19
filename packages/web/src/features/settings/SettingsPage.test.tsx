import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reportUpdate, resetUpdateState } from '../../lib/app-update'
import { renderApp, fixDate } from '../../test-utils'

fixDate()
const renderSettings = (storage?: Storage) => renderApp('/settings', storage)

describe('Ayarlar: demo verilerini sıfırlama', () => {
  it('vazgeçilirse veriler korunur; onaylanırsa örnek verilere döner', async () => {
    const { repositories, user } = renderSettings()
    await repositories.clients.create({ firstName: 'Ek', lastName: 'Danışan', birthDate: null, sex: null, email: null, phone: null, notes: null })

    await user.click(await screen.findByRole('button', { name: 'Demo verilerini sıfırla' }))
    const dialog = await screen.findByRole('dialog', { name: 'Demo verileri sıfırlansın mı?' })
    expect(within(dialog).getByText('Danışan').nextSibling?.textContent).toBe('5')
    await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
    expect((await repositories.clients.list()).some((c) => c.firstName === 'Ek')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Demo verilerini sıfırla' }))
    await user.click(await screen.findByRole('button', { name: 'Evet, tüm demo verilerini sıfırla' }))
    expect(await screen.findByText('Demo verileri sıfırlandı ve örnek veriler yeniden yüklendi.')).toBeDefined()
    expect((await repositories.clients.list()).some((c) => c.firstName === 'Ek')).toBe(false)
  })
})

describe('Ayarlar: öğün türleri', () => {
  it('doğrulama hatasını alanda gösterir, kaydeder ve yeniden açılışta korur', async () => {
    const { storage, user, unmount } = renderSettings()
    await screen.findByText('Kahvaltı')

    await user.click(screen.getByRole('button', { name: 'Öğün türü ekle' }))
    await user.click(screen.getByRole('button', { name: 'Ekle' }))
    const nameInput = screen.getByLabelText(/Öğün türü adı/)
    expect(nameInput.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Bu alan zorunludur')).toBeDefined()

    await user.type(nameInput, 'Spor sonrası')
    await user.click(screen.getByRole('button', { name: 'Ekle' }))
    expect(await screen.findByText('Öğün türü eklendi.')).toBeDefined()
    expect(await screen.findByText('Spor sonrası')).toBeDefined()

    unmount()
    renderSettings(storage)
    expect(await screen.findByText('Spor sonrası')).toBeDefined()
  })

  it('planda kullanılan öğün türünün silinmesini engeller ve nedenini bildirir', async () => {
    const { user } = renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Kahvaltı sil' }))
    await user.click(await screen.findByRole('button', { name: 'Sil' }))
    expect(await screen.findByText('Bu öğün türü bir planda kullanılıyor. Silmek yerine arşivleyin.')).toBeDefined()
    await waitFor(() => expect(screen.getByText('Kahvaltı')).toBeDefined())
  })
})

describe('Uygulama kabuğu', () => {
  it('demo uyarısını ve menüyü gösterir', async () => {
    renderSettings()
    expect(await screen.findByText(/Veriler yalnızca bu tarayıcıda tutulur/)).toBeDefined()
    expect(screen.getAllByRole('link', { name: 'Danışanlar' }).length).toBeGreaterThan(0)
  })
})

describe('Ayarlar: hesap silme', () => {
  it('demo modunda hesap olmadığı için gösterilmez', async () => {
    renderApp('/settings')
    await screen.findByRole('heading', { name: 'Ayarlar' })
    expect(screen.queryByRole('button', { name: 'Hesabımı sil' })).toBeNull()
  })
})

describe('Ayarlar: sürüm', () => {
  const worker = {} as ServiceWorker
  const registration = (waiting: ServiceWorker | null) => ({ installing: null, waiting, update: () => Promise.resolve() })

  beforeEach(resetUpdateState)

  it('service worker yoksa sayfayı yenileme önerir', async () => {
    renderApp('/settings')
    expect(await screen.findByRole('button', { name: 'Sayfayı yenile' })).toBeDefined()
    expect(screen.getByText(/Yüklü sürüm:/)).toBeDefined()
  })

  it('en yeni sürümdeyse "Güncelsiniz" yazar', async () => {
    reportUpdate({ registration: registration(null) })
    renderApp('/settings')
    expect(await screen.findByText('Güncelsiniz. En yeni sürümü kullanıyorsunuz.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Yeni sürüme güncelle' })).toBeNull()
  })

  it('yeni sürüm hazırsa güncelle düğmesi gösterir ve uygular', async () => {
    const apply = vi.fn(() => Promise.resolve())
    reportUpdate({ registration: registration(worker), apply })
    const { user } = renderApp('/settings')
    await user.click(await screen.findByRole('button', { name: 'Yeni sürüme güncelle' }))
    expect(apply).toHaveBeenCalledWith(true)
  })
})
