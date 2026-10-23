import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, fixDate } from '../../test-utils'

fixDate()

const rowNames = () =>
  within(screen.getByRole('table', { name: 'Danışan listesi' }))
    .getAllByRole('link')
    .map((link) => link.textContent)

describe('Danışan listesi', () => {
  it('aktif danışanları listeler; arşivdekileri isteğe bağlı gösterir', async () => {
    const { user } = renderApp('/clients')
    await screen.findByRole('table', { name: 'Danışan listesi' })
    // Soyada göre Türkçe alfabetik sıra: Deneme, Örnek, Taslak (Ö, T'den önce gelir).
    expect(rowNames()).toEqual(['Ece Deneme', 'Deniz Örnek', 'Kaan Taslak'])
    await user.click(screen.getByLabelText('Arşivdekileri göster'))
    expect(await screen.findByText('Selin Kurgu')).toBeDefined()
    expect(screen.getAllByText('Arşivde')).toHaveLength(1)
  })

  it('arar ve sonuç yoksa bunu belirtir', async () => {
    const { user } = renderApp('/clients')
    const search = await screen.findByRole('searchbox', { name: 'Danışan ara' })
    await user.type(search, 'KAAN')
    expect(await screen.findByText('Kaan Taslak')).toBeDefined()
    expect(rowNames()).toEqual(['Kaan Taslak'])
    await user.clear(search)
    await user.type(search, 'yok-boyle-biri')
    expect(await screen.findByText('Sonuç bulunamadı')).toBeDefined()
  })

  it('yeni danışanı doğrular, kaydeder, detayına gider ve yeniden açılışta korur', async () => {
    const { user, storage, unmount } = renderApp('/clients')
    await user.click(await screen.findByRole('button', { name: 'Yeni danışan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yeni danışan' })

    await user.click(within(dialog).getByRole('button', { name: 'Danışan ekle' }))
    expect(await within(dialog).findAllByText('Bu alan zorunludur')).toHaveLength(2)
    expect(within(dialog).getByLabelText(/^Ad/).getAttribute('aria-invalid')).toBe('true')

    await user.type(within(dialog).getByLabelText(/^Ad/), 'Arda')
    await user.type(within(dialog).getByLabelText(/^Soyad/), 'Deneme')
    await user.type(within(dialog).getByLabelText('E-posta'), 'gecersiz')
    await user.click(within(dialog).getByRole('button', { name: 'Danışan ekle' }))
    expect(await within(dialog).findByText('Geçerli bir e-posta adresi girin')).toBeDefined()

    await user.clear(within(dialog).getByLabelText('E-posta'))
    await user.type(within(dialog).getByLabelText('E-posta'), 'arda@example.com')
    await user.click(within(dialog).getByRole('button', { name: 'Danışan ekle' }))
    expect(await screen.findByText('Danışan eklendi.')).toBeDefined()
    expect(await screen.findByRole('heading', { name: 'Arda Deneme' })).toBeDefined()

    unmount()
    renderApp('/clients', storage)
    expect(await screen.findByText('Arda Deneme')).toBeDefined()
  })
})
