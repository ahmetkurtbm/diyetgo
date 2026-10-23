import { dayTotals, mealTotals, type Food } from '@diyetgo/shared'
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatNumber } from '../../lib/format'
import { fixDate, renderApp } from '../../test-utils'

fixDate()

const PLAN_ID = '00000005-0000-4000-8000-000000000001' // Deniz: 2026-03-03 – 2026-03-30 (28 gün)
const meal = (name: string) => screen.getByRole('region', { name })
const mealTotalText = (name: string) => within(meal(name)).getByTestId('meal-totals').textContent
const itemRow = (mealName: string, food: string) => within(meal(mealName)).getByText(food).closest('li')!

async function totals(repositories: ReturnType<typeof renderApp>['repositories'], planId = PLAN_ID) {
  const { meals, items } = await repositories.mealPlans.get(planId)
  const foods = new Map<string, Food>((await repositories.foods.list({ includeArchived: true })).map((f) => [f.id, f]))
  const types = await repositories.mealTypes.list({ includeArchived: true })
  const mealId = (day: number, type: string) => meals.find((m) => m.dayNumber === day && m.mealTypeId === types.find((t) => t.name === type)!.id)!.id
  return {
    day: (n: number) => dayTotals(n, meals, items, foods),
    meal: (day: number, type: string) => mealTotals(mealId(day, type), items, foods),
  }
}

async function openPlan(path = `/plans/${PLAN_ID}`) {
  const view = renderApp(path)
  await screen.findByRole('heading', { name: 'Dengeli beslenme planı (örnek)' })
  return view
}

describe('Plan görüntüleme', () => {
  it('günün öğünlerini sırayla ve shared hesaplamasıyla aynı toplamlarla gösterir', async () => {
    const { repositories } = await openPlan()
    const regions = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))
    expect(regions).toEqual(['Kahvaltı', 'Öğle', 'Akşam'])

    const t = await totals(repositories)
    expect(mealTotalText('Kahvaltı')).toContain(`${formatNumber(t.meal(1, 'Kahvaltı').energyKcal, 0)} kcal`)
    const dayCard = screen.getByRole('heading', { name: '1. gün toplamı' }).closest('section')!
    expect(within(dayCard).getByText(formatNumber(t.day(1).energyKcal, 0))).toBeDefined()
    expect(within(dayCard).getByText(/Hedef 1\.750 kcal/)).toBeDefined()
    expect(within(dayCard).getByText('3 Mart 2026 Salı')).toBeDefined()
  })

  it('günler arasında geçiş yapar; boş günde boş durum gösterir', async () => {
    const { user } = await openPlan()
    expect(screen.getAllByRole('button', { name: /\. gün/ })).toHaveLength(28)
    await user.click(screen.getByRole('button', { name: /^2\. gün/ }))
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Kahvaltı', 'Ara öğün 2', 'Akşam'])
    await user.click(screen.getByRole('button', { name: /^3\. gün/ }))
    expect(await screen.findByText('Bu gün için öğün yok')).toBeDefined()
  })

  it('bulunamayan plan için boş durum gösterir', async () => {
    renderApp('/plans/00000000-0000-4000-8000-0000000000ff')
    expect(await screen.findByText('Plan bulunamadı')).toBeDefined()
  })
})

