import type { BrowserPage as BrowserPageState } from '../../../../shared/browser-workspace-types'

export type BrowserTabPageState = Partial<
  Pick<
    BrowserPageState,
    'title' | 'loading' | 'faviconUrl' | 'canGoBack' | 'canGoForward' | 'loadError'
  >
>

export type BrowserPageUrlSetter = (
  tabId: string,
  url: string,
  options?: { preserveLoadError?: boolean }
) => void

export type BrowserChromeShortcutScope = 'focused' | 'inactive' | 'owned-target'

export type BrowserPageContextMenuState = {
  x: number
  y: number
  linkUrl: string | null
  pageUrl: string
  selectionText: string
}

export type BrowserPageRecoveryNavigationValidation = {
  committed: boolean
  started: boolean
  targetUrl: string
}

export type BrowserPageNavigateEvent = {
  url?: string
  isMainFrame?: boolean
}

export type BrowserPageFailLoadEvent = {
  errorCode?: number
  errorDescription?: string
  validatedURL?: string
  isMainFrame?: boolean
}
