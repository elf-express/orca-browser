// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BrowserAgentPayload } from '../../../../shared/agent-payload'
import type { BrowserGrabPayload } from '../../../../shared/browser-grab-types'
import { BrowserRendererHostContext, type BrowserRendererHost } from '../../../host-context'
import { makeAnnotation } from '../../../store/browser-annotation-test-fixture'
import { BrowserGuestAnnotateOverlays } from './browser-guest-annotate-overlays'
import { useBrowserPageGrabAnnotations } from './use-browser-page-grab-annotations'
import type { GrabModeHook } from './useGrabMode'
import type { MarkupModeController } from './useMarkupMode'

afterEach(cleanup)

const IDLE_MARKUP: MarkupModeController = {
  state: 'idle',
  isActive: false,
  baseImage: null,
  start: vi.fn(),
  cancel: vi.fn(),
  complete: vi.fn()
}

function Harness({ grab }: { grab: GrabModeHook }) {
  const grabAnnotations = useBrowserPageGrabAnnotations({
    browserTabId: 'page-1',
    isActive: false,
    grab,
    containerRef: { current: null },
    webviewRef: { current: null },
    setBrowserOverlayViewport: vi.fn(),
    setBrowserAnnotationTrayOpen: vi.fn(),
    browserAnnotationsLength: 0
  })
  return (
    <BrowserGuestAnnotateOverlays
      grab={grab}
      markup={IDLE_MARKUP}
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the overlay reads only the fields supplied by this fixture.
      annotationSend={{ browserAnnotations: [], browserAnnotationTrayOpen: false } as never}
      grabAnnotations={grabAnnotations}
      containerRef={{ current: document.createElement('div') }}
      webviewRef={{ current: null }}
      browserOverlayViewport={{ scrollX: 0, scrollY: 0, version: 0 }}
      scopeId="scope-1"
    />
  )
}

function mount(onSendToAgent: (payload: BrowserAgentPayload) => Promise<void>) {
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: {
      captureSelectionScreenshot: vi.fn().mockResolvedValue({ ok: false, reason: 'fixture' })
    }
  })
  const payload = { ...makeAnnotation('page-1').payload, screenshot: null } as BrowserGrabPayload
  const grab: GrabModeHook = {
    state: 'confirming',
    payload,
    error: null,
    contextMenu: true,
    toggle: vi.fn(),
    cancel: vi.fn(),
    rearm: vi.fn(),
    exit: vi.fn()
  }
  const host: BrowserRendererHost = { t: (_key, fallback) => fallback, onSendToAgent }
  render(
    <BrowserRendererHostContext.Provider value={host}>
      <Harness grab={grab} />
    </BrowserRendererHostContext.Provider>
  )
  return { grab }
}

async function openReview(): Promise<void> {
  fireEvent.click(await screen.findByRole('menuitem', { name: /Send to agent/ }))
  await screen.findByRole('button', { name: 'Send to agent' })
}

describe('grab review sheet', () => {
  it('stays open when the send is rejected', async () => {
    const send = vi.fn().mockRejectedValue(new Error('upload failed'))
    mount(send)
    await openReview()

    fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('button', { name: 'Send to agent' })).toBeInTheDocument()
  })

  it('closes after the host accepted the payload', async () => {
    mount(vi.fn().mockResolvedValue(undefined))
    await openReview()

    fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Send to agent' })).not.toBeInTheDocument()
    )
  })

  it('disables Attach and Cancel while the send is in flight', async () => {
    let finish!: () => void
    const send = vi.fn(
      () => new Promise<void>((_resolve, reject) => (finish = () => reject(new Error('failed'))))
    )
    mount(send)
    await openReview()

    fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send to agent' })).toBeDisabled()
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await act(async () => finish())
    expect(screen.getByRole('button', { name: 'Send to agent' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })
})

describe('markup surface', () => {
  it('mounts the draw surface in the portal target only while markup is active', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const activeMarkup: MarkupModeController = {
      ...IDLE_MARKUP,
      state: 'drawing',
      isActive: true,
      baseImage: { dataUrl: 'data:image/png;base64,', width: 10, height: 10 }
    }
    const props = {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the overlay reads only the fields supplied by this fixture.
      grab: { state: 'idle', contextMenu: false } as never as GrabModeHook,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the overlay reads only the fields supplied by this fixture.
      annotationSend: { browserAnnotations: [] } as never,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the overlay reads only the fields supplied by this fixture.
      grabAnnotations: { grabToast: null, pendingAnnotationPayload: null } as never,
      containerRef: { current: document.createElement('div') },
      webviewRef: { current: null },
      browserOverlayViewport: { scrollX: 0, scrollY: 0, version: 0 },
      scopeId: 'scope-1',
      markupPortalContainer: target
    }

    const view = render(<BrowserGuestAnnotateOverlays {...props} markup={activeMarkup} />)
    expect(target.querySelector('canvas')).not.toBeNull()

    view.rerender(<BrowserGuestAnnotateOverlays {...props} markup={IDLE_MARKUP} />)
    expect(target.querySelector('canvas')).toBeNull()
    target.remove()
  })
})
