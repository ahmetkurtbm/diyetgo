import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fixDate, renderApp, SEED_IDS } from '../../test-utils'

fixDate()

// Seed (bugün = 10 Mart 2026), Deniz: 9 Oca – 2 Mar 1900 kcal (elle); 3 Mar'tan beri açık uçlu 1750 kcal, 90/200/65 g
// (Mifflin-St Jeor, 1,375). Ölçümler: 75,8 kg (3 Mar), 168 cm (9 Oca); kadın, 12.04.1990 doğumlu → 35 yaş.
const historyRows = () => within(screen.getByRole('table', { name: 'Hedef geçmişi' })).getAllByRole('row').slice(1)
const rowOf = (period: RegExp) => historyRows().find((r) => period.test(r.textContent ?? ''))!

async function openClient() {
  const view = renderApp(`/clients/${SEED_IDS.deniz}`)
  await screen.findByRole('table', { name: 'Hedef geçmişi' })
  return view
}

async function openNewGoal(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: 'Yeni hedef' }))
  return screen.findByRole('dialog', { name: 'Yeni hedef' })
}

describe('Hedef kartı', () => {
  it('aktif hedefi enerji payları ve yöntemiyle, geçmişi durumlarıyla gösterir', async () => {
    await openClient()
    const active = screen.getByRole('group', { name: 'Aktif hedef' })
    expect(within(active).getByText(/3 Mart 2026 – açık uçlu · Mifflin-St Jeor \(etkinlik 1,375\)/)).toBeDefined()
    expect(within(active).getByText('1.750 kcal')).toBeDefined()
    // Makrolardan enerji 4×90 + 4×200 + 9×65 = 1745 kcal; protein payı 360 / 1745 ≈ %21.
    expect(within(active).getByText('%21')).toBeDefined()
    expect(historyRows()).toHaveLength(2)
    expect(within(rowOf(/^3 Mart 2026/)).getByText('Aktif')).toBeDefined()
    expect(within(rowOf(/^9 Ocak 2026 – 2 Mart 2026/)).getByText('Sona erdi')).toBeDefined()
    expect(screen.getByText(/teşhis veya tedavi önerisi değildir/)).toBeDefined()
  })
})

