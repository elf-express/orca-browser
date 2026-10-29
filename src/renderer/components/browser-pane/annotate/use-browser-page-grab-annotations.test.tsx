// @vitest-environment happy-dom
import { useLayoutEffect, type ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BrowserGrabResult,
  BrowserCaptureSelectionScreenshotResult
} from '../../../../shared/browser-grab-types'
import { BrowserRendererHostContext, type BrowserRendererHost } from '../../../host-context'
import { useBrowserAnnotationStore } from '../../../store/browser-annotation-store'
import { makeAnnotation } from '../../../store/browser-annotation-test-fixture'
import { useGrabMode } from './useGrabMode'
import { useBrowserPageGrabAnnotations } from './use-browser-page-grab-annotations'

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError } }))

let onSendToAgent: BrowserRendererHost['onSendToAgent']
function hostWrapper({ children }: { children: ReactNode }) {
  const host: BrowserRendererHost = {
    t: (_key, fallback) => fallback,
    onSendToAgent: onSendToAgent ? (payload) => onSendToAgent!(payload) : undefined
  }
  return (
    <BrowserRendererHostContext.Provider value={host}>
      {children}
    </BrowserRendererHostContext.Provider>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

beforeEach(() => {
  useBrowserAnnotationStore.setState({
    browserAnnotationsByPageId: {},
    browserAnnotationMarkerIdsByPageId: {}
  })
  onSendToAgent = undefined
  toastError.mockReset()
})
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'browserAPI')
})

function mount(invalidateBeforePendingEffect = false) {
  const selection = deferred<BrowserGrabResult>()
  const screenshot = deferred<BrowserCaptureSelectionScreenshotResult>()
  const awaitGrabSelection = vi
    .fn()
    .mockReturnValueOnce(selection.promise)
    .mockReturnValue(new Promise(() => {}))
  const captureSelectionScreenshot = vi.fn().mockReturnValue(screenshot.promise)
  const cancelGrab = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: {
      setGrabMode: vi.fn().mockResolvedValue({ ok: true }),
      awaitGrabSelection,
      captureSelectionScreenshot,
      cancelGrab
    }
  })
  const containerRef = { current: null }
  const webviewRef = { current: null }
  const setBrowserOverlayViewport = vi.fn()
  const setBrowserAnnotationTrayOpen = vi.fn()
  const hook = renderHook(
    () => {
      const grab = useGrabMode('page-1')
      const annotations = useBrowserPageGrabAnnotations({
        browserTabId: 'page-1',
        isActive: false,
        grab,
        containerRef,
        webviewRef,
        setBrowserOverlayViewport,
        setBrowserAnnotationTrayOpen,
        browserAnnotationsLength: 0
      })
      const { cancelPendingBrowserCapture } = annotations
      useLayoutEffect(() => {
        if (invalidateBeforePendingEffect && grab.state === 'confirming') {
          cancelPendingBrowserCapture()
        }
      }, [grab.state, cancelPendingBrowserCapture])
      return { grab, annotations }
    },
    { wrapper: hostWrapper }
  )
  return {
    ...hook,
    selection,
    screenshot,
    awaitGrabSelection,
    captureSelectionScreenshot,
    cancelGrab
  }
}

function selected(): BrowserGrabResult {
  return { opId: 'fixture-op', kind: 'selected', payload: makeAnnotation('page-1').payload }
}

