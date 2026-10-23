import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../../data/demo/memory-storage'
import { openDemoStore } from '../../data/demo/store'
import { formatTime, formatWeekday, formatWeekdayDate } from '../../lib/format'
import { renderApp, fixDate } from '../../test-utils'

function statValue(label: string) {
  return screen.getByText(label).closest('section')?.querySelector('p.text-3xl')?.textContent
}

const statDetail = (label: string) => within(screen.getByText(label).closest('section')!).getByTestId('stat-detail').textContent
const progress = (name: string) => {
  const bar = screen.getByRole('progressbar', { name })
  return [bar.getAttribute('aria-valuenow'), bar.getAttribute('aria-valuemax')]
}
const timelineItems = () => within(screen.getByRole('list', { name: 'Bugünün zaman çizelgesi' })).getAllByRole('listitem').map((li) => li.textContent)

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

  it('kartlarda yalnızca veriden hesaplanan bağlamı ve gerçek paydalı ilerlemeyi gösterir', async () => {
    renderApp('/')
    await screen.findByRole('heading', { name: 'Genel bakış' })
    expect(statDetail('Aktif danışan')).toBe('Arşivdeki 1 danışan hariç')
    // Şu an 12:00; bugünkü tek randevu 10:00'da başladı.
    expect(statDetail('Bugünkü randevu')).toBe('Bugün kalan randevu yok')
    expect(statDetail('Yaklaşan randevu')).toBe(`En yakın: ${formatWeekdayDate('2026-03-12T11:00:00.000Z')} 14:00`)
    const bars = screen.getByRole('img', { name: /^Günlere göre randevu sayısı/ }).getAttribute('aria-label')!
    expect(bars).toContain(`${formatWeekday('2026-03-11')} 0`) // iptal edilen randevu sayılmaz
    expect(bars).toContain(`${formatWeekday('2026-03-12')} 1`)
    expect(statDetail('Aktif plan')).toBe('1 bitiş tarihli · 1 açık uçlu')
    // Aktif danışanlar: Deniz, Ece, Kaan; aktif planı olanlar: Deniz, Ece.
    expect(progress('Aktif planı olan aktif danışanlar')).toEqual(['2', '3'])
    // Deniz planı 3–30 Mart (28 gün); 10 Mart 8. gün. Ece planı açık uçlu olduğu için ilerleme çubuğu yok.
    expect(progress('Dengeli beslenme planı (örnek) ilerlemesi')).toEqual(['8', '28'])
    expect(screen.getByText('4. gün · açık uçlu')).toBeDefined()
    expect(screen.queryByRole('progressbar', { name: 'Başlangıç planı (örnek) ilerlemesi' })).toBeNull()
  })

  it('bugünkü randevuyu İstanbul saatiyle ve danışan bağlantısıyla gösterir', async () => {
    renderApp('/')
    const card = (await screen.findByRole('heading', { name: 'Bugünkü randevular' })).closest('section')!
    expect(within(card).getByText('10:00–10:45')).toBeDefined()
    expect(within(card).getByRole('link', { name: 'Deniz Örnek' }).getAttribute('href')).toMatch(/^\/clients\//)
    // Şu an (12:00) çizgisi, geçmişteki randevudan sonra gelir.
    expect(timelineItems()).toEqual([expect.stringContaining('Deniz Örnek'), expect.stringContaining('Şu an 12:00')])
  })

  it('aynı gündeki randevuları saat sırasıyla, iptal edileni de göstererek listeler', async () => {
    const { repositories } = renderApp('/')
    await screen.findByRole('list', { name: 'Bugünün zaman çizelgesi' })
    const deniz = (await repositories.clients.list()).find((c) => c.firstName === 'Deniz')!
    const kaan = (await repositories.clients.list()).find((c) => c.firstName === 'Kaan')!
    await repositories.appointments.create({ clientId: kaan.id, startsAt: '2026-03-10T13:00:00.000Z', endsAt: '2026-03-10T13:30:00.000Z', status: 'scheduled', notes: null })
    const early = await repositories.appointments.create({ clientId: deniz.id, startsAt: '2026-03-10T05:00:00.000Z', endsAt: '2026-03-10T05:30:00.000Z', status: 'scheduled', notes: null })
    await repositories.appointments.cancel(early.id)
    await waitFor(() => expect(timelineItems()).toHaveLength(4))
    const items = timelineItems()
    expect(items[0]).toContain(formatTime('2026-03-10T05:00:00.000Z'))
    expect(items[0]).toContain('İptal edildi')
    expect(items[1]).toContain('10:00–10:45')
    expect(items[2]).toContain('Şu an 12:00')
    expect(items[3]).toContain('16:00–16:30')
    expect(statValue('Bugünkü randevu')).toBe('2')
    expect(statDetail('Bugünkü randevu')).toBe('Sıradaki 16:00 · Kaan Taslak · 1 iptal hariç')
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
    expect(screen.getByRole('link', { name: 'Randevulara git' }).getAttribute('href')).toBe('/appointments')
    expect(screen.getByRole('link', { name: 'Planlara git' }).getAttribute('href')).toBe('/plans')
    expect(statValue('Aktif danışan')).toBe('0')
    expect(statDetail('Bugünkü randevu')).toBe('Bugün randevu planlanmamış')
    expect(statDetail('Yaklaşan randevu')).toBe('Planlanmış randevu yok')
    // Payda yoksa ilerleme çubuğu üretilmez.
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})

describe('Genel bakış: sabah', () => {
  // 06:00 UTC = İstanbul'da 09:00; bugünkü randevu henüz başlamadı.
  fixDate(new Date('2026-03-10T06:00:00.000Z'))

  it('sıradaki randevuyu gösterir ve şu an çizgisini randevudan önce koyar', async () => {
    renderApp('/')
    await screen.findByRole('list', { name: 'Bugünün zaman çizelgesi' })
    expect(statDetail('Bugünkü randevu')).toBe('Sıradaki 10:00 · Deniz Örnek')
    expect(timelineItems()).toEqual([expect.stringContaining('Şu an 09:00'), expect.stringContaining('Deniz Örnek')])
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
