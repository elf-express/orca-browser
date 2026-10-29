import type { BrowserSetAnnotationViewportBridgeArgs } from './browser-annotation-viewport-bridge'
import type { BrowserFindSource } from './browser-find-source'
import type {
  BrowserAwaitGrabSelectionArgs,
  BrowserCancelGrabArgs,
  BrowserCaptureSelectionScreenshotArgs,
  BrowserCaptureSelectionScreenshotResult,
  BrowserExtractHoverArgs,
  BrowserExtractHoverResult,
  BrowserGrabResult,
  BrowserSetGrabModeArgs,
  BrowserSetGrabModeResult,
  GrabIntent
} from './browser-grab-types'
import type {
  BrowserContextMenuDismissedEvent,
  BrowserContextMenuRequestedEvent,
  BrowserPermissionDeniedEvent,
  BrowserPopupEvent
} from './browser-guest-events'
import type {
  BrowserHistoryNavigateCommand,
  BrowserPageCommandTarget
} from './browser-page-command-target'
import type { BrowserPageZoomCommand } from './browser-page-zoom'
import type { BrowserPluginSettings } from './browser-plugin-settings'
import type {
  BrowserIdentityModeSetResult,
  BrowserIdentityModeStatus,
  BrowserUserAgentMode
} from './browser-user-agent-mode'
import type {
  BrowserCookieImportResult,
  BrowserLoadError,
  BrowserSessionProfile,
  BrowserViewportOverride,
  BrowserViewportScrollState
} from './browser-workspace-types'

/** A detected browser the cookie importer can read from; credential-store details stay in main. */
export type DetectedBrowserPickerEntry = {
  family: string
  label: string
  profiles: { name: string; directory: string }[]
  selectedProfile: string
}

export type BrowserGuestArgs = {
  browserPageId: string
  scopeId: string
  sessionProfileId?: string | null
  webContentsId: number
}

export type BrowserGuestLoadFailedEvent = {
  browserPageId: string
  loadError: BrowserLoadError
}

export type BrowserOpenLinkInTabEvent = {
  browserPageId: string
  url: string
  activate?: boolean
}

/** Every `on*` subscription returns the function that cancels it. */
export type BrowserUnsubscribe = () => void

export interface BrowserMcpApi {
  getEndpoint(): Promise<BrowserMcpEndpoint | null>
  getStatus(): Promise<BrowserMcpStatus>
  rotateToken(): Promise<string>
}

export interface BrowserApi {
  readonly apiVersion: 1
  registerGuest(args: BrowserGuestArgs): Promise<boolean>
  isGuestRegistered(args: { browserPageId: string; webContentsId: number }): Promise<boolean>
  repairGuestRegistration(args: BrowserGuestArgs): Promise<boolean>
  unregisterGuest(args: { browserPageId: string }): Promise<boolean>
  notifyActiveTabChanged(args: { browserPageId: string }): Promise<boolean>
  openDevTools(args: { browserPageId: string }): Promise<boolean>
  setViewportOverride(args: {
    browserPageId: string
    override: BrowserViewportOverride | null
  }): Promise<boolean>
  setAnnotationViewportBridge(args: BrowserSetAnnotationViewportBridgeArgs): Promise<boolean>
  reportViewportScrollState(args: {
    browserPageId: string
    state: BrowserViewportScrollState
  }): void
  openExternal(args: { url: string }): Promise<boolean>
  writeClipboardText(text: string): Promise<void>
  onGuestLoadFailed(callback: (event: BrowserGuestLoadFailedEvent) => void): BrowserUnsubscribe
  onPermissionDenied(callback: (event: BrowserPermissionDeniedEvent) => void): BrowserUnsubscribe
  onPopup(callback: (event: BrowserPopupEvent) => void): BrowserUnsubscribe
  onContextMenuRequested(
    callback: (event: BrowserContextMenuRequestedEvent) => void
  ): BrowserUnsubscribe
  onContextMenuDismissed(
    callback: (event: BrowserContextMenuDismissedEvent) => void
  ): BrowserUnsubscribe
  onOpenLinkInOrcaTab(callback: (event: BrowserOpenLinkInTabEvent) => void): BrowserUnsubscribe
  onFocusAddressBar(callback: (target: BrowserPageCommandTarget) => void): BrowserUnsubscribe
  onReloadPage(callback: (target: BrowserPageCommandTarget) => void): BrowserUnsubscribe
  onHardReloadPage(callback: (target: BrowserPageCommandTarget) => void): BrowserUnsubscribe
  onFindInPage(source: BrowserFindSource, callback: () => void): BrowserUnsubscribe
  onHistoryNavigate(callback: (command: BrowserHistoryNavigateCommand) => void): BrowserUnsubscribe
  onZoomPage(callback: (command: BrowserPageZoomCommand) => void): BrowserUnsubscribe
  onScrollPage(
    callback: (event: { browserPageId: string; deltaX: number; deltaY: number }) => void
  ): BrowserUnsubscribe
  onSystemResumed(callback: () => void): BrowserUnsubscribe
  setGrabMode(args: BrowserSetGrabModeArgs): Promise<BrowserSetGrabModeResult>
  awaitGrabSelection(args: BrowserAwaitGrabSelectionArgs): Promise<BrowserGrabResult>
  cancelGrab(args: BrowserCancelGrabArgs): Promise<boolean>
  captureSelectionScreenshot(
    args: BrowserCaptureSelectionScreenshotArgs
  ): Promise<BrowserCaptureSelectionScreenshotResult>
  extractHoverPayload(args: BrowserExtractHoverArgs): Promise<BrowserExtractHoverResult>
  onGrabModeToggle(
    callback: (browserPageId: string, intent: GrabIntent) => void
  ): BrowserUnsubscribe
  onGrabActionShortcut(
    callback: (data: { browserPageId: string; key: 'c' | 's' }) => void
  ): BrowserUnsubscribe
  session: {
    listProfiles(): Promise<BrowserSessionProfile[]>
    createProfile(args: {
      scope: 'isolated' | 'imported'
      label: string
    }): Promise<BrowserSessionProfile | null>
    deleteProfile(args: { profileId: string }): Promise<boolean>
    importCookies(args: { profileId: string }): Promise<BrowserCookieImportResult>
    importFromBrowser(args: {
      profileId: string
      browserFamily: string
      browserProfile?: string
    }): Promise<BrowserCookieImportResult>
    detectBrowsers(): Promise<DetectedBrowserPickerEntry[]>
    resolvePartition(args: { profileId: string | null }): Promise<string | null>
    clearDefaultCookies(): Promise<boolean>
  }
  identity: {
    get(): Promise<BrowserIdentityModeStatus | null>
    set(mode: BrowserUserAgentMode): Promise<BrowserIdentityModeSetResult | null>
  }
  mcp: BrowserMcpApi
  settings: {
    get(): Promise<BrowserPluginSettings>
    set(patch: Partial<BrowserPluginSettings>): Promise<BrowserPluginSettings | null>
  }
}

export type BrowserMcpEndpoint = { url: string; token: string }

export type BrowserMcpStatus = {
  state: 'starting' | 'listening' | 'port_in_use' | 'error'
  port: number
  message?: string
}

declare global {
  interface Window {
    browserAPI?: BrowserApi
  }
}
