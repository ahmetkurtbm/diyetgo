import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../../data/demo/memory-storage'
import { openDemoStore } from '../../data/demo/store'
import { renderApp, fixDate } from '../../test-utils'

function statValue(label: string) {
  return screen.getByText(label).closest('section')?.querySelector('p.text-3xl')?.textContent
}

describe('Genel bakış', () => {
  fixDate()

  it('özet kartlarını seed verisinden hesaplar', async () => {
    renderApp('/')
    await screen.findByRole('heading', { name: 'Genel bakış' })
    expect(screen.getByText('10 Mart 2026')).toBeDefined()
    expect(statValue('Aktif danışan')).toBe('3')
    expect(statValue('Bugünkü randevu')).toBe('1')
    // +2. gün ve +7. gün planlanmış; +1. gündeki iptal edilmiş randevu sayılmaz.
    expect(statValue('Yaklaşan randevu')).toBe('2')
    expect(statValue('Aktif plan')).toBe('2')
  })

  it('bugünkü randevuyu İstanbul saatiyle ve danışan bağlantısıyla gösterir', async () => {
    renderApp('/')
    const card = (await screen.findByRole('heading', { name: 'Bugünkü randevular' })).closest('section')!
    expect(within(card).getByText('10:00–10:45')).toBeDefined()
    expect(within(card).getByRole('link', { name: 'Deniz Örnek' }).getAttribute('href')).toMatch(/^\/clients\//)
  })

  it('veri yoksa anlamlı boş durumlar gösterir', async () => {
    const storage = new MemoryStorage()
    const opened = openDemoStore({ storage })
    if (!opened.ok) throw new Error('açılamadı')
    const empty = Object.fromEntries(Object.keys(opened.store.read().data).map((k) => [k, []]))
    opened.store.write(empty as never)

    renderApp('/', storage)
    expect(await screen.findByText('Bugün randevu yok')).toBeDefined()
    expect(screen.getByText('Yaklaşan randevu yok')).toBeDefined()
    expect(screen.getByText('Aktif plan yok')).toBeDefined()
    expect(screen.getByText('Henüz işlem yok')).toBeDefined()
    expect(statValue('Aktif danışan')).toBe('0')
  })
})

describe('Genel bakış: gün sınırı', () => {
  // 21:30 UTC = İstanbul'da 11 Mart 00:30; "bugün" İstanbul'a göre belirlenir.
  fixDate(new Date('2026-03-10T21:30:00.000Z'))

  it('tarihi makinenin değil İstanbul saatinin gününe göre gösterir', async () => {
    renderApp('/')
    expect(await screen.findByText('11 Mart 2026')).toBeDefined()
  })
})
