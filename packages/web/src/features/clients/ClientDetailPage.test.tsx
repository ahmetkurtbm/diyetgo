import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, SEED_IDS, fixDate } from '../../test-utils'

fixDate()

const measurementRows = () => within(screen.getByRole('table', { name: 'Ölçüm geçmişi' })).getAllByRole('row').slice(1)

describe('Danışan detayı', () => {
  it('bilgileri, ölçüm geçmişini ve kilo grafiğini gösterir', async () => {
    renderApp(`/clients/${SEED_IDS.deniz}`)
    expect(await screen.findByRole('heading', { name: 'Deniz Örnek' })).toBeDefined()
    expect(screen.getByText('12 Nisan 1990 (35 yaş)')).toBeDefined()
    expect(screen.getByText('deniz.ornek@example.com')).toBeDefined()
    expect(await screen.findByRole('table', { name: 'Ölçüm geçmişi' })).toBeDefined()
    expect(measurementRows()).toHaveLength(3)
    const chart = screen.getByRole('group', { name: /Kilo değişimi/ })
    expect(chart.getAttribute('aria-label')).toContain('78,4 kg')
    expect(chart.getAttribute('aria-label')).toContain('75,8 kg')
    expect(chart.getAttribute('aria-label')).toContain('-2,6 kg')
  })

  it('bulunamayan danışan için boş durum gösterir', async () => {
    renderApp('/clients/00000000-0000-4000-8000-0000000000ff')
    expect(await screen.findByText('Danışan bulunamadı')).toBeDefined()
  })

  it('danışanı düzenler; ilişkili kaydı varken silmeyi engeller; arşivler', async () => {
    const { user } = renderApp(`/clients/${SEED_IDS.deniz}`)
    await user.click(await screen.findByRole('button', { name: 'Düzenle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Danışanı düzenle' })
    await user.clear(within(dialog).getByLabelText('Notlar'))
    await user.type(within(dialog).getByLabelText('Notlar'), 'Yeni not')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Danışan bilgileri güncellendi.')).toBeDefined()
    expect(await screen.findByText('Yeni not')).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Danışanı sil' }))
    await user.click(await screen.findByRole('button', { name: 'Sil' }))
    expect(await screen.findByText(/Silmek yerine arşivleyin/)).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Arşivle' }))
    expect(await screen.findByText('Danışan arşivlendi.')).toBeDefined()
    expect(await screen.findByText(/Bu danışan arşivde/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Arşivden çıkar' })).toBeDefined()
  })
})

describe('Ölçümler', () => {
  it('boş ölçümü reddeder; ekler, düzenler ve siler', async () => {
    const { user, storage, unmount } = renderApp(`/clients/${SEED_IDS.deniz}`)
    await screen.findByRole('table', { name: 'Ölçüm geçmişi' })

    // Ekle: önce boş gönderim, sonra geçerli değer (ondalık virgülle).
    await user.click(screen.getByRole('button', { name: 'Ölçüm ekle' }))
    let dialog = await screen.findByRole('dialog', { name: 'Yeni ölçüm' })
    await user.click(within(dialog).getByRole('button', { name: 'Ölçüm ekle' }))
    expect(await within(dialog).findByText('En az bir ölçüm değeri girilmeli')).toBeDefined()
    await user.type(within(dialog).getByLabelText('Kilo (kg)'), '74,9')
    await user.click(within(dialog).getByRole('button', { name: 'Ölçüm ekle' }))
    expect(await screen.findByText('Ölçüm eklendi.')).toBeDefined()
    expect(measurementRows()).toHaveLength(4)
    expect(within(measurementRows()[0]!).getByText('74,9 kg')).toBeDefined()

    // Düzenle: en yeni ölçüm.
    await user.click(within(measurementRows()[0]!).getByRole('button', { name: /düzenle$/ }))
    dialog = await screen.findByRole('dialog', { name: 'Ölçümü düzenle' })
    const weight = within(dialog).getByLabelText('Kilo (kg)') as HTMLInputElement
    expect(weight.value).toBe('74,9')
    await user.clear(weight)
    await user.type(weight, '600')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))
    expect(await within(dialog).findByText('En fazla 500 olabilir')).toBeDefined()
    await user.clear(weight)
    await user.type(weight, '74,5')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Ölçüm güncellendi.')).toBeDefined()
    expect(within(measurementRows()[0]!).getByText('74,5 kg')).toBeDefined()

    // Sil: onaydan vazgeçilirse silinmez, onaylanırsa silinir.
    await user.click(within(measurementRows()[0]!).getByRole('button', { name: /sil$/ }))
    await user.click(await screen.findByRole('button', { name: 'Vazgeç' }))
    expect(measurementRows()).toHaveLength(4)
    await user.click(within(measurementRows()[0]!).getByRole('button', { name: /sil$/ }))
    await user.click(await screen.findByRole('button', { name: 'Sil' }))
    expect(await screen.findByText('Ölçüm silindi.')).toBeDefined()
    expect(measurementRows()).toHaveLength(3)

    // Sayfa yenileme: değişiklikler korunur.
    unmount()
    renderApp(`/clients/${SEED_IDS.deniz}`, storage)
    await screen.findByRole('table', { name: 'Ölçüm geçmişi' })
    expect(measurementRows()).toHaveLength(3)
  })

  it('ölçümü olmayan danışanda boş durum, tek kilo ölçümünde grafik yerine açıklama gösterir', async () => {
    const { repositories, storage, unmount, user } = renderApp('/clients')
    const created = await repositories.clients.create({ firstName: 'Boş', lastName: 'Kayıt', birthDate: null, sex: null, email: null, phone: null, notes: null })
    unmount()
    renderApp(`/clients/${created.id}`, storage)
    expect(await screen.findByText('Henüz ölçüm yok')).toBeDefined()

    await user.click(screen.getAllByRole('button', { name: 'Ölçüm ekle' })[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'Yeni ölçüm' })
    await user.type(within(dialog).getByLabelText('Kilo (kg)'), '70')
    await user.click(within(dialog).getByRole('button', { name: 'Ölçüm ekle' }))
    expect(await screen.findByText('Grafik için en az iki kilo ölçümü gerekir.')).toBeDefined()
  })
})

describe('Sağlık bilgileri ve öneriler', () => {
  const list = (name: string) => screen.findByRole('list', { name })

  it('seed kayıtlarını gösterir; ilaç ekler, öneriyi düzenler ve hastalığı siler', async () => {
    const { user } = renderApp(`/clients/${SEED_IDS.deniz}`)
    expect(within(await list('Hastalıklar ve sağlık durumu')).getByText('Demir eksikliği (örnek)')).toBeDefined()
    expect(within(await list('İlaçlar ve takviyeler')).getByText('Demir takviyesi (örnek) · 1 tablet')).toBeDefined()
    expect(within(await list('Diyetisyen önerileri')).getByText(/Gün içine yayarak su için/)).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'İlaç ekle' }))
    let dialog = await screen.findByRole('dialog', { name: 'İlaç ekle' })
    await user.click(within(dialog).getByRole('button', { name: 'Ekle' }))
    expect(within(dialog).getByText('Bu alan zorunludur')).toBeDefined()
    await user.type(within(dialog).getByLabelText(/İlaç veya takviye adı/), 'Örnek vitamin')
    await user.type(within(dialog).getByLabelText('Doz'), '1000 IU')
    await user.click(within(dialog).getByRole('button', { name: 'Ekle' }))
    expect(await screen.findByText('İlaç kaydı eklendi.')).toBeDefined()
    expect(within(await list('İlaçlar ve takviyeler')).getByText('Örnek vitamin · 1000 IU')).toBeDefined()

    const recommendations = await list('Diyetisyen önerileri')
    await user.click(within(recommendations).getByRole('button', { name: /kaydını düzenle/ }))
    dialog = await screen.findByRole('dialog', { name: 'Öneri düzenle' })
    const text = within(dialog).getByLabelText(/^Öneri/)
    await user.clear(text)
    await user.type(text, 'Kahvaltıyı atlamayın.')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Öneri güncellendi.')).toBeDefined()
    expect(within(await list('Diyetisyen önerileri')).getByText('Kahvaltıyı atlamayın.')).toBeDefined()

    await user.click(within(await list('Hastalıklar ve sağlık durumu')).getByRole('button', { name: /kaydını sil/ }))
    await user.click(await screen.findByRole('button', { name: 'Sil' }))
    expect(await screen.findByText('Hastalık kaydı silindi.')).toBeDefined()
    expect(await screen.findByText('Kayıtlı hastalık yok')).toBeDefined()
  })
})
