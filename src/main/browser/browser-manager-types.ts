import { normalizeExternalBrowserUrl } from '../../shared/browser-url'
import type { UserAgentMetadata } from './browser-tab-identity'
import type {
  BrowserPermissionDeniedEvent,
  BrowserPopupEvent
} from '../../shared/browser-guest-events'
import type { PageInitiatedTabBudget } from './browser-page-initiated-tab-budget'
import type {
  BrowserLoadError,
  BrowserViewportOverride
} from '../../shared/browser-workspace-types'

export function isChromiumInternalErrorUrl(url: string): boolean {
  return url.startsWith('chrome-error://')
}

export type BrowserGuestRegistration = {
  browserPageId: string
  scopeId: string
  sessionProfileId?: string | null
  webContentsId: number
  rendererWebContentsId: number
}

export type PendingPermissionEvent = Omit<BrowserPermissionDeniedEvent, 'browserPageId'>
export type PendingPopupEvent = Omit<BrowserPopupEvent, 'browserPageId'>
export type PopupOwnerContext = {
  browserTabId: string
  rootGuestWebContentsId: number
}

export type PendingMainFrameNavigation = {
  currentUrl: string
  supersededUrls: string[]
}

/** An Emulation.setUserAgentOverride payload; an empty userAgent clears the override. */
export type CdpUserAgentOverride = {
  userAgent: string
  userAgentMetadata?: UserAgentMetadata
}

export type CdpUserAgentOverrideOperation = {
  sequence: number
  override: CdpUserAgentOverride
}

export type CdpUserAgentOverrideState = {
  confirmed: CdpUserAgentOverrideOperation | null
  nextSequence: number
  pending: CdpUserAgentOverrideOperation[]
}

export const SAFE_POPUP_WINDOW_OPTIONS = {
  alwaysOnTop: false,
  closable: true,
  focusable: true,
  frame: true,
  fullscreen: false,
  kiosk: false,
  modal: false,
  movable: true,
  opacity: 1,
  show: true,
  simpleFullscreen: false,
  skipTaskbar: false,
  titleBarStyle: 'default',
  transparent: false,
  // Why: Electron applies these before createWindow; feature strings/opener inheritance must not relax the child's isolation.
  webPreferences: {
    allowRunningInsecureContent: false,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webviewTag: false
  }
} satisfies Electron.BrowserWindowConstructorOptions

export function safeOrigin(rawUrl: string): string {
  const external = normalizeExternalBrowserUrl(rawUrl)
  const urlToParse = external ?? rawUrl
  try {
    return new URL(urlToParse).origin
  } catch {
    return external ?? 'unknown'
  }
}

export type BrowserManagerLoadError = Pick<
  BrowserLoadError,
  'code' | 'description' | 'validatedUrl'
>

export type {
  BrowserLoadError,
  BrowserViewportOverride,
  BrowserPermissionDeniedEvent,
  BrowserPopupEvent,
  PageInitiatedTabBudget
}
