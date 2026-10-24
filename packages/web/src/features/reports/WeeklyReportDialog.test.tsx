import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fixDate, renderApp, SEED_IDS } from '../../test-utils'

fixDate()

async function openReport(clientId: string) {
  const view = renderApp(`/clients/${clientId}`)
  await view.user.click(await screen.findByRole('button', { name: 'Haftalık rapor' }))
  const dialog = await screen.findByRole('dialog', { name: 'Haftalık rapor' })
  await within(dialog).findByText('Güncel kilo')
  return { ...view, dialog }
}

describe('Haftalık rapor', () => {
  it('güncel kiloyu, önceki ve ilk ölçüme göre değişimi ve vücut ölçülerini gösterir', async () => {
    const { dialog } = await openReport(SEED_IDS.deniz)
    expect(within(dialog).getByText('Merhaba Deniz,')).toBeDefined()
    expect(within(dialog).getByText('4–10 Mart 2026 haftasının özeti')).toBeDefined()
    expect(within(dialog).getByText('75,8')).toBeDefined()
    // 76,9 → 75,8 kg (önceki ölçüm), 78,4 → 75,8 kg (başlangıç).
    expect(within(dialog).getByText('−1,1 kg')).toBeDefined()
    expect(within(dialog).getByText('−2,6 kg')).toBeDefined()
    expect(within(dialog).getByText('Bel')).toBeDefined()
    expect(within(dialog).getByText('−3 cm toplam')).toBeDefined()
    expect(within(dialog).getByText('Yağ oranı')).toBeDefined()
    expect(within(dialog).getByText('İlk ölçüm')).toBeDefined()
  })

  it('diyetisyen notunu görsele ekler ve bilgi amaçlı olduğunu belirtir', async () => {
    const { dialog, user } = await openReport(SEED_IDS.deniz)
    expect(within(dialog).queryByText('Diyetisyeninden not')).toBeNull()
    await user.type(within(dialog).getByLabelText('Diyetisyen notu (isteğe bağlı)'), 'Su tüketimine dikkat')
    expect(within(dialog).getByText('Diyetisyeninden not')).toBeDefined()
    expect(within(dialog).getByText('Su tüketimine dikkat', { selector: 'p' })).toBeDefined()
    expect(within(dialog).getByText(/teşhis veya tedavi önerisi değildir/)).toBeDefined()
    expect(within(dialog).getByRole('button', { name: 'Görseli indir' })).toBeDefined()
  })
})
