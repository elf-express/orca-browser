import { resolveRendererWebContents } from './browser-guest-renderer-target'
import { setupGuestContextMenu } from './browser-guest-context-menu'
import { setupGuestMouseWheelZoomForwarding } from './browser-guest-wheel-zoom'
import { setupGuestShortcutForwarding } from './browser-guest-shortcut-forwarding'
import { BrowserManagerGrab } from './browser-manager-grab'

export abstract class BrowserManagerBindings extends BrowserManagerGrab {
  protected setupContextMenu(browserTabId: string, guest: Electron.WebContents): void {
    this.contextMenuCleanupByTabId.set(
      browserTabId,
      setupGuestContextMenu({
        browserTabId,
        guest,
        resolveRenderer: (tabId) => this.resolveRendererForBrowserTab(tabId)
      })
    )
  }

  // Why: a focused webview guest is a separate process, so its key events never reach the renderer; intercept and forward app shortcuts.
  protected setupShortcutForwarding(browserTabId: string, guest: Electron.WebContents): void {
    const previousCleanup = this.shortcutForwardingCleanupByTabId.get(browserTabId)
    if (previousCleanup) {
      previousCleanup()
      this.shortcutForwardingCleanupByTabId.delete(browserTabId)
    }

    this.shortcutForwardingCleanupByTabId.set(
      browserTabId,
      setupGuestShortcutForwarding({
        browserTabId,
        guest,
        resolveRenderer: (tabId) =>
          resolveRendererWebContents(this.rendererWebContentsIdByTabId, tabId)
      })
    )
  }

  protected setupMouseWheelZoomForwarding(browserTabId: string, guest: Electron.WebContents): void {
    const previousCleanup = this.mouseWheelZoomCleanupByTabId.get(browserTabId)
    if (previousCleanup) {
      previousCleanup()
      this.mouseWheelZoomCleanupByTabId.delete(browserTabId)
    }

    this.mouseWheelZoomCleanupByTabId.set(
      browserTabId,
      setupGuestMouseWheelZoomForwarding({
        browserTabId,
        guest,
        resolveRenderer: (tabId) =>
          resolveRendererWebContents(this.rendererWebContentsIdByTabId, tabId),
        isViewportPresetActive: () => {
          const state = this.viewportPresetByTabId.get(browserTabId)
          return state?.guestWebContentsId === guest.id && state.requested !== null
        },
        canViewportScroll: (mouse) => this.canViewportScroll(browserTabId, mouse),
        onViewportWheelConsumed: (deltaX, deltaY) =>
          this.recordViewportScrollDelta(browserTabId, deltaX, deltaY)
      })
    )
  }
}
