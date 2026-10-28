import { browserManager } from './browser/browser-manager'
import { installSystemResumeForwarding } from './browser/browser-system-resume-forwarding'
import { registerBrowserGuestViewHandlers } from './ipc/browser-guest-view-ipc'
import { registerBrowserHostHandlers } from './ipc/browser-host-ipc'
import { registerBrowserHandlers } from './ipc/browser'
import type { BrowserPluginInstaller } from './plugin-installers'
import { installWebviewSecurity } from './window/main-window-webview-security'

export const installBrowserCore: BrowserPluginInstaller = (options) => {
  const { host } = options
  const getMainWindow = (): Electron.BrowserWindow | null => host.getMainWindow()

  const disposers = [
    registerBrowserHandlers(),
    registerBrowserGuestViewHandlers(),
    registerBrowserHostHandlers(),
    installWebviewSecurity(getMainWindow),
    installSystemResumeForwarding(getMainWindow)
  ]

  return () => {
    for (const dispose of disposers.reverse()) {
      dispose()
    }
    browserManager.unregisterAll()
  }
}
