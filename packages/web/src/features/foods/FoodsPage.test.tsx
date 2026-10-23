import { dayTotals, type Food } from '@diyetgo/shared'
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fixDate, renderApp, SEED_IDS } from '../../test-utils'

fixDate()

const table = () => screen.getByRole('table', { name: 'Besin listesi' })
const rows = () => within(table()).getAllByRole('row').slice(1)
const rowOf = (name: string) => rows().find((row) => within(row).queryByText(name, { selector: 'span.font-medium' }))!

describe('Besin listesi', () => {
  it('besinleri 100 g/ml başına değerleri ve örnek veri etiketiyle listeler', async () => {
    renderApp('/foods')
    await screen.findByRole('table', { name: 'Besin listesi' })
    expect(rows()).toHaveLength(15)
    expect(within(table()).getAllByText('Örnek veri – doğrulanmamış')).toHaveLength(15)
    const milk = rowOf('Süt (yarım yağlı)')
    expect(within(milk).getByText('100 ml başına')).toBeDefined()
    expect(within(milk).getByText('46 kcal')).toBeDefined()
  })

  it('Türkçe büyük/küçük harf duyarsız arar ve sonuç yoksa belirtir', async () => {
    const { user } = renderApp('/foods')
    const search = await screen.findByRole('searchbox', { name: 'Besin ara' })
    await user.type(search, 'YOĞURT')
    await screen.findByText('Yoğurt (tam yağlı)')
    expect(rows()).toHaveLength(1)
    await user.clear(search)
    await user.type(search, 'olmayan-besin')
    expect(await screen.findByText('Sonuç bulunamadı')).toBeDefined()
  })
})

describe('Besin ekleme ve düzenleme', () => {
  it('doğrular, makro enerjisini ayrı gösterir, kaydeder ve yeniden açılışta korur', async () => {
    const { user, storage, unmount } = renderApp('/foods')
    await user.click(await screen.findByRole('button', { name: 'Yeni besin' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yeni besin' })
    const field = (label: RegExp) => within(dialog).getByLabelText(label)
    const save = () => user.click(within(dialog).getByRole('button', { name: 'Besin ekle' }))

    await save()
    expect(await within(dialog).findByText('Bu alan zorunludur')).toBeDefined()
    expect(within(dialog).getAllByText('Geçerli bir sayı girin').length).toBeGreaterThanOrEqual(1)

    await user.type(field(/^Besin adı/), 'Test ürünü')
    await user.type(field(/^Enerji/), '400')
    await user.type(field(/^Protein/), '30')
    await user.type(field(/^Karbonhidrat/), '60')
    await user.type(field(/^Yağ/), '20')
    await save()
    expect(await within(dialog).findByText("100 g içindeki makroların toplamı 100 g'ı aşamaz")).toBeDefined()

    await user.clear(field(/^Yağ/))
    await user.type(field(/^Yağ/), '5')
    // 4×30 + 4×60 + 9×5 = 405 kcal; kayıttaki 400 kcal'den ayrı gösterilir.
    expect(within(dialog).getByText(/Makrolardan hesaplanan \(4\/4\/9\): 405 kcal/)).toBeDefined()
    await user.type(field(/^Porsiyon adı/), '1 paket')
    await save()
    expect(await within(dialog).findByText('Porsiyon adı ve miktarı birlikte girilmeli')).toBeDefined()

    await user.type(field(/^Porsiyon miktarı/), '25')
    await save()
    expect(await screen.findByText('Besin eklendi.')).toBeDefined()
    const created = await screen.findByText('Test ürünü', { selector: 'span.font-medium' })
    expect(within(created.closest('tr')!).queryByText('Örnek veri – doğrulanmamış')).toBeNull()

    unmount()
    renderApp('/foods', storage)
    expect(await screen.findByText('Test ürünü', { selector: 'span.font-medium' })).toBeDefined()
  })

  it('ml seçildiğinde etiketler 100 ml başına olur', async () => {
    const { user } = renderApp('/foods')
    await user.click(await screen.findByRole('button', { name: 'Yeni besin' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yeni besin' })
    await user.selectOptions(within(dialog).getByLabelText('Temel birim'), 'ml')
    expect(within(dialog).getByLabelText(/^Enerji \(kcal, 100 ml başına\)/)).toBeDefined()
    expect(within(dialog).getByLabelText(/^Porsiyon miktarı \(ml\)/)).toBeDefined()
  })

  it('kullanılan besini düzenlerken uyarır; değişiklik plan toplamlarına canlı yansır', async () => {
    const { user, repositories } = renderApp('/foods')
    const planTotal = async () => {
      const [plan] = await repositories.mealPlans.list({ clientId: SEED_IDS.deniz })
      const { meals, items } = await repositories.mealPlans.get(plan!.id)
      const foods = new Map<string, Food>((await repositories.foods.list({ includeArchived: true })).map((f) => [f.id, f]))
      return dayTotals(2, meals, items, foods).energyKcal
    }
    const before = await planTotal()

    await user.click(await screen.findByRole('button', { name: 'Yumurta düzenle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Besini düzenle' })
    expect(await within(dialog).findByText(/Bu besin 2 planda kullanılıyor/)).toBeDefined()
    const energy = within(dialog).getByLabelText(/^Enerji/)
    await user.clear(energy)
    await user.type(energy, '155')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Besin güncellendi.')).toBeDefined()

    // Planın 2. gününde 100 g yumurta var: 10 kcal/100 g artış → toplam +10 kcal.
    expect(await planTotal()).toBeCloseTo(before + 10, 10)
  })
})

describe('Besin silme ve arşivleme', () => {
  it('planda kullanılan besin silinmez; arşivlenmesi önerilir', async () => {
    const { user } = renderApp('/foods')
    await user.click(await screen.findByRole('button', { name: 'Elma sil' }))
    const dialog = await screen.findByRole('dialog', { name: 'Besin silinemez' })
    expect(within(dialog).getByText(/1 planda kullanılıyor/)).toBeDefined()
    await user.click(within(dialog).getByRole('button', { name: 'Arşivle' }))
    expect(await screen.findByText('Besin arşivlendi.')).toBeDefined()
    expect(screen.queryByText('Elma', { selector: 'span.font-medium' })).toBeNull()

    await user.click(screen.getByLabelText('Arşivdekileri göster'))
    const elma = await screen.findByText('Elma', { selector: 'span.font-medium' })
    expect(within(elma.closest('tr')!).getByText('Arşivde')).toBeDefined()
  })

  it('hiçbir planda kullanılmayan besin onayla silinir', async () => {
    const { user, repositories } = renderApp('/foods')
    await screen.findByRole('table', { name: 'Besin listesi' })
    await repositories.foods.create({
      name: 'Silinecek besin',
      brand: null,
      baseUnit: 'g',
      energyKcal: 100,
      proteinG: 1,
      carbsG: 20,
      fatG: 1,
      portionLabel: null,
      portionAmount: null,
      source: null,
      isSample: false,
    })
    await user.click(await screen.findByRole('button', { name: 'Silinecek besin sil' }))
    await user.click(await screen.findByRole('button', { name: 'Sil' }))
    expect(await screen.findByText('Besin silindi.')).toBeDefined()
    expect(screen.queryByText('Silinecek besin', { selector: 'span.font-medium' })).toBeNull()
  })
})
