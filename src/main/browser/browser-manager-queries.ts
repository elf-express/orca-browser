import type { BrowserLoadError } from '../../shared/browser-workspace-types'
import { redactKagiSessionToken } from '../../shared/browser-url'
import { safeOrigin } from './browser-manager-types'
import { BrowserManagerRegistration } from './browser-manager-registration'

export abstract class BrowserManagerQueries extends BrowserManagerRegistration {
  getGuestWebContentsId(browserTabId: string): number | null {
    return this.webContentsIdByTabId.get(browserTabId) ?? null
  }

  getWebContentsIdByTabId(): Map<string, number> {
    return this.webContentsIdByTabId
  }

  getTabIdForWebContentsId(webContentsId: number): string | null {
    return this.tabIdByWebContentsId.get(webContentsId) ?? null
  }

  getScopeIdForTab(browserTabId: string): string | undefined {
    return this.scopeIdByTabId.get(browserTabId)
  }

  getRendererContextForGuest(
    guestWebContentsId: number
  ): { browserPageId: string; renderer: Electron.WebContents } | null {
    const browserPageId = this.resolveBrowserTabIdForGuestWebContentsId(guestWebContentsId)
    if (!browserPageId) {
      return null
    }
    const renderer = this.resolveRendererForBrowserTab(browserPageId)
    return renderer ? { browserPageId, renderer } : null
  }

  getSessionProfileIdForTab(browserTabId: string): string | null {
    return this.sessionProfileIdByPageId.get(browserTabId) ?? null
  }

  getBrowserPageLoadError(browserPageId: string): BrowserLoadError | null {
    const webContentsId = this.webContentsIdByTabId.get(browserPageId)
    return webContentsId === undefined
      ? null
      : (this.loadErrorsByGuestId.get(webContentsId) ?? null)
  }

  // Why: centralize Kagi session-token redaction so every load-error path (did-fail-load, cert failure) strips it.
  protected buildLoadError(code: number, description: string, rawUrl: string): BrowserLoadError {
    return {
      code,
      description,
      validatedUrl: redactKagiSessionToken(rawUrl)
    }
  }

  protected notifyBrowserGuestStateChanged(webContentsId: number): void {
    const browserPageId = this.tabIdByWebContentsId.get(webContentsId)
    const scopeId = browserPageId ? this.scopeIdByTabId.get(browserPageId) : null
    if (scopeId) {
      // Why: runs inside an Electron guest event dispatch, so an escaping throw would be a fatal uncaught exception.
      try {
        this.browserGuestStateChangedListener?.(scopeId)
      } catch (error) {
        console.error('[browser-manager] browserGuestStateChanged listener failed', error)
      }
    }
  }

  notifyPermissionDenied(args: {
    guestWebContentsId: number
    permission: string
    rawUrl: string
  }): void {
    this.forwardOrQueuePermissionDenied(args.guestWebContentsId, {
      permission: args.permission,
      origin: safeOrigin(args.rawUrl)
    })
  }
}
