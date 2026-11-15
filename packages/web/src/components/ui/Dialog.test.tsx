import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

const pressBack = () => act(() => void window.dispatchEvent(new PopStateEvent('popstate')))

describe('Dialog ve geri tuşu', () => {
  it('geri tuşu yalnızca en üstteki pencereyi kapatır', () => {
    const outer = vi.fn()
    const inner = vi.fn()
    const view = render(
      <>
        <Dialog open title="Dış" onClose={outer} />
        <Dialog open title="İç" onClose={inner} />
      </>,
    )
    expect(window.history.state).toMatchObject({ diyetgoDialog: expect.any(String) })
    pressBack()
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    view.unmount()
  })

  it('düğmeyle kapanan pencere eklediği geçmiş kaydını geri alır', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const view = render(<Dialog open title="Pencere" onClose={() => {}} />)
    view.rerender(<Dialog open={false} title="Pencere" onClose={() => {}} />)
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })
})
