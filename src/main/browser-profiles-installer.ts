import { join } from 'node:path'
import { BROWSER_PROFILE_INVOKE_CHANNELS } from '../shared/browser-ipc-channels'
import {
  getBrowserIdentityModeSnapshot,
  initializeBrowserIdentityModeStore,
  isBrowserIdentityModeStoreInitialized
} from './browser/browser-identity-mode-store'
import { ensureBrowserProcessUserAgentIdentity } from './browser/browser-process-user-agent'
import { registerAllowedBrowserPartitionSource } from './browser/browser-partition-allowlist'
import { browserSessionRegistry } from './browser/browser-session-registry'
import { initializeBrowserSessionsForApp } from './browser/browser-session-startup'
import { registerBrowserPluginSettingsHandlers } from './ipc/browser-plugin-settings-ipc'
import { registerBrowserSessionProfileHandlers } from './ipc/browser-session-profile-ipc'
import type { BrowserPluginInstaller } from './plugin-installers'
import { ipcMain } from 'electron'

export const installBrowserProfiles: BrowserPluginInstaller = (options) => {
  const { userDataDir } = options.host

  // Order matters: the identity store and registry must be ready before sessions are initialized,
  // otherwise the partition policies cannot read the identity mode.
  // The store and session startup are process-wide singletons that survive dispose, so a
  // reinstall must not initialize them a second time.
  if (!isBrowserIdentityModeStoreInitialized()) {
    initializeBrowserIdentityModeStore(join(userDataDir, 'orca-browser'))
  }
  ensureBrowserProcessUserAgentIdentity(getBrowserIdentityModeSnapshot().appliedMode)
  browserSessionRegistry.configure({ userDataDir })
  initializeBrowserSessionsForApp({ userDataDir })
  const unregisterPartitionSource = registerAllowedBrowserPartitionSource((partition) =>
    browserSessionRegistry.isAllowedPartition(partition)
  )
  registerBrowserSessionProfileHandlers()
  registerBrowserPluginSettingsHandlers(userDataDir)

  return () => {
    for (const channel of BROWSER_PROFILE_INVOKE_CHANNELS) {
      ipcMain.removeHandler(channel)
    }
    unregisterPartitionSource()
  }
}