describe('Yeni hedef', () => {
  it('Mifflin-St Jeor tahminini gösterir, makroları dağıtır ve önceki açık hedefi kapatır', async () => {
    const { user, repositories } = await openClient()
    const dialog = await openNewGoal(user)
    await user.selectOptions(within(dialog).getByLabelText('Yöntem'), 'Mifflin-St Jeor ile hesapla')

    // BMR = 10×75,8 + 6,25×168 − 5×35 − 161 = 1472; × 1,375 = 2024.
    const estimate = await within(dialog).findByTestId('energy-estimate')
    expect(estimate.textContent).toContain('Kadın, 35 yaş')
    expect(estimate.textContent).toContain('1.472 kcal/gün')
    expect(estimate.textContent).toContain('2.024 kcal/gün')
    await user.selectOptions(within(dialog).getByLabelText('Etkinlik katsayısı'), '1,55 – Orta düzeyde etkin')
    expect(within(dialog).getByTestId('energy-estimate').textContent).toContain('2.282 kcal/gün')
    await user.selectOptions(within(dialog).getByLabelText('Etkinlik katsayısı'), '1,375 – Hafif etkin')

    await user.click(within(dialog).getByRole('button', { name: 'Enerji hedefine aktar' }))
    expect(within(dialog).getByLabelText(/^Enerji hedefi/)).toHaveProperty('value', '2024')
    await user.click(within(dialog).getByRole('button', { name: 'Gramları hesapla' }))
    expect(within(dialog).getByLabelText(/^Protein \(g\)/)).toHaveProperty('value', '101')
    expect(within(dialog).getByLabelText(/^Karbonhidrat \(g\)/)).toHaveProperty('value', '253')
    expect(within(dialog).getByLabelText(/^Yağ \(g\)/)).toHaveProperty('value', '67')
    expect(within(dialog).getByTestId('macro-energy').textContent).toContain('2.019 kcal')

    await user.click(within(dialog).getByRole('button', { name: 'Hedef ekle' }))
    expect(await screen.findByText('Hedef eklendi. Önceki hedef 9 Mart 2026 tarihinde sona erecek şekilde kapatıldı.')).toBeDefined()
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Aktif hedef' })).getByText('2.024 kcal')).toBeDefined())
    expect(within(rowOf(/^3 Mart 2026 – 9 Mart 2026/)).getByText('Sona erdi')).toBeDefined()

    const goals = await repositories.goals.listByClient(SEED_IDS.deniz)
    expect(goals[0]).toMatchObject({ validFrom: '2026-03-10', validTo: null, energyKcal: 2024, method: 'mifflin_st_jeor', activityFactor: 1.375 })
    expect(goals[1]).toMatchObject({ validFrom: '2026-03-03', validTo: '2026-03-09' })
  })

  it('alanları ve yüzde toplamını doğrular; çakışan dönemi reddeder', async () => {
    const { user } = await openClient()
    const dialog = await openNewGoal(user)
    await user.click(within(dialog).getByRole('button', { name: 'Gramları hesapla' }))
    expect(within(dialog).getByText('Önce enerji hedefini girin.')).toBeDefined()
    await user.click(within(dialog).getByRole('button', { name: 'Hedef ekle' }))
    expect(await within(dialog).findAllByText('Geçerli bir sayı girin')).toHaveLength(4)

    await user.type(within(dialog).getByLabelText(/^Enerji hedefi/), '1800')
    await user.clear(within(dialog).getByLabelText('Yağ %'))
    await user.type(within(dialog).getByLabelText('Yağ %'), '40')
    await user.click(within(dialog).getByRole('button', { name: 'Gramları hesapla' }))
    expect(within(dialog).getByText('Yüzdelerin toplamı 100 olmalı.')).toBeDefined()
    await user.clear(within(dialog).getByLabelText('Yağ %'))
    await user.type(within(dialog).getByLabelText('Yağ %'), '30')
    await user.click(within(dialog).getByRole('button', { name: 'Gramları hesapla' }))

    // 1 Şubat, kapalı geçmiş hedefin (9 Oca – 2 Mar) içinde.
    fireEvent.change(within(dialog).getByLabelText(/^Başlangıç tarihi/), { target: { value: '2026-02-01' } })
    await user.click(within(dialog).getByRole('button', { name: 'Hedef ekle' }))
    expect(await screen.findByText('Bu dönem başka bir hedefle çakışıyor.')).toBeDefined()
  })

  it('eksik veya uygun olmayan veride hesaplama yapmaz ve nedenini açıklar', async () => {
    const { user, repositories } = await openClient()
    const deniz = await repositories.clients.get(SEED_IDS.deniz)
    await repositories.clients.update(deniz.id, { ...deniz, sex: null, birthDate: '2010-06-01' })
    const dialog = await openNewGoal(user)
    await user.selectOptions(within(dialog).getByLabelText('Yöntem'), 'Mifflin-St Jeor ile hesapla')
    expect(await within(dialog).findByText('Danışanın cinsiyeti belirtilmemiş.')).toBeDefined()
    expect(within(dialog).getByText('Mifflin-St Jeor yalnızca 18 yaş ve üzeri için kullanılır (danışan 15 yaşında).')).toBeDefined()
    expect(within(dialog).queryByTestId('energy-estimate')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Hedef ekle' }))
    expect(await within(dialog).findByText(/^Hesaplama için gerekli bilgiler eksik/)).toBeDefined()
  })
})

describe('Hedef düzenleme ve silme', () => {
  it('geçmiş hedefi günceller; aktif hedef silinince aktif hedef kalmaz', async () => {
    const { user } = await openClient()
    await user.click(screen.getByRole('button', { name: '9 Ocak 2026 hedefini düzenle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hedefi düzenle' })
    expect(within(dialog).getByLabelText(/^Enerji hedefi/)).toHaveProperty('value', '1900')
    await user.clear(within(dialog).getByLabelText(/^Enerji hedefi/))
    await user.type(within(dialog).getByLabelText(/^Enerji hedefi/), '1850')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Hedef güncellendi.')).toBeDefined()
    await waitFor(() => expect(within(rowOf(/^9 Ocak 2026/)).getByText('1.850 kcal')).toBeDefined())

    await user.click(screen.getByRole('button', { name: '3 Mart 2026 hedefini sil' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Hedef silinsin mi?' })).getByRole('button', { name: 'Sil' }))
    expect(await screen.findByText('Hedef silindi.')).toBeDefined()
    expect(await screen.findByText('Bugün için aktif hedef yok.')).toBeDefined()
    expect(historyRows()).toHaveLength(1)
  })
})
