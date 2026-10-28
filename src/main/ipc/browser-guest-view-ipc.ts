import { ipcMain } from 'electron'
import { browserManager } from '../browser/browser-manager'
import { isTrustedBrowserRenderer } from './browser-renderer-trust'

export function registerBrowserGuestViewHandlers(): () => void {
  ipcMain.removeHandler('browser:openDevTools')

  ipcMain.handle('browser:openDevTools', (event, args: { browserPageId: string }) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false
    }
    return browserManager.openDevTools(args.browserPageId)
  })

  return () => {
    ipcMain.removeHandler('browser:openDevTools')
  }
}
