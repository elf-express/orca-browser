import { ipcMain } from 'electron'
import { browserManager } from '../browser/browser-manager'
import type { BrowserViewportOverride } from '../../shared/browser-workspace-types'
import { isTrustedBrowserRenderer } from './browser-renderer-trust'

export function registerBrowserGuestViewHandlers(): () => void {
  ipcMain.removeHandler('browser:openDevTools')
  ipcMain.removeHandler('browser:setViewportOverride')
  ipcMain.removeAllListeners?.('browser:reportViewportScrollState')

  ipcMain.handle('browser:openDevTools', (event, args: { browserPageId: string }) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false
    }
    return browserManager.openDevTools(args.browserPageId)
  })

  ipcMain.handle(
    'browser:setViewportOverride',
    (
      event,
      args: {
        browserPageId: string
        override: BrowserViewportOverride | null
      }
    ) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return false
      }
      // Why: CDP misbehaves on non-finite/negative metrics (NaN/Infinity can
      // wedge Emulation.setDeviceMetricsOverride and leave the page in a
      // broken state). Validate at the main-process trust boundary so a buggy
      // or compromised renderer cannot corrupt CDP state.
      if (args.override !== null) {
        const { width, height, deviceScaleFactor, mobile } = args.override
        const isFinitePositive = (n: unknown): n is number =>
          typeof n === 'number' && Number.isFinite(n) && n > 0
        if (!isFinitePositive(width) || width < 1 || width > 10000) {
          return false
        }
        if (!isFinitePositive(height) || height < 1 || height > 10000) {
          return false
        }
        if (
          !isFinitePositive(deviceScaleFactor) ||
          deviceScaleFactor < 0.1 ||
          deviceScaleFactor > 5
        ) {
          return false
        }
        if (typeof mobile !== 'boolean') {
          return false
        }
      }
      return browserManager.setViewportOverride(args.browserPageId, args.override)
    }
  )

  ipcMain.on?.(
    'browser:reportViewportScrollState',
    (
      event,
      args: {
        browserPageId?: unknown
        state?: {
          scrollLeft?: unknown
          scrollTop?: unknown
          maxScrollLeft?: unknown
          maxScrollTop?: unknown
        }
      }
    ) => {
      if (!isTrustedBrowserRenderer(event.sender) || typeof args?.browserPageId !== 'string') {
        return
      }
      const state = args.state
      if (!state) {
        return
      }
      browserManager.setViewportScrollState(args.browserPageId, event.sender.id, {
        scrollLeft: Number(state.scrollLeft),
        scrollTop: Number(state.scrollTop),
        maxScrollLeft: Number(state.maxScrollLeft),
        maxScrollTop: Number(state.maxScrollTop)
      })
    }
  )

  return () => {
    ipcMain.removeAllListeners?.('browser:reportViewportScrollState')
    ipcMain.removeHandler('browser:openDevTools')
    ipcMain.removeHandler('browser:setViewportOverride')
  }
}
