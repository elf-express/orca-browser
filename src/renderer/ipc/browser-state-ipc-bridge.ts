import { useEffect } from 'react'
import { getScopeIdForPage, useBrowserStore, type BrowserStoreState } from '../store/browser-store'

/**
 * Wires main-process browser events into the renderer store and reports the active page of each
 * mounted scope back to main. Does nothing when the host has not exposed `window.browserAPI`.
 */
export function useBrowserStateIpcBridge(): void {
  useEffect(() => {
    const api = window.browserAPI
    if (!api) {
      return
    }
    return api.onOpenLinkInOrcaTab(({ browserPageId, url, activate }) => {
      const scopeId = getScopeIdForPage(browserPageId)
      if (!scopeId) {
        return
      }
      useBrowserStore.getState().createBrowserPage(scopeId, url, { activate: activate ?? true })
    })
  }, [])

  useEffect(() => {
    const api = window.browserAPI
    if (!api) {
      return
    }
    // Unknown page ids are ignored by the store update.
    return api.onGuestLoadFailed(({ browserPageId, loadError }) => {
      useBrowserStore.getState().updateBrowserPageState(browserPageId, {
        loading: false,
        loadError,
        canGoBack: false,
        canGoForward: false
      })
    })
  }, [])

  useEffect(() => {
    const api = window.browserAPI
    if (!api) {
      return
    }
    // Last page reported per scope; a scope that goes inactive is forgotten so reactivation reports again.
    const reported = new Map<string, string>()
    const reportActivePages = (state: BrowserStoreState): void => {
      for (const scopeId of reported.keys()) {
        if (state.paneMountByScope[scopeId]?.active !== true) {
          reported.delete(scopeId)
        }
      }
      for (const [scopeId, mount] of Object.entries(state.paneMountByScope)) {
        const pageId = state.activePageIdByScope[scopeId]
        if (!mount.active || !pageId || reported.get(scopeId) === pageId) {
          continue
        }
        reported.set(scopeId, pageId)
        void api.notifyActiveTabChanged({ browserPageId: pageId })
      }
    }
    reportActivePages(useBrowserStore.getState())
    return useBrowserStore.subscribe(reportActivePages)
  }, [])
}
