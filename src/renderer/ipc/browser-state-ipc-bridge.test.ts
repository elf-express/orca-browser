import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BrowserApi,
  BrowserGuestLoadFailedEvent,
  BrowserOpenLinkInTabEvent
} from '../../shared/browser-api-types'
import { useBrowserStore } from '../store/browser-store'
import { useBrowserStateIpcBridge } from './browser-state-ipc-bridge'

vi.mock('../components/browser-pane/host-guest/webview-registry', () => ({
  destroyPersistentWebview: vi.fn(() => Promise.resolve())
}))

let openLink: ((event: BrowserOpenLinkInTabEvent) => void) | null = null
let loadFailed: ((event: BrowserGuestLoadFailedEvent) => void) | null = null
const notifyActiveTabChanged = vi.fn(async () => true)

function resetStore(): void {
  useBrowserStore.setState({
    pagesByScope: {},
    activePageIdByScope: {},
    paneMountByScope: {},
    pendingAddressBarFocusByPageId: {}
  })
}

describe('useBrowserStateIpcBridge', () => {
  beforeEach(() => {
    resetStore()
    openLink = null
    loadFailed = null
    notifyActiveTabChanged.mockClear()
    window.browserAPI = {
      notifyActiveTabChanged,
      onGuestLoadFailed: (callback: (event: BrowserGuestLoadFailedEvent) => void) => {
        loadFailed = callback
        return () => {
          loadFailed = null
        }
      },
      onOpenLinkInOrcaTab: (callback: (event: BrowserOpenLinkInTabEvent) => void) => {
        openLink = callback
        return () => {
          openLink = null
        }
      }
    } as unknown as BrowserApi
  })

  afterEach(() => {
    cleanup()
    delete window.browserAPI
    resetStore()
  })

  it('opens a guest link as a new page in the same scope', () => {
    const p1 = useBrowserStore.getState().ensureScopePage('ws-1')
    renderHook(() => useBrowserStateIpcBridge())

    openLink?.({ browserPageId: p1.id, url: 'https://b.test/' })

    const state = useBrowserStore.getState()
    expect(state.pagesByScope['ws-1']).toHaveLength(2)
    const created = state.pagesByScope['ws-1'][1]
    expect(created.url).toBe('https://b.test/')
    expect(state.activePageIdByScope['ws-1']).toBe(created.id)
  })

  it('respects activate false', () => {
    const p1 = useBrowserStore.getState().ensureScopePage('ws-1')
    renderHook(() => useBrowserStateIpcBridge())

    openLink?.({ browserPageId: p1.id, url: 'https://b.test/', activate: false })

    const state = useBrowserStore.getState()
    expect(state.pagesByScope['ws-1']).toHaveLength(2)
    expect(state.activePageIdByScope['ws-1']).toBe(p1.id)
  })

  it('ignores links from unknown pages', () => {
    useBrowserStore.getState().ensureScopePage('ws-1')
    renderHook(() => useBrowserStateIpcBridge())

    openLink?.({ browserPageId: 'missing', url: 'https://b.test/' })

    expect(useBrowserStore.getState().pagesByScope['ws-1']).toHaveLength(1)
  })

  it('notifies main when the active page of the active scope changes', () => {
    useBrowserStore.getState().ensureScopePage('ws-1')
    const p2 = useBrowserStore.getState().createBrowserPage('ws-1', 'https://b.test/', {
      activate: false
    })
    useBrowserStore.getState().setPaneMount('ws-1', { active: true })
    renderHook(() => useBrowserStateIpcBridge())
    notifyActiveTabChanged.mockClear()

    useBrowserStore.getState().setActiveBrowserPage('ws-1', p2.id)

    expect(notifyActiveTabChanged).toHaveBeenCalledTimes(1)
    expect(notifyActiveTabChanged).toHaveBeenCalledWith({ browserPageId: p2.id })
  })

  it('does not notify for inactive scopes', () => {
    useBrowserStore.getState().ensureScopePage('ws-2')
    const p2 = useBrowserStore.getState().createBrowserPage('ws-2', 'https://b.test/', {
      activate: false
    })
    renderHook(() => useBrowserStateIpcBridge())

    useBrowserStore.getState().setActiveBrowserPage('ws-2', p2.id)

    expect(notifyActiveTabChanged).not.toHaveBeenCalled()
  })

  it('does not subscribe when window.browserAPI is missing', () => {
    delete window.browserAPI
    expect(() => renderHook(() => useBrowserStateIpcBridge())).not.toThrow()
    expect(openLink).toBeNull()
  })
  it('records a guest load failure on a known page', () => {
    const p1 = useBrowserStore.getState().ensureScopePage('ws-1')
    useBrowserStore.getState().updateBrowserPageState(p1.id, { loading: true, canGoBack: true })
    renderHook(() => useBrowserStateIpcBridge())
    const loadError = {
      code: -105,
      description: 'ERR_NAME_NOT_RESOLVED',
      validatedUrl: 'https://x.test/'
    }

    loadFailed?.({ browserPageId: p1.id, loadError })

    const page = useBrowserStore.getState().pagesByScope['ws-1'][0]
    expect(page.loadError).toEqual(loadError)
    expect(page.loading).toBe(false)
    expect(page.canGoBack).toBe(false)
    expect(page.canGoForward).toBe(false)
  })

  it('ignores load failures from unknown pages', () => {
    const p1 = useBrowserStore.getState().ensureScopePage('ws-1')
    renderHook(() => useBrowserStateIpcBridge())

    loadFailed?.({
      browserPageId: 'missing',
      loadError: { code: -1, description: 'x', validatedUrl: 'https://x.test/' }
    })

    expect(useBrowserStore.getState().pagesByScope['ws-1'][0].loadError).toBe(p1.loadError)
    expect(useBrowserStore.getState().pagesByScope['ws-1']).toHaveLength(1)
  })

  it('unsubscribes from load failures on unmount', () => {
    const view = renderHook(() => useBrowserStateIpcBridge())
    expect(loadFailed).not.toBeNull()

    view.unmount()

    expect(loadFailed).toBeNull()
  })
})