describe('capture cancellation on a document boundary', () => {
  it('does not restore pending capture when loading cancels between commit and passive effects', async () => {
    const h = mount(true)
    act(() => h.result.current.annotations.startGrabIntent('annotate'))
    await waitFor(() => expect(h.awaitGrabSelection).toHaveBeenCalledOnce())
    await act(async () => {
      h.selection.resolve(selected())
      h.screenshot.resolve({ ok: false, reason: 'fixture' })
      await h.screenshot.promise
    })
    expect(h.result.current.grab.state).toBe('idle')
    expect(h.result.current.annotations.pendingAnnotationPayload).toBeNull()
    act(() => h.result.current.annotations.handleAddBrowserAnnotation('Canceled capture', 'fix'))
    expect(
      useBrowserAnnotationStore.getState().browserAnnotationsByPageId['page-1']
    ).toBeUndefined()
    expect(
      useBrowserAnnotationStore.getState().browserAnnotationMarkerIdsByPageId['page-1']
    ).toBeUndefined()
  })

  it('ignores a same-page selection that completes after document invalidation', async () => {
    const h = mount()
    act(() => h.result.current.annotations.startGrabIntent('annotate'))
    await waitFor(() => expect(h.awaitGrabSelection).toHaveBeenCalledOnce())
    act(() => h.result.current.annotations.cancelPendingBrowserCapture())
    await act(async () => {
      h.selection.resolve(selected())
      await h.selection.promise
    })
    expect(h.cancelGrab).toHaveBeenCalledWith({ browserPageId: 'page-1' })
    expect(h.captureSelectionScreenshot).not.toHaveBeenCalled()
    expect(h.result.current.grab.state).toBe('idle')
    expect(h.result.current.annotations.pendingAnnotationPayload).toBeNull()
    expect(
      useBrowserAnnotationStore.getState().browserAnnotationsByPageId['page-1']
    ).toBeUndefined()
  })

  it('ignores a same-URL screenshot that finishes after cancellation without creating eligible geometry', async () => {
    const h = mount()
    act(() => h.result.current.annotations.startGrabIntent('annotate'))
    await waitFor(() => expect(h.awaitGrabSelection).toHaveBeenCalledOnce())
    await act(async () => {
      h.selection.resolve(selected())
      await h.selection.promise
    })
    expect(h.captureSelectionScreenshot).toHaveBeenCalledOnce()
    act(() => h.result.current.annotations.cancelPendingBrowserCapture())
    await act(async () => {
      h.screenshot.resolve({ ok: false, reason: 'fixture' })
      await h.screenshot.promise
    })
    expect(h.result.current.grab.state).toBe('idle')
    expect(h.result.current.annotations.pendingAnnotationPayload).toBeNull()
    expect(
      useBrowserAnnotationStore.getState().browserAnnotationMarkerIdsByPageId['page-1']
    ).toBeUndefined()
  })

  it('blocks an already-rendered Add callback after invalidation and permits a fresh capture', async () => {
    const h = mount()
    act(() => h.result.current.annotations.startGrabIntent('annotate'))
    await waitFor(() => expect(h.awaitGrabSelection).toHaveBeenCalledOnce())
    await act(async () => {
      h.selection.resolve(selected())
      h.screenshot.resolve({ ok: false, reason: 'fixture' })
      await h.screenshot.promise
    })
    await waitFor(() =>
      expect(h.result.current.annotations.pendingAnnotationPayload).not.toBeNull()
    )
    const oldAdd = h.result.current.annotations.handleAddBrowserAnnotation
    act(() => {
      h.result.current.annotations.cancelPendingBrowserCapture()
      oldAdd('Stale note', 'fix')
    })
    expect(
      useBrowserAnnotationStore.getState().browserAnnotationsByPageId['page-1']
    ).toBeUndefined()

    const fresh = deferred<BrowserGrabResult>()
    h.awaitGrabSelection.mockReturnValueOnce(fresh.promise)
    act(() => h.result.current.annotations.startGrabIntent('annotate'))
    await waitFor(() => expect(h.awaitGrabSelection).toHaveBeenCalledTimes(2))
    await act(async () => {
      fresh.resolve(selected())
      await fresh.promise
    })
    await waitFor(() =>
      expect(h.result.current.annotations.pendingAnnotationPayload).not.toBeNull()
    )
    act(() => h.result.current.annotations.handleAddBrowserAnnotation('Fresh note', 'change'))
    const saved = useBrowserAnnotationStore.getState().browserAnnotationsByPageId['page-1']
    expect(saved).toHaveLength(1)
    expect(saved?.[0].comment).toBe('Fresh note')
    expect(
      useBrowserAnnotationStore.getState().browserAnnotationMarkerIdsByPageId['page-1']
    ).toEqual([saved?.[0].id])
  })
})

