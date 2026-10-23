import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fixDate, renderApp, SEED_IDS } from '../../test-utils'

fixDate()

describe('Uzun formlar', () => {
  it('hedef formu başlıklı bölümlerden oluşur ve geniş diyalogda açılır', async () => {
    const { user } = renderApp(`/clients/${SEED_IDS.deniz}`)
    await user.click(await screen.findByRole('button', { name: 'Yeni hedef' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yeni hedef' })
    expect(dialog.className).toContain('max-w-2xl')
    const sections = within(dialog).getAllByRole('group').map((g) => g.querySelector('legend')?.textContent)
    expect(sections).toEqual(['Dönem', 'Enerji hedefi', 'Makro hedefleri', 'Yüzdeye göre dağıt (isteğe bağlı)'])
    expect(within(within(dialog).getByRole('group', { name: 'Dönem' })).getByLabelText(/^Başlangıç tarihi/)).toBeDefined()
    expect(within(within(dialog).getByRole('group', { name: 'Makro hedefleri' })).getByLabelText(/^Protein \(g\)/)).toBeDefined()
    // Kaydet ve iptal düğmeleri kaydırılan gövdenin dışında, alt alanda durur.
    const save = within(dialog).getByRole('button', { name: 'Hedef ekle' })
    expect(save.closest('[class*="overflow-y-auto"]')).toBeNull()
  })

  it('başarısız kayıttan sonra odak ilk hatalı alana gider', async () => {
    const { user } = renderApp(`/clients/${SEED_IDS.deniz}`)
    await user.click(await screen.findByRole('button', { name: 'Yeni hedef' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yeni hedef' })
    await user.click(within(dialog).getByRole('button', { name: 'Hedef ekle' }))
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText(/^Enerji hedefi/)))
    expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true')
  })

  it('plan formu danışan ve süre bölümlerine ayrılır; doğrulama mesajları korunur', async () => {
    const { user } = renderApp('/plans')
    await user.click(await screen.findByRole('button', { name: 'Yeni plan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yeni beslenme planı' })
    expect(within(dialog).getByRole('group', { name: 'Danışan ve plan' })).toBeDefined()
    const period = within(dialog).getByRole('group', { name: 'Plan süresi' })
    expect(within(period).getByLabelText(/^Bitiş tarihi/)).toBeDefined()
    await user.click(within(dialog).getByRole('button', { name: 'Plan oluştur' }))
    expect(await within(dialog).findByText('Bir danışan seçin')).toBeDefined()
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText(/^Danışan/)))
  })

  it('onay diyalogları dar boyuttadır', async () => {
    const { user } = renderApp(`/clients/${SEED_IDS.deniz}`)
    await user.click(await screen.findByRole('button', { name: 'Danışanı sil' }))
    expect((await screen.findByRole('dialog', { name: 'Danışan silinsin mi?' })).className).toContain('max-w-sm')
  })
})
