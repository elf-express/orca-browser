import { webContents } from 'electron'
import type { BrowserGrabCancelReason } from '../../shared/browser-grab-types'
import { BrowserManagerViewport } from './browser-manager-viewport'

export abstract class BrowserManagerGrab extends BrowserManagerViewport {
  /** Validate that the sender owns browserTabId; returns the guest WebContents or null. */
  getAuthorizedGuest(
    browserTabId: string,
    senderWebContentsId: number
  ): Electron.WebContents | null {
    const registeredRenderer = this.rendererWebContentsIdByTabId.get(browserTabId)
    if (registeredRenderer == null || registeredRenderer !== senderWebContentsId) {
      return null
    }
    const guestId = this.webContentsIdByTabId.get(browserTabId)
    if (guestId == null) {
      return null
    }
    const guest = webContents.fromId(guestId)
    if (!guest || guest.isDestroyed()) {
      // Why: a stale guest must clear every per-tab registry entry, not just the WebContents maps.
      this.unregisterGuest(browserTabId)
      return null
    }
    return guest
  }

  // Grab is not part of this phase; these keep the base-class contract with no behavior.
  protected setupGrabShortcut(_browserTabId: string, _guest: Electron.WebContents): void {}

  hasActiveGrabOp(_browserTabId: string): boolean {
    return false
  }

  protected cancelGrabOp(_browserTabId: string, _reason: BrowserGrabCancelReason): void {}
}