describe('sending a grab to the agent', () => {
  function mountSend(captureSelectionScreenshot: ReturnType<typeof vi.fn>) {
    Object.defineProperty(window, 'browserAPI', {
      configurable: true,
      value: { captureSelectionScreenshot }
    })
    const grab = {
      state: 'idle' as const,
      payload: null,
      error: null,
      contextMenu: false,
      toggle: vi.fn(),
      cancel: vi.fn(),
      rearm: vi.fn(),
      exit: vi.fn()
    }
    const view = renderHook(
      () =>
        useBrowserPageGrabAnnotations({
          browserTabId: 'page-1',
          isActive: false,
          grab,
          containerRef: { current: null },
          webviewRef: { current: null },
          setBrowserOverlayViewport: vi.fn(),
          setBrowserAnnotationTrayOpen: vi.fn(),
          browserAnnotationsLength: 0
        }),
      { wrapper: hostWrapper }
    )
    return { grab, view }
  }
  const grabPayload = () => ({ ...makeAnnotation('page-1').payload, screenshot: null })

  it('sends text-only grab payload when screenshot capture fails', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    onSendToAgent = send
    const { grab, view } = mountSend(vi.fn().mockRejectedValue(new Error('guest destroyed')))
    await act(async () => {
      await view.result.current.handleGrabSendToAgent?.(grabPayload())
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].kind).toBe('grab')
    expect(send.mock.calls[0][0].images).toEqual([])
    expect(grab.exit).toHaveBeenCalledOnce()
  })

  it('attaches screenshot when capture succeeds', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    onSendToAgent = send
    const capture = vi.fn().mockResolvedValue({
      ok: true,
      screenshot: { dataUrl: 'data:image/png;base64,QQ==', width: 10, height: 10 }
    })
    const { view } = mountSend(capture)
    const payload = grabPayload()
    await act(async () => {
      await view.result.current.handleGrabSendToAgent?.(payload)
    })
    expect(capture).toHaveBeenCalledWith({
      browserPageId: 'page-1',
      rect: payload.target.rectViewport
    })
    expect(send.mock.calls[0][0].images[0].dataBase64).toBe('QQ==')
  })

  it('keeps the review sheet open when sending fails', async () => {
    onSendToAgent = vi.fn().mockRejectedValue(new Error('upload failed'))
    const { grab, view } = mountSend(vi.fn().mockResolvedValue({ ok: false, reason: 'fixture' }))
    let sent: boolean | undefined
    await act(async () => {
      sent = await view.result.current.handleGrabSendToAgent?.(grabPayload())
    })
    expect(sent).toBe(false)
    expect(grab.exit).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Could not send to agent')
  })

  it('keeps the review sheet open silently when the send is canceled', async () => {
    onSendToAgent = vi.fn().mockRejectedValue(new DOMException('canceled', 'AbortError'))
    const { grab, view } = mountSend(vi.fn().mockResolvedValue({ ok: false, reason: 'fixture' }))
    await act(async () => {
      await view.result.current.handleGrabSendToAgent?.(grabPayload())
    })
    expect(grab.exit).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('offers no send when the host has no onSendToAgent', () => {
    const { view } = mountSend(vi.fn())
    expect(view.result.current.handleGrabSendToAgent).toBeNull()
  })

  it('ignores a second send while the first is still on its way', async () => {
    let finish!: () => void
    const send = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    onSendToAgent = send
    const { grab, view } = mountSend(vi.fn().mockResolvedValue({ ok: false, reason: 'fixture' }))
    let first!: Promise<boolean>
    let second: boolean | undefined
    await act(async () => {
      first = view.result.current.handleGrabSendToAgent!(grabPayload())
      second = await view.result.current.handleGrabSendToAgent!(grabPayload())
    })
    expect(second).toBe(false)
    await act(async () => {
      finish()
      await first
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(grab.exit).toHaveBeenCalledOnce()
  })

  it('does not exit the picker when the review was closed before the send resolved', async () => {
    let finish!: () => void
    onSendToAgent = () => new Promise<void>((resolve) => (finish = resolve))
    const { grab, view } = mountSend(vi.fn().mockResolvedValue({ ok: false, reason: 'fixture' }))
    let pending!: Promise<boolean>
    await act(async () => {
      pending = view.result.current.handleGrabSendToAgent!(grabPayload(), {
        isReviewOpen: () => false
      })
      await Promise.resolve()
    })
    let sent: boolean | undefined
    await act(async () => {
      finish()
      sent = await pending
    })
    expect(sent).toBe(true)
    expect(grab.exit).not.toHaveBeenCalled()
  })
})

describe('grab review lifecycle', () => {
  function mountReview(initial: { state: 'idle' | 'confirming'; currentUrl?: string }) {
    const capture = vi.fn().mockResolvedValue({
      ok: true,
      screenshot: { dataUrl: 'data:image/png;base64,QQ==', width: 10, height: 10 }
    })
    Object.defineProperty(window, 'browserAPI', {
      configurable: true,
      value: { captureSelectionScreenshot: capture }
    })
    const grab = {
      payload: null,
      error: null,
      contextMenu: false,
      toggle: vi.fn(),
      cancel: vi.fn(),
      rearm: vi.fn(),
      exit: vi.fn()
    }
    const view = renderHook(
      (props: { state: 'idle' | 'confirming'; currentUrl?: string }) =>
        useBrowserPageGrabAnnotations({
          browserTabId: 'page-1',
          isActive: false,
          grab: { ...grab, state: props.state },
          containerRef: { current: null },
          webviewRef: { current: null },
          setBrowserOverlayViewport: vi.fn(),
          setBrowserAnnotationTrayOpen: vi.fn(),
          browserAnnotationsLength: 0,
          currentUrl: props.currentUrl
        }),
      { wrapper: hostWrapper, initialProps: initial }
    )
    return { view, capture, grab }
  }
  const reviewPayload = () => ({ ...makeAnnotation('page-1').payload, screenshot: null })

  it('closes the review sheet when the page navigates', () => {
    onSendToAgent = vi.fn()
    const { view } = mountReview({ state: 'confirming' })
    act(() => view.result.current.openGrabReview(reviewPayload()))
    expect(view.result.current.grabReviewPayload).not.toBeNull()

    act(() => view.result.current.cancelPendingBrowserCapture())

    expect(view.result.current.grabReviewPayload).toBeNull()
  })

  it('closes the review sheet when the grab returns to idle (Escape)', () => {
    onSendToAgent = vi.fn()
    const { view } = mountReview({ state: 'confirming' })
    act(() => view.result.current.openGrabReview(reviewPayload()))
    expect(view.result.current.grabReviewPayload).not.toBeNull()

    view.rerender({ state: 'idle' })

    expect(view.result.current.grabReviewPayload).toBeNull()
  })

  it('sends no image when the page no longer matches the grabbed payload', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    onSendToAgent = send
    const { view, capture } = mountReview({
      state: 'confirming',
      currentUrl: 'https://other.test/x'
    })
    const payload = {
      ...reviewPayload(),
      screenshot: {
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,Qg==',
        width: 1,
        height: 1
      }
    } as never

    await act(async () => {
      await view.result.current.handleGrabSendToAgent?.(payload)
    })

    expect(capture).not.toHaveBeenCalled()
    expect(send.mock.calls[0][0].images).toEqual([])
  })

  it('still captures when the current page matches the grabbed payload', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    onSendToAgent = send
    const { view, capture } = mountReview({
      state: 'confirming',
      currentUrl: 'https://example.com/?token=1'
    })

    await act(async () => {
      await view.result.current.handleGrabSendToAgent?.(reviewPayload())
    })

    expect(capture).toHaveBeenCalledOnce()
    expect(send.mock.calls[0][0].images).toHaveLength(1)
  })
})

describe('grab error feedback', () => {
  function mountError(error: string | null) {
    Object.defineProperty(window, 'browserAPI', { configurable: true, value: {} })
    const grab = {
      payload: null,
      contextMenu: false,
      toggle: vi.fn(),
      cancel: vi.fn(),
      rearm: vi.fn(),
      exit: vi.fn()
    }
    return renderHook(
      (props: { error: string | null }) =>
        useBrowserPageGrabAnnotations({
          browserTabId: 'page-1',
          isActive: false,
          grab: { ...grab, state: props.error ? 'error' : 'idle', error: props.error },
          containerRef: { current: null },
          webviewRef: { current: null },
          setBrowserOverlayViewport: vi.fn(),
          setBrowserAnnotationTrayOpen: vi.fn(),
          browserAnnotationsLength: 0
        }),
      { wrapper: hostWrapper, initialProps: { error } }
    )
  }

  it('shows the reason when element selection cannot start', () => {
    const view = mountError(null)
    expect(toastError).not.toHaveBeenCalled()

    view.rerender({ error: 'Could not start element selection on this page.' })

    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Could not start element selection on this page.')

    view.rerender({ error: 'Could not start element selection on this page.' })
    expect(toastError).toHaveBeenCalledTimes(1)
  })
})
