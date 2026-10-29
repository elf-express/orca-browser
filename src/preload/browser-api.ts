import { ipcRenderer } from 'electron'
import type { BrowserApi } from '../shared'
import { browserGuestRegistrationApi } from './api/browser-bridge-guest-registration-and-downloads'
import { browserMcpApi } from './api/browser-mcp'
import { browserSessionApi } from './api/browser-session-api'
import { browserPageInteractionApi } from './api/browser-bridge-page-interaction-and-sessions'
import { browserUiCommandApi } from './api/ui-bridge-tab-and-browser-commands'
import { createBrowserFindSubscriptions } from './browser-find-subscriptions'

const browserFindSubscriptions = createBrowserFindSubscriptions()

ipcRenderer.on('browser:findInPage', (_event, target: unknown) =>
  browserFindSubscriptions.dispatch(target)
)

export function createBrowserApi(): BrowserApi {
  return {
    apiVersion: 1,
    ...browserGuestRegistrationApi,
    ...browserPageInteractionApi,
    ...browserUiCommandApi,
    ...browserSessionApi,
    mcp: browserMcpApi,
    onFindInPage: browserFindSubscriptions.subscribe
  }
}
