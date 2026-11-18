import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function Broken(): never {
  throw new RangeError('Invalid time value')
}

afterEach(() => vi.restoreAllMocks())

describe('Hata ekranı', () => {
  it('ekran çizilirken hata olursa boş ekran yerine yenileme ve (demo için) sıfırlama seçeneği sunar', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reset = vi.fn()
    render(
      <AppErrorBoundary onReset={reset}>
        <Broken />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: 'Bir sorun oluştu' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Sayfayı yenile' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Demo verilerini sıfırla' })).toBeDefined()
  })

  it('hata yoksa içeriği olduğu gibi gösterir', () => {
    render(
      <AppErrorBoundary>
        <p>Merhaba</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('Merhaba')).toBeDefined()
  })
})
