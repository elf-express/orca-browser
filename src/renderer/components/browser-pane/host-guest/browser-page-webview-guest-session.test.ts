import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserPageWebviewGuestSession } from './browser-page-webview-guest-session'

type SessionArgs = Parameters<typeof createBrowserPageWebviewGuestSession>[0]

function createSession(presetId: string | null) {
  const webview = {
    isConnected: true,
    getWebContentsId: () => {
      throw new Error('detached')
    },
    setZoomLevel: vi.fn(),
    getZoomLevel: vi.fn(() => 0)
  } as unknown as Electron.WebviewTag
  const ref = <T>(current: T): { current: T } => ({ current })
  const args = {
    webview,
    browserTabId: 'tab-1',
    scopeId: 'scope-1',
    sessionProfileId: null,
    webviewRef: ref<Electron.WebviewTag | null>(webview),
    isPaintableRef: ref(false),
    guestRecoveryPendingRef: ref(false),
    browserTabUrlRef: ref('https://example.com/'),
    addressBarValueRef: ref('https://example.com/'),
    activeLoadFailureRef: ref(null),
    recoveryNavigationValidationRef: ref(null),
    keepAddressBarFocusRef: ref(false),
    paneZoomLevelRef: ref(0),
    viewportPresetIdRef: ref(presetId),
    onUpdatePageStateRef: ref(vi.fn()),
    setGuestRecoveryGeneration: vi.fn(),
    setBrowserZoomPercent: vi.fn(),
    focusAddressBarNow: () => false,
    syncNavigationState: vi.fn()
  } as unknown as SessionArgs
  return createBrowserPageWebviewGuestSession(args)
}

describe('guest session dom-ready viewport preset', () => {
  const setViewportOverride = vi.fn(async () => true)

  afterEach(() => {
    setViewportOverride.mockClear()
    vi.unstubAllGlobals()
  })

  function stubBrowserApi(): void {
    vi.stubGlobal('window', { browserAPI: { setViewportOverride } })
  }

  it('re-sends the preset override on dom-ready', () => {
    stubBrowserApi()
    createSession('tablet').handleDomReady()

    expect(setViewportOverride).toHaveBeenCalledTimes(1)
    expect(setViewportOverride).toHaveBeenCalledWith({
      browserPageId: 'tab-1',
      override: expect.objectContaining({ width: 768, height: 1024 })
    })
  })

  it('clears a stale override when no preset is selected', () => {
    stubBrowserApi()
    createSession(null).handleDomReady()

    expect(setViewportOverride).toHaveBeenCalledWith({ browserPageId: 'tab-1', override: null })
  })
})