describe('Öğün içerikleri', () => {
  it('besin ekler (g ve porsiyonla); toplamlar güncellenir ve yeniden açılışta korunur', async () => {
    const { user, repositories, storage, unmount } = await openPlan()
    const before = (await totals(repositories)).meal(1, 'Akşam').energyKcal

    await user.click(within(meal('Akşam')).getByRole('button', { name: 'Besin ekle' }))
    let form = within(meal('Akşam')).getByRole('form', { name: 'Öğüne besin ekle' })
    await user.click(within(form).getByRole('button', { name: 'Ekle' }))
    expect(await within(form).findByText('Bir besin seçin')).toBeDefined()
    await user.selectOptions(within(form).getByLabelText(/^Besin \*$/), 'Elma')
    await user.type(within(form).getByLabelText(/^Miktar/), '0')
    await user.click(within(form).getByRole('button', { name: 'Ekle' }))
    expect(await within(form).findByText('0 değerinden büyük olmalı')).toBeDefined()
    await user.clear(within(form).getByLabelText(/^Miktar/))
    await user.type(within(form).getByLabelText(/^Miktar/), '150')
    await user.click(within(form).getByRole('button', { name: 'Ekle' }))
    expect(await screen.findByText('Elma öğüne eklendi.')).toBeDefined()
    // Elma 52 kcal/100 g × 150 g = 78 kcal
    expect((await totals(repositories)).meal(1, 'Akşam').energyKcal).toBeCloseTo(before + 78, 10)
    expect(mealTotalText('Akşam')).toContain(`${formatNumber(before + 78, 0)} kcal`)

    // Porsiyonla: 2 × "1 adet" (50 g) yumurta = 100 g.
    await user.click(within(meal('Akşam')).getByRole('button', { name: 'Besin ekle' }))
    form = within(meal('Akşam')).getByRole('form', { name: 'Öğüne besin ekle' })
    await user.selectOptions(within(form).getByLabelText(/^Besin \*$/), 'Yumurta')
    await user.selectOptions(within(form).getByLabelText('Birim'), 'portion')
    await user.type(within(form).getByLabelText(/^Miktar/), '2')
    await user.click(within(form).getByRole('button', { name: 'Ekle' }))
    expect(await screen.findByText('Yumurta öğüne eklendi.')).toBeDefined()
    expect((within(itemRow('Akşam', 'Yumurta')).getByRole('textbox') as HTMLInputElement).value).toBe('100')

    unmount()
    renderApp(`/plans/${PLAN_ID}`, storage)
    await screen.findByRole('region', { name: 'Akşam' })
    expect(within(meal('Akşam')).getByText('Elma')).toBeDefined()
  })

  it('miktarı yerinde günceller ve geçersiz değeri reddeder; besini öğünden çıkarır', async () => {
    const { user, repositories } = await openPlan()
    const milk = within(itemRow('Kahvaltı', 'Süt (yarım yağlı)')).getByRole('textbox')
    await user.clear(milk)
    await user.type(milk, '-5')
    await user.tab()
    expect(await within(meal('Kahvaltı')).findByText('0 değerinden büyük olmalı')).toBeDefined()

    const milkAgain = within(itemRow('Kahvaltı', 'Süt (yarım yağlı)')).getByRole('textbox')
    await user.clear(milkAgain)
    await user.type(milkAgain, '250{Enter}')
    expect(await screen.findByText('Miktar güncellendi.')).toBeDefined()
    const { items } = await repositories.mealPlans.get(PLAN_ID)
    expect(items.some((i) => i.quantity === 250)).toBe(true)

    await user.click(within(meal('Kahvaltı')).getByRole('button', { name: 'Muz öğünden çıkar' }))
    expect(await screen.findByText('Muz öğünden çıkarıldı.')).toBeDefined()
    expect(within(meal('Kahvaltı')).queryByText('Muz')).toBeNull()
  })

  it('arşivlenmiş besin mevcut içerikte etiketle görünür ama yeni içerik olarak seçilemez', async () => {
    const { user, repositories } = await openPlan()
    const banana = (await repositories.foods.list()).find((f) => f.name === 'Muz')!
    await repositories.foods.setArchived(banana.id, true)
    expect(await within(itemRow('Kahvaltı', 'Muz')).findByText('Arşivde')).toBeDefined()
    await user.click(within(meal('Kahvaltı')).getByRole('button', { name: 'Besin ekle' }))
    const select = within(meal('Kahvaltı')).getByLabelText(/^Besin \*$/)
    expect(within(select).queryByRole('option', { name: 'Muz' })).toBeNull()
  })
})

