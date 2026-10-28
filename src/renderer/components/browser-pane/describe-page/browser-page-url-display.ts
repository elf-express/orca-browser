import type { BrowserPage as BrowserPageState } from '../../../../shared/browser-workspace-types'
import { ORCA_BROWSER_BLANK_URL } from '../../../../shared/constants'
import {
  normalizeBrowserNavigationUrl,
  isFileUrl,
  normalizeExternalBrowserUrl,
  redactKagiSessionToken
} from '../../../../shared/browser-url'
import type { BrowserTabPageState } from './browser-page-types'

export function toDisplayUrl(url: string): string {
  return url === ORCA_BROWSER_BLANK_URL ? 'about:blank' : redactKagiSessionToken(url)
}

export function getBrowserDisplayTitle(title: string | null | undefined, url: string): string {
  if (
    url === 'about:blank' ||
    url === ORCA_BROWSER_BLANK_URL ||
    title === 'about:blank' ||
    title === ORCA_BROWSER_BLANK_URL ||
    !title
  ) {
    return 'New Tab'
  }
  return title
}

export function isChromiumErrorPage(url: string): boolean {
  return url.startsWith('chrome-error://')
}

export function getOpenableExternalUrl(currentUrl: string): string | null {
  return normalizeExternalBrowserUrl(redactKagiSessionToken(currentUrl))
}

export function retryBrowserTabLoad(
  webview: Electron.WebviewTag | null,
  browserTab: BrowserPageState,
  onUpdatePageState: (tabId: string, updates: BrowserTabPageState) => void
): void {
  if (!webview) {
    return
  }

  const retryUrl = normalizeBrowserNavigationUrl(
    browserTab.loadError?.validatedUrl ?? browserTab.url
  )
  // Why: a refused address-bar entry like /etc/passwd normalizes to file://; stay on the error page.
  if (!retryUrl || isFileUrl(retryUrl)) {
    return
  }

  // Why: after chrome-error://, reload() only refreshes the error page — force navigation back to the attempted URL; keep the failure visible until success.
  onUpdatePageState(browserTab.id, {
    loading: true,
    title: retryUrl
  })
  webview.src = retryUrl
}
