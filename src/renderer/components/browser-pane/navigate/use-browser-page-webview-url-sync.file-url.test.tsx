// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useBrowserPageWebviewUrlSync } from './use-browser-page-webview-url-sync'

function renderSync(browserTabUrl: string): { webview: { src: string } } {
  const webview = {
    src: '',
    getURL: () => 'https://start.test/',
    getAttribute: () => null
  }
  renderHook(() =>
    useBrowserPageWebviewUrlSync({
      browserTabId: 'tab-1',
      browserTabUrl,
      browserTabLoading: false,
      isActive: false,
      isPaintable: true,
      slotViewport: null,
      webviewRef: { current: webview as unknown as Electron.WebviewTag },
      chromeHeaderRef: { current: null },
      lastKnownWebviewUrlRef: { current: null },
      trackNextLoadingEventRef: { current: false },
      keepAddressBarFocusRef: { current: false },
      addressBarInputRef: { current: null },
      browserTabUrlRef: { current: browserTabUrl },
      addressBarValueRef: { current: browserTabUrl },
      onUpdatePageStateRef: { current: () => {} },
      focusWebviewNow: () => false
    })
  )
  return { webview }
}

afterEach(cleanup)

describe('url sync file: refusal', () => {
  it('leaves the webview alone for a file: store URL', () => {
    expect(renderSync('file:///etc/passwd').webview.src).toBe('')
  })

  it('still navigates to an https store URL', () => {
    expect(renderSync('https://example.test/').webview.src).toBe('https://example.test/')
  })
})
