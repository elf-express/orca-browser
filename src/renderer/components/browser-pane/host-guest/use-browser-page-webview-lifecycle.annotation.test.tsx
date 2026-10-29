// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserGrabPayload } from '../../../../shared/browser-grab-types'
import { useBrowserAnnotationStore } from '../../../store/browser-annotation-store'
import { makeAnnotation } from '../../../store/browser-annotation-test-fixture'
import { useBrowserPageWebviewLifecycle } from './use-browser-page-webview-lifecycle'

type AttachArgs = {
  invalidateBrowserAnnotationDocumentRef: { current: () => void }
  annotationViewportBridgeTokenRef: { current: string }
  syncBrowserAnnotationViewportBridge: () => void
}

const attached = vi.hoisted(() => ({ args: [] as unknown[] }))
vi.mock('./attach-browser-page-webview', () => ({
  attachBrowserPageWebview: (args: unknown) => {
    attached.args.push(args)
    return () => {}
  }
}))

const setBridge = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  attached.args.length = 0
  setBridge.mockClear()
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: { setAnnotationViewportBridge: setBridge }
  })
  useBrowserAnnotationStore.setState({
    browserAnnotationsByPageId: {},
    browserAnnotationMarkerIdsByPageId: {}
  })
})
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'browserAPI')
})

function lifecycleProps(overrides: {
  cancelPendingBrowserCapture?: () => void
  pendingAnnotationPayload?: BrowserGrabPayload | null
  setBrowserOverlayViewport?: () => void
  isActive?: boolean
}) {
  const ref = <T,>(current: T) => ({ current })
  return {
    browserTabId: 'page-1',
    browserTabUrl: 'https://example.com/',
    browserTabLoading: false,
    browserTabLoadError: null,
    workspaceId: 'ws-1',
    scopeId: 'scope-1',
    sessionProfileId: null,
    webviewPartition: 'persist:test',
    isActive: overrides.isActive ?? true,
    isPaintable: true,
    slotViewport: null,
    addressBarInputRef: ref(null),
    addressBarValueRef: ref(''),
    browserTabUrlRef: ref('https://example.com/'),
    keepAddressBarFocusRef: ref(false),
    handleInternalFileDragOverRef: ref(() => {}),
    handleInternalFileDropRef: ref(() => {}),
    dismissAddressBarSuggestionsRef: ref(null),
    onUpdatePageState: vi.fn(),
    onSetUrl: vi.fn(),
    setAddressBarValue: vi.fn(),
    cancelPendingBrowserCapture: overrides.cancelPendingBrowserCapture ?? vi.fn(),
    setBrowserOverlayViewport: overrides.setBrowserOverlayViewport ?? vi.fn(),
    setFindOpen: vi.fn(),
    focusAddressBarNow: () => false,
    focusWebviewNow: () => false,
    paneZoomLevelRef: ref(0),
    viewportPresetId: null,
    setBrowserZoomPercent: vi.fn(),
    pendingAnnotationPayload: overrides.pendingAnnotationPayload ?? null,
    inputLocked: false,
    faviconUrl: null,
    webviewRef: ref(null),
    lastKnownWebviewUrlRef: ref(null),
    trackNextLoadingEventRef: ref(false),
    recoveryNavigationValidationRef: ref(null),
    activeLoadFailureRef: ref(null),
    retryGuestRecoveryRef: ref(() => {}),
    onUpdatePageStateRef: ref(vi.fn()),
    onSetUrlRef: ref(vi.fn())
  }
}

describe('annotation viewport bridge wiring', () => {
  it('pushes saved annotation markers to the guest bridge', () => {
    useBrowserAnnotationStore.getState().addBrowserPageAnnotation(makeAnnotation('page-1'))
    renderHook(() => useBrowserPageWebviewLifecycle(lifecycleProps({})))

    expect(setBridge).toHaveBeenCalled()
    const call = setBridge.mock.calls.at(-1)?.[0]
    expect(call.browserPageId).toBe('page-1')
    expect(call.enabled).toBe(true)
    expect(call.markers.map((marker: { id: string }) => marker.id)).toEqual(['annotation-1'])
    expect(call.emitViewport).toBe(false)
  })

  it('re-syncs when an annotation is added and when a pending card appears', () => {
    const view = renderHook((props) => useBrowserPageWebviewLifecycle(lifecycleProps(props)), {
      initialProps: {} as Parameters<typeof lifecycleProps>[0]
    })
    setBridge.mockClear()
    act(() => {
      useBrowserAnnotationStore.getState().addBrowserPageAnnotation(makeAnnotation('page-1'))
    })
    expect(setBridge).toHaveBeenCalled()

    setBridge.mockClear()
    const pending = makeAnnotation('page-1').payload as BrowserGrabPayload
    view.rerender({ pendingAnnotationPayload: pending })
    expect(setBridge.mock.calls.at(-1)?.[0]).toMatchObject({ enabled: true, emitViewport: true })
  })

  it('hands the attach step a token and a document invalidation that cancels the pending capture', () => {
    useBrowserAnnotationStore.getState().addBrowserPageAnnotation(makeAnnotation('page-1'))
    const cancelPendingBrowserCapture = vi.fn()
    renderHook(() =>
      useBrowserPageWebviewLifecycle(lifecycleProps({ cancelPendingBrowserCapture }))
    )
    const args = attached.args.at(-1) as AttachArgs
    expect(args.annotationViewportBridgeTokenRef.current).toMatch(/^[0-9a-f]{32}$/)
    expect(
      useBrowserAnnotationStore.getState().browserAnnotationMarkerIdsByPageId['page-1']
    ).toEqual(['annotation-1'])

    setBridge.mockClear()
    args.invalidateBrowserAnnotationDocumentRef.current()

    expect(cancelPendingBrowserCapture).toHaveBeenCalledOnce()
    expect(
      useBrowserAnnotationStore.getState().browserAnnotationMarkerIdsByPageId['page-1']
    ).toBeUndefined()
    expect(setBridge.mock.calls.at(-1)?.[0]).toMatchObject({ enabled: false, markers: [] })
  })
})
