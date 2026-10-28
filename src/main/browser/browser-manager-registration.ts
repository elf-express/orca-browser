import { webContents } from 'electron'
import type { BrowserGuestRegistration } from './browser-manager-types'
import { BrowserManagerGuestPolicy } from './browser-manager-guest-policy'

export abstract class BrowserManagerRegistration extends BrowserManagerGuestPolicy {
  registerGuest({
    browserPageId,
    scopeId,
    sessionProfileId,
    webContentsId,
    rendererWebContentsId
  }: BrowserGuestRegistration): boolean {
    const browserTabId = browserPageId
    if (!browserTabId) {
      return false
    }
    // Why: on guest-surface swap, cancel any grab bound to the old guest's listeners so it doesn't strand on a stale webContents.
    this.cancelGrabOp(browserTabId, 'evicted')

    const previousCleanup = this.contextMenuCleanupByTabId.get(browserTabId)
    if (previousCleanup) {
      previousCleanup()
      this.contextMenuCleanupByTabId.delete(browserTabId)
    }

    const guest = webContents.fromId(webContentsId)
    if (!guest || guest.isDestroyed()) {
      return false
    }

    // Why: don't trust the renderer-sent id blindly — a compromised renderer could pass the main window's id; only accept webview guests.
    if (guest.getType() !== 'webview') {
      return false
    }
    if (!this.policyAttachedGuestIds.has(webContentsId)) {
      // Why: only trust guests that passed attach-time policy install, or a renderer could point us at an arbitrary webview.
      return false
    }

    const previousWebContentsId = this.webContentsIdByTabId.get(browserTabId)
    if (previousWebContentsId !== undefined && previousWebContentsId !== webContentsId) {
      this.retireStaleGuestWebContents(previousWebContentsId)
      this.viewportPresetByTabId.delete(browserTabId)
      this.viewportScrollStateByTabId.delete(browserTabId)
    }
    this.webContentsIdByTabId.set(browserTabId, webContentsId)
    this.tabIdByWebContentsId.set(webContentsId, browserTabId)
    this.sessionProfileIdByPageId.set(browserTabId, sessionProfileId ?? null)
    this.rendererWebContentsIdByTabId.set(browserTabId, rendererWebContentsId)
    if (scopeId) {
      this.scopeIdByTabId.set(browserTabId, scopeId)
    }

    this.setupContextMenu(browserTabId, guest)
    this.setupGrabShortcut(browserTabId, guest)
    this.setupShortcutForwarding(browserTabId, guest)
    this.setupMouseWheelZoomForwarding(browserTabId, guest)
    this.flushPendingLoadFailure(browserTabId, webContentsId)
    this.flushPendingPermissionEvents(browserTabId, webContentsId)
    this.flushPendingPopupEvents(browserTabId, webContentsId)
    return true
  }

  unregisterGuest(
    browserTabId: string,
    _reason: 'page-closed' | 'guest-destroyed' = 'page-closed'
  ): void {
    // Why: teardown mid-grab must cancel it so the renderer gets a signal, not a dangling Promise.
    this.cancelGrabOp(browserTabId, 'evicted')

    // Why: remove attachGuestPolicies listeners so their guest-WebContents closures don't block GC.
    const guestWebContentsId = this.webContentsIdByTabId.get(browserTabId)
    if (guestWebContentsId !== undefined) {
      this.cleanupGuestPolicyAttachment(guestWebContentsId)
    }

    const cleanup = this.contextMenuCleanupByTabId.get(browserTabId)
    if (cleanup) {
      cleanup()
      this.contextMenuCleanupByTabId.delete(browserTabId)
    }
    const shortcutCleanup = this.grabShortcutCleanupByTabId.get(browserTabId)
    if (shortcutCleanup) {
      shortcutCleanup()
      this.grabShortcutCleanupByTabId.delete(browserTabId)
    }
    const fwdCleanup = this.shortcutForwardingCleanupByTabId.get(browserTabId)
    if (fwdCleanup) {
      fwdCleanup()
      this.shortcutForwardingCleanupByTabId.delete(browserTabId)
    }
    const mouseWheelZoomCleanup = this.mouseWheelZoomCleanupByTabId.get(browserTabId)
    if (mouseWheelZoomCleanup) {
      mouseWheelZoomCleanup()
      this.mouseWheelZoomCleanupByTabId.delete(browserTabId)
    }
    const wcId = this.webContentsIdByTabId.get(browserTabId)
    if (wcId !== undefined) {
      this.tabIdByWebContentsId.delete(wcId)
    }
    this.webContentsIdByTabId.delete(browserTabId)
    this.rendererWebContentsIdByTabId.delete(browserTabId)
    this.sessionProfileIdByPageId.delete(browserTabId)
    this.scopeIdByTabId.delete(browserTabId)
    // Why: drop the viewport-op chain so the Map doesn't retain a promise keyed to a destroyed guest.
    this.viewportOpsByTabId.delete(browserTabId)
    this.viewportPresetByTabId.delete(browserTabId)
    this.viewportScrollStateByTabId.delete(browserTabId)
    if (wcId !== undefined) {
      this.pendingNavigationByGuestId.delete(wcId)
    }
    this.annotationViewportBridgeOpsByTabId.delete(browserTabId)
  }

  unregisterAll(): void {
    // Cancel all active grab ops before tearing down registrations.
    this.grabSessionController.cancelAll('evicted')
    for (const browserTabId of this.webContentsIdByTabId.keys()) {
      this.unregisterGuest(browserTabId)
    }
    this.policyAttachedGuestIds.clear()
    // Why: unregisterGuest skips guests that were policy-attached but never registered; invoke their cleanup closures here.
    for (const cleanup of this.policyCleanupByGuestId.values()) {
      cleanup()
    }
    this.policyCleanupByGuestId.clear()
    this.tabIdByWebContentsId.clear()
    this.popupOwnerContextByGuestId.clear()
    this.pageInitiatedTabBudgetByRootGuestId.clear()
    this.scopeIdByTabId.clear()
    this.sessionProfileIdByPageId.clear()
    this.viewportPresetByTabId.clear()
    this.viewportScrollStateByTabId.clear()
    this.cdpUserAgentOverrideStateByGuestId.clear()
    this.pendingNavigationByGuestId.clear()
    this.pendingLoadFailuresByGuestId.clear()
    this.loadErrorsByGuestId.clear()
    this.clearedLoadErrorsByGuestId.clear()
    this.pendingPermissionEventsByGuestId.clear()
    this.pendingPopupEventsByGuestId.clear()
    this.mouseWheelZoomCleanupByTabId.clear()
    this.annotationViewportBridgeOpsByTabId.clear()
  }
}
