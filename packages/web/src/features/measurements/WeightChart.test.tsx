import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { WeightChart } from './WeightChart'

const points = [
  { date: '2026-03-03', value: 75.8 },
  { date: '2026-01-09', value: 78.4 },
  { date: '2026-02-08', value: 76.9 },
]

describe('Kilo grafiği', () => {
  it('özeti ekran okuyucuya verir; noktalar tarih sırasıyla, değerleriyle odaklanabilir', async () => {
    render(<WeightChart points={points} />)
    const chart = screen.getByRole('group', { name: /^Kilo değişimi: 78,4 kg \(9 Ocak 2026\) → 75,8 kg \(3 Mart 2026\), -2,6 kg$/ })
    expect(chart.querySelector('linearGradient')).not.toBeNull()
    const dots = screen.getAllByRole('img').map((p) => p.getAttribute('aria-label'))
    expect(dots).toEqual(['9 Ocak 2026: 78,4 kg', '8 Şubat 2026: 76,9 kg', '3 Mart 2026: 75,8 kg'])

    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('tooltip').textContent).toContain('78,4 kg')
    expect(screen.getByRole('tooltip').textContent).not.toContain('Önceki ölçüme göre')
    await user.tab()
    expect(screen.getByRole('tooltip').textContent).toContain('8 Şubat 2026')
    expect(screen.getByRole('tooltip').textContent).toContain('Önceki ölçüme göre -1,5 kg')
    await user.tab()
    await user.tab()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('fareyle üzerine gelince ipucu gösterir, ayrılınca gizler', () => {
    render(<WeightChart points={points} />)
    const last = screen.getByRole('img', { name: '3 Mart 2026: 75,8 kg' })
    fireEvent.mouseEnter(last)
    expect(screen.getByRole('tooltip').textContent).toContain('Önceki ölçüme göre -1,1 kg')
    fireEvent.mouseLeave(last)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('yeterli veri yoksa nedenini ve varsa son değeri açıklar', () => {
    const { rerender } = render(<WeightChart points={[]} />)
    expect(screen.getByText('Grafik için henüz kilo ölçümü yok.')).toBeDefined()
    rerender(<WeightChart points={[{ date: '2026-03-03', value: 70 }]} />)
    expect(screen.getByText('Grafik için en az iki kilo ölçümü gerekir.')).toBeDefined()
    expect(screen.getByText('Son kilo: 70 kg (3 Mart 2026)')).toBeDefined()
    expect(screen.queryByRole('group')).toBeNull()
  })
})
