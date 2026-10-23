import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fixDate, renderApp, SEED_IDS } from '../../test-utils'

fixDate()

const titles = () =>
  within(screen.getByRole('table', { name: 'Plan listesi' }))
    .getAllByRole('link')
    .map((l) => l.textContent)

describe('Plan listesi', () => {
  it('planları durumlarıyla listeler ve danışana göre filtreler', async () => {
    const { user } = renderApp('/plans')
    await screen.findByRole('table', { name: 'Plan listesi' })
    expect(titles()).toEqual(['Başlangıç planı (örnek)', 'Dengeli beslenme planı (örnek)'])
    expect(screen.getAllByText('Devam ediyor')).toHaveLength(2)
    await user.selectOptions(screen.getByLabelText('Danışan'), 'Deniz Örnek')
    await screen.findByText('Dengeli beslenme planı (örnek)')
    expect(titles()).toEqual(['Dengeli beslenme planı (örnek)'])
    await user.selectOptions(screen.getByLabelText('Danışan'), 'Kaan Taslak')
    expect(await screen.findByText('Bu ölçütlere uyan plan yok')).toBeDefined()
  })

  it('yeni planı doğrular, oluşturur ve düzenleyiciye gider', async () => {
    const { user } = renderApp('/plans')
    await user.click(await screen.findByRole('button', { name: 'Yeni plan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yeni beslenme planı' })
    const clientSelect = within(dialog).getByLabelText(/^Danışan/)
    expect(within(clientSelect).queryByRole('option', { name: /Selin/ })).toBeNull()

    await user.click(within(dialog).getByRole('button', { name: 'Plan oluştur' }))
    expect(await within(dialog).findByText('Bir danışan seçin')).toBeDefined()
    expect(within(dialog).getByText('Bu alan zorunludur')).toBeDefined()

    await user.selectOptions(clientSelect, 'Kaan Taslak')
    await user.type(within(dialog).getByLabelText(/^Plan adı/), 'Yeni plan')
    fireEvent.change(within(dialog).getByLabelText(/^Bitiş tarihi/), { target: { value: '2026-03-01' } })
    await user.click(within(dialog).getByRole('button', { name: 'Plan oluştur' }))
    expect(await within(dialog).findByText('Bitiş tarihi başlangıç tarihinden önce olamaz')).toBeDefined()

    fireEvent.change(within(dialog).getByLabelText(/^Bitiş tarihi/), { target: { value: '2026-03-16' } })
    await user.click(within(dialog).getByRole('button', { name: 'Plan oluştur' }))
    expect(await screen.findByText('Plan oluşturuldu.')).toBeDefined()
    expect(await screen.findByRole('heading', { name: 'Yeni plan' })).toBeDefined()
    expect(screen.getAllByRole('button', { name: /\. gün/ })).toHaveLength(7)
    expect(screen.getByText('Bu gün için öğün yok')).toBeDefined()
  })
})

describe('Danışan detayındaki planlar', () => {
  it('danışanın planlarını listeler; yeni plan danışanı önceden seçer', async () => {
    const { user } = renderApp(`/clients/${SEED_IDS.deniz}`)
    expect(await screen.findByRole('link', { name: 'Dengeli beslenme planı (örnek)' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Yeni plan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yeni beslenme planı' })
    expect((within(dialog).getByLabelText(/^Danışan/) as HTMLSelectElement).value).toBe(SEED_IDS.deniz)
  })

  it('arşivdeki danışanda yeni plan butonu yoktur', async () => {
    renderApp(`/clients/${SEED_IDS.selin}`)
    expect(await screen.findByText('Arşivdeki danışana yeni plan eklenemez.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Yeni plan' })).toBeNull()
  })
})