describe('Öğünler', () => {
  it('boş güne öğün ekler; kullanılan öğün türleri seçeneklerde yer almaz', async () => {
    const { user } = await openPlan(`/plans/${PLAN_ID}?day=3`)
    await user.click(screen.getAllByRole('button', { name: 'Öğün ekle' })[0]!)
    let dialog = await screen.findByRole('dialog', { name: '3. güne öğün ekle' })
    await user.click(within(dialog).getByRole('button', { name: 'Öğün ekle' }))
    expect(await screen.findByText('Öğün eklendi.')).toBeDefined()
    expect(within(meal('Kahvaltı')).getByText('Bu öğünde henüz besin yok.')).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Öğün ekle' }))
    dialog = await screen.findByRole('dialog', { name: '3. güne öğün ekle' })
    expect(within(within(dialog).getByLabelText(/^Öğün türü/)).queryByRole('option', { name: 'Kahvaltı' })).toBeNull()
  })

  it('öğünü onayla siler', async () => {
    const { user } = await openPlan()
    await user.click(within(meal('Öğle')).getByRole('button', { name: 'Öğle öğününü sil' }))
    const dialog = await screen.findByRole('dialog', { name: 'Öğün silinsin mi?' })
    expect(within(dialog).getByText(/içindeki 4 besin silinir/)).toBeDefined()
    await user.click(within(dialog).getByRole('button', { name: 'Sil' }))
    expect(await screen.findByText('Öğün silindi.')).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Öğle' })).toBeNull()
  })
})

describe('Plan işlemleri', () => {
  it('mevcut öğünleri dışarıda bırakan kısaltmayı reddeder', async () => {
    const { user } = await openPlan()
    await user.click(screen.getByRole('button', { name: 'Düzenle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Planı düzenle' })
    fireEvent.change(within(dialog).getByLabelText(/^Bitiş tarihi/), { target: { value: '2026-03-03' } })
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Yeni plan süresi mevcut öğünleri dışarıda bırakıyor (gün: 2).')).toBeDefined()
  })

  it('planı başka danışana kopyalar; içerik ve toplamlar aynıdır', async () => {
    const { user, repositories } = await openPlan()
    await user.click(screen.getByRole('button', { name: 'Kopyala' }))
    const dialog = await screen.findByRole('dialog', { name: 'Planı kopyala' })
    expect(within(within(dialog).getByLabelText(/^Danışan/)).queryByRole('option', { name: /Selin/ })).toBeNull()
    await user.selectOptions(within(dialog).getByLabelText(/^Danışan/), 'Ece Deneme')
    fireEvent.change(within(dialog).getByLabelText(/^Başlangıç tarihi/), { target: { value: '2026-04-01' } })
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }))
    expect(await screen.findByText('Plan kopyalandı.')).toBeDefined()
    expect(await screen.findByRole('heading', { name: 'Dengeli beslenme planı (örnek) (kopya)' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Ece Deneme' })).toBeDefined()

    const copy = (await repositories.mealPlans.list({ clientId: (await repositories.clients.list({ search: 'Ece' }))[0]!.id })).find((p) => p.title.endsWith('(kopya)'))!
    expect(copy).toMatchObject({ startDate: '2026-04-01', endDate: '2026-04-28' })
    const [source, copied] = [await totals(repositories), await totals(repositories, copy.id)]
    expect(copied.day(1)).toEqual(source.day(1))
    expect(copied.day(2)).toEqual(source.day(2))
  })

  it('planı onayla siler ve listeye döner', async () => {
    const { user } = await openPlan()
    await user.click(screen.getByRole('button', { name: 'Planı sil' }))
    const dialog = await screen.findByRole('dialog', { name: 'Plan silinsin mi?' })
    expect(within(dialog).getByText(/6 öğün ve 20 öğün içeriğiyle/)).toBeDefined()
    await user.click(within(dialog).getByRole('button', { name: 'Planı sil' }))
    expect(await screen.findByText('Plan silindi.')).toBeDefined()
    expect(await screen.findByRole('heading', { name: 'Beslenme planları' })).toBeDefined()
    expect(screen.queryByText('Dengeli beslenme planı (örnek)')).toBeNull()
  })
})
