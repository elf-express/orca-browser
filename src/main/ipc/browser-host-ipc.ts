import { clipboard, ipcMain } from 'electron'
import { normalizeExternalBrowserUrl } from '../../shared/browser-url'
import { getBrowserHost } from '../plugin-runtime'
import { isTrustedBrowserRenderer } from './browser-renderer-trust'

const HOST_CHANNELS = ['browser:openExternal', 'browser:writeClipboardText'] as const

export function registerBrowserHostHandlers(): () => void {
  for (const channel of HOST_CHANNELS) {
    ipcMain.removeHandler(channel)
  }

  ipcMain.handle(
    'browser:openExternal',
    async (event, args: { url?: unknown }): Promise<boolean> => {
      if (!isTrustedBrowserRenderer(event.sender) || typeof args?.url !== 'string') {
        return false
      }
      const url = normalizeExternalBrowserUrl(args.url)
      if (!url) {
        return false
      }
      await getBrowserHost().openExternal(url)
      return true
    }
  )

  ipcMain.handle('browser:writeClipboardText', (event, text: unknown): void => {
    if (!isTrustedBrowserRenderer(event.sender) || typeof text !== 'string') {
      return
    }
    clipboard.writeText(text)
  })

  return () => {
    for (const channel of HOST_CHANNELS) {
      ipcMain.removeHandler(channel)
    }
  }
}
