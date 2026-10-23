import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppProviders, AppRoutes } from '../../App'
import { createDemoRepositories } from '../../data/demo/repositories'
import { openDemoStore } from '../../data/demo/store'
import { fixDate, renderApp } from '../../test-utils'

fixDate()

const desktopNav = () => screen.getAllByRole('navigation', { name: 'Ana menü' })[0]!
const linksOf = (scope: HTMLElement, group: string) =>
  within(within(scope).getByRole('list', { name: group }))
    .getAllByRole('link')
    .map((l) => [l.textContent, l.getAttribute('href')])

async function openMenu(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: 'Menüyü aç' }))
  return screen.findByRole('dialog', { name: 'Menü' })
}

describe('Sol menü', () => {
  it('bağlantıları Takip, Beslenme ve Sistem gruplarında gösterir', async () => {
    renderApp('/')
    await screen.findByRole('heading', { name: 'Genel bakış' })
    const nav = desktopNav()
    expect(linksOf(nav, 'Takip')).toEqual([
      ['Genel bakış', '/'],
      ['Danışanlar', '/clients'],
      ['Randevular', '/appointments'],
    ])
    expect(linksOf(nav, 'Beslenme')).toEqual([
      ['Besinler', '/foods'],
      ['Beslenme planları', '/plans'],
    ])
    expect(linksOf(nav, 'Sistem')).toEqual([['Ayarlar', '/settings']])
    expect(within(nav).getByRole('link', { name: 'Genel bakış' }).getAttribute('aria-current')).toBe('page')
  })

  it('demo uyarısını menünün alt bölümünde, sağlık verisi uyarısıyla gösterir', async () => {
    renderApp('/clients')
    const note = await screen.findByRole('note', { name: 'Demo modu' })
    expect(note.closest('aside')).not.toBeNull()
    expect(within(note).getByText(/yalnızca bu tarayıcıda tutulur/)).toBeDefined()
    expect(within(note).getByText('Gerçek kişisel veya sağlık verisi girmeyin.')).toBeDefined()
  })

  it('tarayıcı depolaması yoksa verinin kaybolacağını belirtir', async () => {
    const opened = openDemoStore({ storage: null })
    if (!opened.ok) throw new Error(opened.error.message)
    render(
      <AppProviders repositories={createDemoRepositories(opened.store)}>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    )
    const note = await screen.findByRole('note', { name: 'Demo modu' })
    await waitFor(() => expect(within(note).getByText(/değişiklikler sayfa yenilenince kaybolur/)).toBeDefined())
  })
})

describe('Mobil menü', () => {
  it('çekmece olarak açılır, arka plan kaydırmasını kilitler ve Escape ile kapanır', async () => {
    const { user } = renderApp('/')
    const toggle = screen.getByRole('button', { name: 'Menüyü aç' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const drawer = await openMenu(user)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(within(drawer).getByRole('note', { name: 'Demo modu' })).toBeDefined()
    expect(linksOf(drawer, 'Beslenme').map(([label]) => label)).toEqual(['Besinler', 'Beslenme planları'])

    fireEvent(drawer, new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menü' })).toBeNull())
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('dış alana tıklanınca ve kapat butonuyla kapanır; içeriğe tıklamak kapatmaz', async () => {
    const { user } = renderApp('/')
    let drawer = await openMenu(user)
    await user.click(within(drawer).getByText('Takip'))
    expect(screen.getByRole('dialog', { name: 'Menü' })).toBeDefined()
    fireEvent.click(drawer)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menü' })).toBeNull())

    drawer = await openMenu(user)
    await user.click(within(drawer).getByRole('button', { name: 'Menüyü kapat' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menü' })).toBeNull())
  })

  it('menüden sayfa seçilince o sayfaya gider ve kapanır', async () => {
    const { user } = renderApp('/')
    const drawer = await openMenu(user)
    await user.click(within(drawer).getByRole('link', { name: 'Randevular' }))
    expect(await screen.findByRole('heading', { name: 'Randevular' })).toBeDefined()
    expect(screen.queryByRole('dialog', { name: 'Menü' })).toBeNull()
    expect(document.documentElement.style.overflow).toBe('')
  })
})
