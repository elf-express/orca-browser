import { ipcMain } from 'electron'
import {
  normalizeBrowserPluginSettings,
  type BrowserPluginSettings
} from '../../shared/browser-plugin-settings'
import {
  loadBrowserPluginSettings,
  saveBrowserPluginSettings
} from '../browser/browser-plugin-settings-store'
import { isTrustedBrowserRenderer } from './browser-renderer-trust'

export function registerBrowserPluginSettingsHandlers(userDataDir: string): void {
  ipcMain.removeHandler('browser:settings:get')
  ipcMain.removeHandler('browser:settings:set')

  ipcMain.handle('browser:settings:get', (event): BrowserPluginSettings => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return normalizeBrowserPluginSettings(null)
    }
    return loadBrowserPluginSettings(userDataDir)
  })

  ipcMain.handle(
    'browser:settings:set',
    (event, patch: Partial<BrowserPluginSettings>): BrowserPluginSettings | null => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return null
      }
      return saveBrowserPluginSettings(userDataDir, patch)
    }
  )
}
