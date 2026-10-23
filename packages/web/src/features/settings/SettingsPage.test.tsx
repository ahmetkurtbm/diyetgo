import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppProviders, AppRoutes } from '../../App'
import { MemoryStorage } from '../../data/demo/memory-storage'
import { createDemoRepositories } from '../../data/demo/repositories'
import { openDemoStore } from '../../data/demo/store'

const now = () => new Date('2026-03-10T09:00:00.000Z')

function renderSettings(storage = new MemoryStorage()) {
  const opened = openDemoStore({ storage, now })
  if (!opened.ok) throw new Error(opened.error.message)
  const repositories = createDemoRepositories(opened.store, { now })
  const view = render(
    <AppProviders repositories={repositories}>
      <MemoryRouter initialEntries={['/settings']}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  )
  return { ...view, storage, repositories, user: userEvent.setup() }
}

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
    expect(await screen.findByText(/Demo modu: veriler yalnızca bu tarayıcıda tutulur/)).toBeDefined()
    expect(screen.getAllByRole('link', { name: 'Danışanlar' }).length).toBeGreaterThan(0)
  })
})
