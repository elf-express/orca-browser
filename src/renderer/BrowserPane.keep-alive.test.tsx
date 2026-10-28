import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserPane } from './BrowserPane'
import { BrowserPluginProvider } from './BrowserPluginProvider'
import type { BrowserRendererHost } from './host-context'
import { useBrowserStore } from './store/browser-store'
import type { BrowserApi } from '../shared/browser-api-types'

const host: BrowserRendererHost = { t: (_key, fallback) => fallback }

function createBrowserApiStub(): BrowserApi {
  const unsubscribe = (): (() => void) => () => {}
  return {
    apiVersion: 1,
    registerGuest: vi.fn(async () => true),
    isGuestRegistered: vi.fn(async () => true),
    repairGuestRegistration: vi.fn(async () => true),
    unregisterGuest: vi.fn(async () => true),
    notifyActiveTabChanged: vi.fn(async () => true),
    openDevTools: vi.fn(async () => true),
    openExternal: vi.fn(async () => true),
    writeClipboardText: vi.fn(async () => {}),
    onGuestLoadFailed: unsubscribe,
    onPermissionDenied: unsubscribe,
    onPopup: unsubscribe,
    onContextMenuRequested: unsubscribe,
    onContextMenuDismissed: unsubscribe,
    onOpenLinkInOrcaTab: unsubscribe,
    onFocusAddressBar: unsubscribe,
    onReloadPage: unsubscribe,
    onHardReloadPage: unsubscribe,
    onFindInPage: unsubscribe,
    onHistoryNavigate: unsubscribe,
    onZoomPage: unsubscribe,
    onSystemResumed: unsubscribe
  }
}

function slotOf(scopeId: string): HTMLElement | null {
  return document.querySelector(`[data-orca-browser-scope-slot="${scopeId}"]`)
}

function resetStore(): void {
  useBrowserStore.setState({
    pagesByScope: {},
    activePageIdByScope: {},
    paneMountByScope: {},
    pendingAddressBarFocusByPageId: {}
  })
}

describe('BrowserPane keep-alive overlay', () => {
  beforeEach(() => {
    resetStore()
    window.browserAPI = createBrowserApiStub()
  })

  afterEach(() => {
    cleanup()
    delete window.browserAPI
    resetStore()
  })

  it('parks the scope slot instead of removing the webview when the pane unmounts', () => {
    const view = render(
      <BrowserPluginProvider host={host}>
        <BrowserPane scopeId="ws-1" active />
      </BrowserPluginProvider>
    )
    const slot = slotOf('ws-1')
    expect(slot?.style.display).toBe('flex')
    expect(slot?.querySelectorAll('webview')).toHaveLength(1)
    const webview = slot?.querySelector('webview')

    view.rerender(<BrowserPluginProvider host={host}>{null}</BrowserPluginProvider>)

    expect(slotOf('ws-1')?.style.display).toBe('none')
    expect(webview?.isConnected).toBe(true)
  })

  it('keeps both scopes alive when switching workspaces', () => {
    const view = render(
      <BrowserPluginProvider host={host}>
        <BrowserPane scopeId="ws-1" active />
      </BrowserPluginProvider>
    )
    const firstWebview = slotOf('ws-1')?.querySelector('webview')
    expect(firstWebview).not.toBeNull()

    view.rerender(
      <BrowserPluginProvider host={host}>
        <BrowserPane scopeId="ws-2" active />
      </BrowserPluginProvider>
    )

    expect(slotOf('ws-1')?.style.display).toBe('none')
    expect(slotOf('ws-2')?.style.display).toBe('flex')
    expect(firstWebview?.isConnected).toBe(true)
  })

  it('anchors the slot to the pane', () => {
    render(
      <BrowserPluginProvider host={host}>
        <BrowserPane scopeId="ws-1" active />
      </BrowserPluginProvider>
    )
    const pane = document.querySelector('[data-orca-browser-pane]')
    expect(pane?.getAttribute('data-orca-browser-anchor')).toBe('--orca-browser-ws-1')
    expect(slotOf('ws-1')?.getAttribute('data-orca-browser-anchor')).toBe('--orca-browser-ws-1')
  })

  it('parks the webview while the pane is mounted but inactive', () => {
    const view = render(
      <BrowserPluginProvider host={host}>
        <BrowserPane scopeId="ws-1" active={false} />
      </BrowserPluginProvider>
    )
    const slot = slotOf('ws-1')
    expect(slot?.style.display).toBe('none')
    expect(slot?.style.pointerEvents).toBe('none')

    act(() => {
      view.rerender(
        <BrowserPluginProvider host={host}>
          <BrowserPane scopeId="ws-1" active />
        </BrowserPluginProvider>
      )
    })

    const activeSlot = slotOf('ws-1')
    expect(activeSlot?.style.display).toBe('flex')
    const webviews = activeSlot?.querySelectorAll('webview')
    expect(webviews).toHaveLength(1)

    act(() => {
      view.rerender(
        <BrowserPluginProvider host={host}>
          <BrowserPane scopeId="ws-1" active={false} />
        </BrowserPluginProvider>
      )
    })
    expect(slotOf('ws-1')?.style.display).toBe('none')
    expect(slotOf('ws-1')?.querySelector('webview')).toBe(webviews?.[0])
    expect(webviews?.[0]?.isConnected).toBe(true)
  })

  it('renders only children when window.browserAPI is missing', () => {
    delete window.browserAPI
    const { getByTestId } = render(
      <BrowserPluginProvider host={host}>
        <span data-testid="child">child</span>
        <BrowserPane scopeId="ws-1" active />
      </BrowserPluginProvider>
    )
    expect(getByTestId('child').textContent).toBe('child')
    expect(document.querySelector('[data-orca-browser-scope-slot]')).toBeNull()
  })
})
