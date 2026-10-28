import type { BrowserFindSource } from './browser-find-source'
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
import type { BrowserLoadError } from './browser-workspace-types'

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

export interface BrowserApi {
  readonly apiVersion: 1
  registerGuest(args: BrowserGuestArgs): Promise<boolean>
  isGuestRegistered(args: { browserPageId: string; webContentsId: number }): Promise<boolean>
  repairGuestRegistration(args: BrowserGuestArgs): Promise<boolean>
  unregisterGuest(args: { browserPageId: string }): Promise<boolean>
  notifyActiveTabChanged(args: { browserPageId: string }): Promise<boolean>
  openDevTools(args: { browserPageId: string }): Promise<boolean>
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
  onSystemResumed(callback: () => void): BrowserUnsubscribe
}

declare global {
  interface Window {
    browserAPI?: BrowserApi
  }
}
