import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fixDate, renderApp, SEED_IDS } from '../../test-utils'

fixDate()

const table = (name: string) => screen.getByRole('table', { name })
const header = (tableName: string, label: string) => within(table(tableName)).getByRole('columnheader', { name: label })
const firstCells = (tableName: string) =>
  within(table(tableName))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]!.textContent)
const cellsOf = (tableName: string, column: number) =>
  within(table(tableName))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[column]!.textContent)

describe('Tablo sıralama', () => {
  it('danışanları yaşa göre sıralar; başlık aria-sort bildirir ve klavyeyle çalışır', async () => {
    const { user } = renderApp('/clients')
    await screen.findByRole('table', { name: 'Danışan listesi' })
    // Varsayılan: soyada göre (Deneme, Örnek, Taslak).
    expect(firstCells('Danışan listesi')).toEqual(['Ece Deneme', 'Deniz Örnek', 'Kaan Taslak'])
    expect(header('Danışan listesi', 'Yaş').getAttribute('aria-sort')).toBe('none')

    await user.click(within(header('Danışan listesi', 'Yaş')).getByRole('button'))
    expect(header('Danışan listesi', 'Yaş').getAttribute('aria-sort')).toBe('ascending')
    expect(firstCells('Danışan listesi')).toEqual(['Deniz Örnek', 'Ece Deneme', 'Kaan Taslak'])

    // Odak butondayken Enter yönü değiştirir.
    within(header('Danışan listesi', 'Yaş')).getByRole('button').focus()
    await user.keyboard('{Enter}')
    expect(header('Danışan listesi', 'Yaş').getAttribute('aria-sort')).toBe('descending')
    expect(firstCells('Danışan listesi')).toEqual(['Kaan Taslak', 'Ece Deneme', 'Deniz Örnek'])

    await user.click(within(header('Danışan listesi', 'Ad soyad')).getByRole('button'))
    expect(header('Danışan listesi', 'Yaş').getAttribute('aria-sort')).toBe('none')
    expect(firstCells('Danışan listesi')).toEqual(['Deniz Örnek', 'Ece Deneme', 'Kaan Taslak'])
  })

  it('dar ekran sıralama seçimi başlıklarla aynı sıralamayı uygular; arama sıralamayı bozmaz', async () => {
    const { user } = renderApp('/clients')
    await screen.findByRole('table', { name: 'Danışan listesi' })
    await user.selectOptions(screen.getByLabelText('Sırala'), 'Yaş (azalan)')
    expect(header('Danışan listesi', 'Yaş').getAttribute('aria-sort')).toBe('descending')
    expect(firstCells('Danışan listesi')).toEqual(['Kaan Taslak', 'Ece Deneme', 'Deniz Örnek'])
    await user.type(screen.getByRole('searchbox'), 'en')
    await waitFor(() => expect(firstCells('Danışan listesi')).toEqual(['Ece Deneme', 'Deniz Örnek']))
  })

  it('besinleri enerjiye göre sayısal olarak sıralar', async () => {
    const { user, repositories } = renderApp('/foods')
    await screen.findByRole('table', { name: 'Besin listesi' })
    await user.click(within(header('Besin listesi', 'Enerji')).getByRole('button'))
    await user.click(within(header('Besin listesi', 'Enerji')).getByRole('button'))
    const expected = (await repositories.foods.list()).map((f) => f.energyKcal).sort((a, b) => b - a)
    const shown = cellsOf('Besin listesi', 1).map((text) => Number(text!.replace(/\D/g, '')))
    expect(shown).toEqual(expected)
  })

  it('planları başlangıç tarihine göre sıralar', async () => {
    const { user } = renderApp('/plans')
    await screen.findByRole('table', { name: 'Plan listesi' })
    // Varsayılan: en yeni başlangıç önce (7 Mart, 3 Mart).
    expect(firstCells('Plan listesi')).toEqual(['Başlangıç planı (örnek)', 'Dengeli beslenme planı (örnek)'])
    await user.click(within(header('Plan listesi', 'Tarihler')).getByRole('button'))
    expect(firstCells('Plan listesi')).toEqual(['Dengeli beslenme planı (örnek)', 'Başlangıç planı (örnek)'])
  })

  it('ölçümleri tarihe ve kiloya göre sıralar; boş değerler sonda kalır', async () => {
    const { user } = renderApp(`/clients/${SEED_IDS.deniz}`)
    await screen.findByRole('table', { name: 'Ölçüm geçmişi' })
    // Varsayılan: en yeni ölçüm önce.
    expect(firstCells('Ölçüm geçmişi')).toEqual(['3 Mart 2026', '8 Şubat 2026', '9 Ocak 2026'])
    await user.click(within(header('Ölçüm geçmişi', 'Tarih')).getByRole('button'))
    expect(firstCells('Ölçüm geçmişi')).toEqual(['9 Ocak 2026', '8 Şubat 2026', '3 Mart 2026'])
    await user.click(within(header('Ölçüm geçmişi', 'Kilo')).getByRole('button'))
    expect(cellsOf('Ölçüm geçmişi', 1)).toEqual(['75,8 kg', '76,9 kg', '78,4 kg'])
    await user.click(within(header('Ölçüm geçmişi', 'Boy')).getByRole('button'))
    await user.click(within(header('Ölçüm geçmişi', 'Boy')).getByRole('button'))
    // Boy yalnızca ilk ölçümde var; azalan sıralamada da boş değerler sondadır.
    expect(cellsOf('Ölçüm geçmişi', 2)).toEqual(['168 cm', '—', '—'])
  })
})
