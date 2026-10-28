// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBrowserPageWebviewUrlSync } from './use-browser-page-webview-url-sync'

afterEach(cleanup)

describe('url sync navigation', () => {
  it('assigns webview.src once when the store URL changes and does not loop', () => {
    const srcWrites = vi.fn()
    let src = ''
    const webview = {
      get src() {
        return src
      },
      set src(value: string) {
        srcWrites(value)
        src = value
      },
      getURL: () => 'https://a.test/',
      getAttribute: () => null
    }
    const lastKnownWebviewUrlRef = { current: 'https://a.test/' as string | null }
    const trackNextLoadingEventRef = { current: false }
    const render = (browserTabUrl: string) =>
      useBrowserPageWebviewUrlSync({
        browserTabId: 'tab-1',
        browserTabUrl,
        browserTabLoading: false,
        isActive: false,
        isPaintable: true,
        slotViewport: null,
        webviewRef: { current: webview as unknown as Electron.WebviewTag },
        chromeHeaderRef: { current: null },
        lastKnownWebviewUrlRef,
        trackNextLoadingEventRef,
        keepAddressBarFocusRef: { current: false },
        addressBarInputRef: { current: null },
        browserTabUrlRef: { current: browserTabUrl },
        addressBarValueRef: { current: browserTabUrl },
        onUpdatePageStateRef: { current: () => {} },
        focusWebviewNow: () => false
      })

    const view = renderHook(({ url }) => render(url), { initialProps: { url: 'https://a.test/' } })
    expect(srcWrites).not.toHaveBeenCalled()

    view.rerender({ url: 'https://b.test/' })
    expect(srcWrites).toHaveBeenCalledTimes(1)
    expect(srcWrites).toHaveBeenCalledWith('https://b.test/')
    expect(lastKnownWebviewUrlRef.current).toBe('https://b.test/')
    expect(trackNextLoadingEventRef.current).toBe(true)

    view.rerender({ url: 'https://b.test/' })
    expect(srcWrites).toHaveBeenCalledTimes(1)
  })
})
