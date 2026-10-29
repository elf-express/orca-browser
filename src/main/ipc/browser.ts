import { ipcMain, webContents } from 'electron'
import type { BrowserGuestArgs } from '../../shared/browser-api-types'
import type { AgentBrowserBridge } from '../browser/agent-browser-bridge'
import { browserManager } from '../browser/browser-manager'
import { disposeGrabModeStateForPage } from './browser-grab-ipc'
import { isTrustedBrowserRenderer } from './browser-renderer-trust'
import {
  isLiveBrowserWebContentsId,
  resolveTabRegistrationWaiters
} from './browser-tab-registration-wait'

export type { BrowserGuestArgs }

let agentBrowserBridgeRef: AgentBrowserBridge | null = null

export function setAgentBrowserBridgeRef(bridge: AgentBrowserBridge | null): void {
  agentBrowserBridgeRef = bridge
}

const BROWSER_HANDLER_CHANNELS = [
  'browser:registerGuest',
  'browser:isGuestRegistered',
  'browser:repairGuestRegistration',
  'browser:unregisterGuest',
  'browser:activeTabChanged'
] as const

export function registerBrowserHandlers(): () => void {
  for (const channel of BROWSER_HANDLER_CHANNELS) {
    ipcMain.removeHandler(channel)
  }

  const registerGuest = (
    event: Electron.IpcMainInvokeEvent,
    args: BrowserGuestArgs,
    repairPolicies: boolean
  ): boolean => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false
    }
    if (
      !args ||
      typeof args.browserPageId !== 'string' ||
      typeof args.scopeId !== 'string' ||
      typeof args.webContentsId !== 'number'
    ) {
      return false
    }
    if (repairPolicies) {
      const guest = webContents.fromId(args.webContentsId)
      if (
        !guest ||
        guest.isDestroyed() ||
        guest.getType() !== 'webview' ||
        guest.hostWebContents?.id !== event.sender.id
      ) {
        return false
      }
      browserManager.attachGuestPolicies(guest)
    }
    // Why: a changed webContents id for a known page means a process swap; the bridge must drop the stale proxy.
    const previousWcId = browserManager.getGuestWebContentsId(args.browserPageId)
    const registered = browserManager.registerGuest({
      ...args,
      rendererWebContentsId: event.sender.id
    })
    if (!registered) {
      return false
    }
    if (agentBrowserBridgeRef && previousWcId !== null && previousWcId !== args.webContentsId) {
      agentBrowserBridgeRef.onProcessSwap(args.browserPageId, args.webContentsId, previousWcId)
    }
    resolveTabRegistrationWaiters(args.browserPageId, args.scopeId)
    return true
  }

  ipcMain.handle('browser:registerGuest', (event, args: BrowserGuestArgs) =>
    registerGuest(event, args, false)
  )

  ipcMain.handle('browser:repairGuestRegistration', (event, args: BrowserGuestArgs) =>
    registerGuest(event, args, true)
  )

  ipcMain.handle(
    'browser:isGuestRegistered',
    (event, args: { browserPageId?: unknown; webContentsId?: unknown }): boolean => {
      if (
        !isTrustedBrowserRenderer(event.sender) ||
        typeof args?.browserPageId !== 'string' ||
        typeof args.webContentsId !== 'number'
      ) {
        return false
      }
      return (
        browserManager.getGuestWebContentsId(args.browserPageId) === args.webContentsId &&
        isLiveBrowserWebContentsId(args.webContentsId)
      )
    }
  )

  ipcMain.handle('browser:unregisterGuest', (event, args: { browserPageId: string }) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false
    }
    if (typeof args?.browserPageId !== 'string') {
      return false
    }
    // Why: the bridge must see the page's webContents id before unregisterGuest clears the mapping.
    const wcId = browserManager.getGuestWebContentsId(args.browserPageId)
    if (wcId !== null && agentBrowserBridgeRef) {
      agentBrowserBridgeRef.onTabClosed(wcId)
    }
    browserManager.unregisterGuest(args.browserPageId)
    // Why: a page that is gone must not keep a grab-mode intent or a queued operation chain.
    disposeGrabModeStateForPage(args.browserPageId)
    return true
  })

  // Keeps the bridge's active tab in sync with the renderer so the agent follows the user's tab.
  ipcMain.handle('browser:activeTabChanged', (event, args: { browserPageId: string }) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false
    }
    if (!agentBrowserBridgeRef) {
      return false
    }
    const wcId = browserManager.getGuestWebContentsId(args.browserPageId)
    if (wcId !== null) {
      // Scope-aware so later scope-bound commands do not resolve to a page of another scope.
      agentBrowserBridgeRef.onTabChanged(wcId, browserManager.getScopeIdForTab(args.browserPageId))
    }
    return true
  })

  return () => {
    for (const channel of BROWSER_HANDLER_CHANNELS) {
      ipcMain.removeHandler(channel)
    }
  }
}
