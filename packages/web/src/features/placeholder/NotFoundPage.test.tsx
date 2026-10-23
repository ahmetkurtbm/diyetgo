import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils'

describe('Bulunamayan sayfa', () => {
  it('sayfa başlığını ve genel bakışa dönüş bağlantısını gösterir', async () => {
    renderApp('/olmayan-sayfa')
    expect(await screen.findByRole('heading', { level: 1, name: 'Sayfa bulunamadı' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Genel bakışa dön' }).getAttribute('href')).toBe('/')
  })
})
