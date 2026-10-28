import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ORCA_BROWSER_BLANK_URL } from '../../shared/constants'
import { MAX_BROWSER_HISTORY_ENTRIES } from '../../shared/workspace-session-browser-history'
import {
  admitBrowserPageMount,
  isBrowserPageMountAdmitted
} from '../components/browser-pane/host-guest/browser-page-mount-admission'
import { setBrowserRendererHost } from '../i18n'
import { destroyPersistentWebview } from '../components/browser-pane/host-guest/webview-registry'
import { BROWSER_HISTORY_STORAGE_KEY, useBrowserStore } from './browser-store'

vi.mock('../components/browser-pane/host-guest/webview-registry', () => ({
  destroyPersistentWebview: vi.fn(() => Promise.resolve())
}))

function resetStore(): void {
  useBrowserStore.setState({
    pagesByScope: {},
    activePageIdByScope: {},
    paneMountByScope: {},
    browserUrlHistory: [],
    pendingAddressBarFocusByPageId: {}
  })
}

describe('useBrowserStore', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(destroyPersistentWebview).mockClear()
    localStorage.clear()
  })

  it('creates one blank page per scope on ensure', () => {
    const store = useBrowserStore.getState()
    const first = store.ensureScopePage('ws-1')
    expect(first.url).toBe(ORCA_BROWSER_BLANK_URL)
    expect(first.scopeId).toBe('ws-1')
    expect(useBrowserStore.getState().activePageIdByScope['ws-1']).toBe(first.id)

    const second = useBrowserStore.getState().ensureScopePage('ws-1')
    expect(second.id).toBe(first.id)
    expect(useBrowserStore.getState().pagesByScope['ws-1']).toHaveLength(1)
  })

  it('keeps the active page when creating in the background', () => {
    const first = useBrowserStore.getState().ensureScopePage('ws-1')
    useBrowserStore.getState().createBrowserPage('ws-1', 'https://a.test', { activate: false })
    const state = useBrowserStore.getState()
    expect(state.pagesByScope['ws-1']).toHaveLength(2)
    expect(state.activePageIdByScope['ws-1']).toBe(first.id)
  })

  it('activates the next page, else the previous, when closing the active page', () => {
    const p1 = useBrowserStore.getState().ensureScopePage('ws-1')
    const p2 = useBrowserStore.getState().createBrowserPage('ws-1', 'https://b.test')
    const p3 = useBrowserStore.getState().createBrowserPage('ws-1', 'https://c.test')

    useBrowserStore.getState().setActiveBrowserPage('ws-1', p2.id)
    useBrowserStore.getState().closeBrowserPage(p2.id)
    expect(useBrowserStore.getState().activePageIdByScope['ws-1']).toBe(p3.id)

    useBrowserStore.getState().closeBrowserPage(p3.id)
    expect(useBrowserStore.getState().activePageIdByScope['ws-1']).toBe(p1.id)
  })

  it('destroys the persistent webview when a page closes', () => {
    const page = useBrowserStore.getState().ensureScopePage('ws-1')
    useBrowserStore.getState().closeBrowserPage(page.id)
    expect(destroyPersistentWebview).toHaveBeenCalledTimes(1)
    expect(destroyPersistentWebview).toHaveBeenCalledWith(page.id)
  })

  it('releases the mount admission when a page closes', () => {
    const page = useBrowserStore.getState().ensureScopePage('ws-1')
    admitBrowserPageMount(page.id)
    expect(isBrowserPageMountAdmitted(page.id)).toBe(true)

    useBrowserStore.getState().closeBrowserPage(page.id)

    expect(isBrowserPageMountAdmitted(page.id)).toBe(false)
  })

  it('titles a blank page through the translate host', () => {
    setBrowserRendererHost({
      t: (key, fallback) =>
        key === 'auto.components.browser.pane.BrowserPane.366bf5d62c' ? 'Tab baru' : fallback
    })
    try {
      expect(useBrowserStore.getState().ensureScopePage('ws-1').title).toBe('Tab baru')
    } finally {
      setBrowserRendererHost(null)
    }
    expect(useBrowserStore.getState().ensureScopePage('ws-2').title).toBe('New Tab')
  })

  it('leaves an empty scope after closing its last page', () => {
    const page = useBrowserStore.getState().ensureScopePage('ws-1')
    useBrowserStore.getState().closeBrowserPage(page.id)
    const state = useBrowserStore.getState()
    expect(state.pagesByScope['ws-1']).toEqual([])
    expect(state.activePageIdByScope['ws-1']).toBeNull()
  })

  it('isolates scopes', () => {
    const other = useBrowserStore.getState().ensureScopePage('ws-2')
    const before = useBrowserStore.getState().pagesByScope['ws-2']
    const page = useBrowserStore.getState().ensureScopePage('ws-1')
    useBrowserStore.getState().createBrowserPage('ws-1', 'https://a.test')
    useBrowserStore.getState().updateBrowserPageState(page.id, { title: 'changed' })
    useBrowserStore.getState().closeBrowserPage(page.id)

    const state = useBrowserStore.getState()
    expect(state.pagesByScope['ws-2']).toBe(before)
    expect(state.activePageIdByScope['ws-2']).toBe(other.id)
  })

  it('merges repeat visits into one history entry', () => {
    useBrowserStore.getState().addBrowserHistoryEntry('https://a.test/', 'A')
    useBrowserStore.getState().addBrowserHistoryEntry('https://a.test/', 'A')
    const history = useBrowserStore.getState().browserUrlHistory
    expect(history).toHaveLength(1)
    expect(history[0].visitCount).toBe(2)
  })

  it('ignores blank pages in history', () => {
    useBrowserStore.getState().addBrowserHistoryEntry(ORCA_BROWSER_BLANK_URL, 'New Tab')
    useBrowserStore.getState().addBrowserHistoryEntry('about:blank', 'New Tab')
    expect(useBrowserStore.getState().browserUrlHistory).toHaveLength(0)
  })

  it('caps history at 200 entries', () => {
    for (let index = 0; index < MAX_BROWSER_HISTORY_ENTRIES + 1; index += 1) {
      useBrowserStore
        .getState()
        .addBrowserHistoryEntry(`https://site-${index}.test/`, `Site ${index}`)
    }
    const history = useBrowserStore.getState().browserUrlHistory
    expect(history).toHaveLength(200)
    expect(history.some((entry) => entry.url === 'https://site-0.test/')).toBe(false)
    expect(history.some((entry) => entry.url === 'https://site-200.test/')).toBe(true)
  })

  it('persists only the url history', () => {
    useBrowserStore.getState().ensureScopePage('ws-1')
    useBrowserStore.getState().addBrowserHistoryEntry('https://a.test/', 'A')
    const raw = localStorage.getItem(BROWSER_HISTORY_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(Object.keys(JSON.parse(raw as string).state)).toEqual(['browserUrlHistory'])
  })

  it('consumes an address bar focus request once', () => {
    useBrowserStore.getState().requestAddressBarFocus('p1')
    expect(useBrowserStore.getState().consumeAddressBarFocusRequest('p1')).toBe(true)
    expect(useBrowserStore.getState().consumeAddressBarFocusRequest('p1')).toBe(false)
  })
})
