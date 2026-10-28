import { ipcMain, webContents } from 'electron'
import type { BrowserGuestArgs } from '../../shared/browser-api-types'
import { browserManager } from '../browser/browser-manager'
import { isTrustedBrowserRenderer } from './browser-renderer-trust'
import {
  isLiveBrowserWebContentsId,
  resolveTabRegistrationWaiters
} from './browser-tab-registration-wait'

export type { BrowserGuestArgs }

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
    const registered = browserManager.registerGuest({
      ...args,
      rendererWebContentsId: event.sender.id
    })
    if (!registered) {
      return false
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
    browserManager.unregisterGuest(args.browserPageId)
    return true
  })

  // No agent bridge exists yet, so there is no active tab to keep in sync.
  ipcMain.handle('browser:activeTabChanged', (event, _args: { browserPageId: string }) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false
    }
    return false
  })

  return () => {
    for (const channel of BROWSER_HANDLER_CHANNELS) {
      ipcMain.removeHandler(channel)
    }
  }
}
