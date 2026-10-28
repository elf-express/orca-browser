import { browserSessionRegistry } from './browser-session-registry'

let initialized = false

export function initializeBrowserSessionsForApp(opts: { userDataDir: string }): void {
  if (initialized) {
    return
  }

  browserSessionRegistry.configure(opts)

  // Why: cookie replay must happen before the first session.fromPartition()
  // call, otherwise Chromium opens the stale live cookie DB before import.
  browserSessionRegistry.applyPendingCookieImport()
  browserSessionRegistry.initializeBrowserSessionsFromPersistedState()
  initialized = true
}
