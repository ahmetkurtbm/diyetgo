import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatLongDate } from '../../lib/format'
import { fixDate, renderApp, SEED_IDS } from '../../test-utils'

fixDate()

// Seed (bugün = 10 Mart 2026): Deniz 10 Mar 10:00–10:45 planlandı; Kaan 11 Mar 16:00 iptal; Ece 12 Mar 14:00 planlandı;
// Kaan 17 Mar 11:30 planlandı; geçmişte üç tamamlanmış randevu.
const day = (date: string) => screen.getByRole('region', { name: formatLongDate(date) })
const dayNames = () => screen.queryAllByRole('region').map((r) => r.getAttribute('aria-label'))
const rowOf = (date: string, time: string) => within(day(date)).getByText(new RegExp(`^${time}–`)).closest('li')!

async function openPage() {
  const view = renderApp('/appointments')
  await screen.findByRole('region', { name: formatLongDate('2026-03-10') })
  return view
}

async function openNewDialog(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: 'Yeni randevu' }))
  return screen.findByRole('dialog', { name: 'Yeni randevu' })
}

const setValue = (dialog: HTMLElement, label: RegExp, value: string) => fireEvent.change(within(dialog).getByLabelText(label), { target: { value } })

describe('Randevu listesi', () => {
  it('bugün ve sonrasını güne göre gruplar; dönem, durum ve danışana göre filtreler', async () => {
    const { user } = await openPage()
    expect(dayNames()).toEqual(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-17'].map(formatLongDate))
    expect(within(day('2026-03-10')).getByText('Bugün')).toBeDefined()
    expect(within(rowOf('2026-03-10', '10:00')).getByText('Deniz Örnek')).toBeDefined()
    expect(within(rowOf('2026-03-11', '16:00')).getByText('İptal edildi')).toBeDefined()

    await user.selectOptions(screen.getByLabelText('Durum'), 'Planlandı')
    await waitFor(() => expect(dayNames()).toEqual(['2026-03-10', '2026-03-12', '2026-03-17'].map(formatLongDate)))

    await user.selectOptions(screen.getByLabelText('Durum'), '')
    await user.selectOptions(screen.getByLabelText('Dönem'), 'Geçmiş günler')
    // Geçmiş randevular en yeni önce.
    await waitFor(() => expect(dayNames()).toEqual(['2026-03-07', '2026-03-05', '2026-02-24'].map(formatLongDate)))

    await user.selectOptions(screen.getByLabelText('Danışan'), 'Kaan Taslak')
    await waitFor(() => expect(dayNames()).toEqual([formatLongDate('2026-03-05')]))

    await user.selectOptions(screen.getByLabelText('Dönem'), 'Bugün')
    expect(await screen.findByText('Bu ölçütlere uyan randevu yok')).toBeDefined()
  })
})

describe('Randevu oluşturma', () => {
  it('zorunlu alanları ve saat sırasını doğrular', async () => {
    const { user } = await openPage()
    const dialog = await openNewDialog(user)
    expect(within(within(dialog).getByLabelText(/^Danışan/)).queryByRole('option', { name: /Selin/ })).toBeNull()

    setValue(dialog, /^Başlangıç saati/, '')
    await user.click(within(dialog).getByRole('button', { name: 'Randevu oluştur' }))
    expect(await within(dialog).findByText('Bir danışan seçin')).toBeDefined()
    expect(within(dialog).getByText('Bu alan zorunludur')).toBeDefined()

    await user.selectOptions(within(dialog).getByLabelText(/^Danışan/), 'Ece Deneme')
    setValue(dialog, /^Başlangıç saati/, '15:00')
    setValue(dialog, /^Bitiş saati/, '14:30')
    await user.click(within(dialog).getByRole('button', { name: 'Randevu oluştur' }))
    expect(await within(dialog).findByText('Bitiş zamanı başlangıçtan sonra olmalı')).toBeDefined()
  })

  it('çakışmayı canlı gösterir, kaydı engeller; boş saatte İstanbul saatini UTC olarak kaydeder', async () => {
    const { user, repositories } = await openPage()
    const dialog = await openNewDialog(user)
    await user.selectOptions(within(dialog).getByLabelText(/^Danışan/), 'Ece Deneme')
    setValue(dialog, /^Tarih/, '2026-03-10')
    setValue(dialog, /^Başlangıç saati/, '10:30')
    setValue(dialog, /^Bitiş saati/, '11:00')
    expect(await within(dialog).findByText('Bu saat başka bir randevuyla çakışıyor:')).toBeDefined()
    expect(within(dialog).getByText('Deniz Örnek, 10:00–10:45')).toBeDefined()
    await user.click(within(dialog).getByRole('button', { name: 'Randevu oluştur' }))
    expect(await screen.findByText('Bu saat başka bir randevuyla çakışıyor.')).toBeDefined()

    // Bitişik randevu çakışmaz: [10:00, 10:45) ile [10:45, 11:15).
    setValue(dialog, /^Başlangıç saati/, '10:45')
    expect(within(dialog).getByLabelText(/^Bitiş saati/)).toHaveProperty('value', '11:15')
    await user.click(within(dialog).getByRole('button', { name: 'Randevu oluştur' }))
    expect(await screen.findByText('Randevu oluşturuldu.')).toBeDefined()
    expect(within(rowOf('2026-03-10', '10:45')).getByText('Ece Deneme')).toBeDefined()

    const [created] = await repositories.appointments.list({ from: '2026-03-10T07:45:00.000Z', to: '2026-03-10T07:46:00.000Z' })
    expect(created).toMatchObject({ startsAt: '2026-03-10T07:45:00.000Z', endsAt: '2026-03-10T08:15:00.000Z', status: 'scheduled' })
  })

  it('gece yarısından sonraki randevu İstanbul gününde listelenir, UTC\'de önceki güne düşer', async () => {
    const { user, repositories, storage, unmount } = await openPage()
    const dialog = await openNewDialog(user)
    await user.selectOptions(within(dialog).getByLabelText(/^Danışan/), 'Kaan Taslak')
    setValue(dialog, /^Tarih/, '2026-03-13')
    setValue(dialog, /^Başlangıç saati/, '00:30')
    setValue(dialog, /^Bitiş saati/, '01:00')
    await user.click(within(dialog).getByRole('button', { name: 'Randevu oluştur' }))
    await screen.findByText('Randevu oluşturuldu.')
    expect(within(rowOf('2026-03-13', '00:30')).getByText('Kaan Taslak')).toBeDefined()
    const [created] = await repositories.appointments.list({ from: '2026-03-12T21:30:00.000Z', to: '2026-03-12T21:31:00.000Z' })
    expect(created?.startsAt).toBe('2026-03-12T21:30:00.000Z')

    // Sayfa yenilendiğinde kayıt korunur.
    unmount()
    renderApp('/appointments', storage)
    expect(await screen.findByRole('region', { name: formatLongDate('2026-03-13') })).toBeDefined()
  })
})

describe('Randevu düzenleme, iptal ve silme', () => {
  it('düzenlemede süreyi korur ve durumu günceller', async () => {
    const { user } = await openPage()
    await user.click(within(rowOf('2026-03-10', '10:00')).getByRole('button', { name: '10 Mar 10:00 randevusunu düzenle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Randevuyu düzenle' })
    expect(within(dialog).getByLabelText(/^Bitiş saati/)).toHaveProperty('value', '10:45')
    setValue(dialog, /^Başlangıç saati/, '10:15')
    expect(within(dialog).getByLabelText(/^Bitiş saati/)).toHaveProperty('value', '11:00')
    await user.selectOptions(within(dialog).getByLabelText('Durum'), 'Tamamlandı')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Randevu güncellendi.')).toBeDefined()
    expect(within(rowOf('2026-03-10', '10:15')).getByText('Tamamlandı')).toBeDefined()
  })

  it('iptal kaydı korur ve saati boşaltır; silme kaydı kaldırır', async () => {
    const { user } = await openPage()
    await user.click(within(rowOf('2026-03-10', '10:00')).getByRole('button', { name: /randevusunu iptal et$/ }))
    const confirm = await screen.findByRole('dialog', { name: 'Randevu iptal edilsin mi?' })
    expect(within(confirm).getByText(/^Deniz Örnek, /)).toBeDefined()
    await user.click(within(confirm).getByRole('button', { name: 'Randevuyu iptal et' }))
    expect(await screen.findByText('Randevu iptal edildi.')).toBeDefined()
    const row = rowOf('2026-03-10', '10:00')
    expect(within(row).getByText('İptal edildi')).toBeDefined()
    expect(within(row).queryByRole('button', { name: /iptal et$/ })).toBeNull()

    await user.click(within(row).getByRole('button', { name: /randevusunu sil$/ }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Randevu silinsin mi?' })).getByRole('button', { name: 'Sil' }))
    expect(await screen.findByText('Randevu silindi.')).toBeDefined()
    expect(dayNames()).not.toContain(formatLongDate('2026-03-10'))
  })
})

describe('Danışan detayındaki randevular', () => {
  it('danışanın randevularını en yeni önce listeler; yeni randevu danışanı önceden seçer', async () => {
    const { user } = renderApp(`/clients/${SEED_IDS.deniz}`)
    await screen.findByRole('region', { name: formatLongDate('2026-03-10') })
    expect(dayNames()).toEqual(['2026-03-10', '2026-02-24'].map(formatLongDate))
    await user.click(screen.getByRole('button', { name: 'Yeni randevu' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yeni randevu' })
    expect((within(dialog).getByLabelText(/^Danışan/) as HTMLSelectElement).value).toBe(SEED_IDS.deniz)
  })

  it('arşivdeki danışanda yeni randevu butonu yoktur', async () => {
    renderApp(`/clients/${SEED_IDS.selin}`)
    expect(await screen.findByText('Arşivdeki danışana yeni randevu eklenemez.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Yeni randevu' })).toBeNull()
  })
})
