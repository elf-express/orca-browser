import { ipcMain } from 'electron'
import { BROWSER_GRAB_INVOKE_CHANNELS } from '../shared/browser-ipc-channels'
import { registerBrowserGrabHandlers, resetGrabModeState } from './ipc/browser-grab-ipc'
import type { BrowserPluginInstaller } from './plugin-installers'

export const installBrowserGrab: BrowserPluginInstaller = () => {
  registerBrowserGrabHandlers()

  return () => {
    for (const channel of BROWSER_GRAB_INVOKE_CHANNELS) {
      ipcMain.removeHandler(channel)
    }
    resetGrabModeState()
  }
}
