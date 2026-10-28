export const BROWSER_INVOKE_CHANNELS = [
  'browser:registerGuest',
  'browser:isGuestRegistered',
  'browser:repairGuestRegistration',
  'browser:unregisterGuest',
  'browser:activeTabChanged',
  'browser:openDevTools',
  'browser:openExternal',
  'browser:writeClipboardText'
] as const

export const BROWSER_EVENT_CHANNELS = [
  'browser:guest-load-failed',
  'browser:permission-denied',
  'browser:popup',
  'browser:context-menu-requested',
  'browser:context-menu-dismissed',
  'browser:open-link-in-orca-tab',
  'browser:focusAddressBar',
  'browser:reloadPage',
  'browser:hardReloadPage',
  'browser:findInPage',
  'browser:historyNavigate',
  'browser:zoomPage',
  'browser:systemResumed'
] as const
