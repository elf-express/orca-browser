// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkupOverlay } from './MarkupOverlay'

afterEach(cleanup)

function renderOverlay(onCancel = vi.fn()) {
  const view = render(
    <MarkupOverlay
      baseImage={{ dataUrl: 'data:image/png;base64,', width: 10, height: 10 }}
      busy={false}
      onComplete={vi.fn()}
      onCancel={onCancel}
    />
  )
  const canvas = view.container.querySelector('canvas')
  if (!canvas) {
    throw new Error('markup canvas not rendered')
  }
  canvas.setPointerCapture = vi.fn()
  const undoButton = view.getByRole('button', { name: 'Undo' })
  const redoButton = view.getByRole('button', { name: 'Redo' })
  return { canvas, undoButton, redoButton }
}

// Every ending is followed by the lost capture the browser fires after it.
function stroke(
  canvas: HTMLCanvasElement,
  end: 'pointerUp' | 'pointerCancel' | 'lostPointerCapture'
): void {
  act(() => {
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 0 })
    if (end !== 'lostPointerCapture') {
      fireEvent[end](canvas, { pointerId: 1, clientX: 50, clientY: 0 })
    }
    fireEvent.lostPointerCapture(canvas, { pointerId: 1 })
  })
}

describe('MarkupOverlay canvas pointer wiring', () => {
  it('commits a stroke on release', () => {
    const { canvas, undoButton } = renderOverlay()

    stroke(canvas, 'pointerUp')

    expect(undoButton).toHaveProperty('disabled', false)
  })

  it('commits a stroke whose release never arrived once the canvas loses the pointer', () => {
    const { canvas, undoButton, redoButton } = renderOverlay()

    stroke(canvas, 'lostPointerCapture')
    act(() => {
      fireEvent.click(undoButton)
    })

    // Only a committed stroke leaves something to redo; a still-held one is just dropped.
    expect(redoButton).toHaveProperty('disabled', false)
  })

  it('discards a stroke whose pointer was cancelled', () => {
    const { canvas, undoButton } = renderOverlay()

    stroke(canvas, 'pointerCancel')

    expect(undoButton).toHaveProperty('disabled', true)
  })
})

describe('MarkupOverlay keyboard scope', () => {
  it('exits on Escape from the page while mounted', () => {
    const onCancel = vi.fn()
    renderOverlay(onCancel)

    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape typed into an editable element outside the overlay', () => {
    const onCancel = vi.fn()
    renderOverlay(onCancel)
    const input = document.createElement('input')
    document.body.append(input)

    fireEvent.keyDown(input, { key: 'Escape' })
    input.remove()

    expect(onCancel).not.toHaveBeenCalled()
  })

  it('captures no keys once the overlay is unmounted', () => {
    const onCancel = vi.fn()
    renderOverlay(onCancel)
    cleanup()

    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(onCancel).not.toHaveBeenCalled()
  })
})
