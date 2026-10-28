import { ORCA_BROWSER_BLANK_URL } from '../../shared/constants'
import { isFileUrl, normalizeBrowserNavigationUrl } from '../../shared/browser-url'
import { BrowserManagerEventForwarding } from './browser-manager-event-forwarding'

export abstract class BrowserManagerFinal extends BrowserManagerEventForwarding {
  protected openLinkInOrcaTab(browserTabId: string, rawUrl: string, activate?: boolean): boolean {
    const renderer = this.resolveRendererForBrowserTab(browserTabId)
    if (!renderer) {
      return false
    }
    const normalizedUrl = normalizeBrowserNavigationUrl(rawUrl)
    // Why: the in-app browser never loads local files, so a guest must not be able to queue one as a tab.
    if (!normalizedUrl || normalizedUrl === ORCA_BROWSER_BLANK_URL || isFileUrl(normalizedUrl)) {
      return false
    }
    // Why: only the renderer owns Orca's worktree/tab model; main forwards a validated URL, never letting guest content mutate it.
    renderer.send('browser:open-link-in-orca-tab', {
      browserPageId: browserTabId,
      url: normalizedUrl,
      ...(activate === false ? { activate: false } : {})
    })
    return true
  }
}
