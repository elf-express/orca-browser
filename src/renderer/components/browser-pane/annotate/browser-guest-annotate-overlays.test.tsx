// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BrowserGrabPayload } from '../../../../shared/browser-grab-types'
import { makeAnnotation } from '../../../store/browser-annotation-test-fixture'
import { BrowserGuestAnnotateOverlays } from './browser-guest-annotate-overlays'
import type { GrabModeHook } from './useGrabMode'

afterEach(cleanup)

function mount(handleGrabSendToAgent: (payload: BrowserGrabPayload) => Promise<boolean>) {
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
  const grabAnnotations = {
    pendingAnnotationPayload: null,
    handleAddBrowserAnnotation: vi.fn(),
    handleCancelPendingBrowserAnnotation: vi.fn(),
    grabIntent: 'copy',
    grabMenuActionTakenRef: { current: false },
    handleGrabCopy: vi.fn(),
    handleGrabCopyScreenshot: vi.fn(),
    handleGrabSendToAgent,
    grabToast: null,
    grabToastTimerRef: { current: undefined },
    dismissGrabToast: vi.fn(),
    setGrabToast: vi.fn()
  }
  const annotationSend = {
    browserAnnotations: [],
    browserAnnotationTrayOpen: false
  }
  render(
    <BrowserGuestAnnotateOverlays
      grab={grab}
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the overlay reads only the fields supplied by this fixture.
      annotationSend={annotationSend as never}
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the overlay reads only the fields supplied by this fixture.
      grabAnnotations={grabAnnotations as never}
      containerRef={{ current: document.createElement('div') }}
      webviewRef={{ current: null }}
      browserOverlayViewport={{ scrollX: 0, scrollY: 0, version: 0 }}
      scopeId="scope-1"
    />
  )
  return { grab }
}

async function openReview(): Promise<void> {
  fireEvent.click(await screen.findByRole('menuitem', { name: /Send to agent/ }))
  await screen.findByRole('button', { name: 'Send to agent' })
}

describe('grab review sheet', () => {
  it('stays open when the send is rejected', async () => {
    const send = vi.fn().mockResolvedValue(false)
    mount(send)
    await openReview()

    fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('button', { name: 'Send to agent' })).toBeInTheDocument()
  })

  it('closes after the host accepted the payload', async () => {
    mount(vi.fn().mockResolvedValue(true))
    await openReview()

    fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Send to agent' })).not.toBeInTheDocument()
    )
  })

  it('disables Attach and Cancel while the send is in flight', async () => {
    let finish!: (sent: boolean) => void
    const send = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)))
    mount(send)
    await openReview()

    fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send to agent' })).toBeDisabled()
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await act(async () => finish(false))
    expect(screen.getByRole('button', { name: 'Send to agent' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })
})
