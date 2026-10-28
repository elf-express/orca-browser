// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ORCA_BROWSER_BLANK_URL } from '../../../../shared/constants'
import { useBrowserStore } from '../../../store/browser-store'
import { createBrowserPageWebviewNavigationHandlers } from './browser-page-webview-navigation-handlers'

vi.mock('./webview-registry', () => ({
  destroyPersistentWebview: vi.fn(() => Promise.resolve())
}))

function createHandlers(
  currentUrl: string
): ReturnType<typeof createBrowserPageWebviewNavigationHandlers> {
  const webview = { getURL: () => currentUrl } as unknown as Electron.WebviewTag
  return createBrowserPageWebviewNavigationHandlers({
    webview,
    browserTabId: 'tab-1',
    browserTabUrl: currentUrl,
    recoveryNavigationValidationRef: { current: null },
    activeLoadFailureRef: { current: null },
    lastKnownWebviewUrlRef: { current: null },
    addressBarInputRef: { current: null },
    onSetUrlRef: { current: () => {} },
    onUpdatePageStateRef: { current: () => {} },
    addBrowserHistoryEntryRef: {
      current: (url, title, faviconUrl) =>
        useBrowserStore.getState().addBrowserHistoryEntry(url, title, faviconUrl)
    },
    faviconUrlRef: { current: null },
    setAddressBarValue: () => {}
  })
}

describe('page-title-updated history recording', () => {
  beforeEach(() => {
    useBrowserStore.setState({ browserUrlHistory: [] })
  })

  it('records a history entry carrying the updated title', () => {
    createHandlers('https://a.test/page').handleTitleUpdate({ title: 'Page A' })

    const history = useBrowserStore.getState().browserUrlHistory
    expect(history).toHaveLength(1)
    expect(history[0].url).toBe('https://a.test/page')
    expect(history[0].title).toBe('Page A')
  })

  it('does not record a blank page', () => {
    createHandlers(ORCA_BROWSER_BLANK_URL).handleTitleUpdate({ title: 'New Tab' })
    createHandlers('about:blank').handleTitleUpdate({ title: 'blank' })

    expect(useBrowserStore.getState().browserUrlHistory).toHaveLength(0)
  })
})
