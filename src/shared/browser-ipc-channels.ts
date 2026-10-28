export const BROWSER_INVOKE_CHANNELS = [
  'browser:registerGuest',
  'browser:isGuestRegistered',
  'browser:repairGuestRegistration',
  'browser:unregisterGuest',
  'browser:activeTabChanged',
  'browser:openDevTools',
  'browser:openExternal',
  'browser:writeClipboardText',
  'browser:setViewportOverride'
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

export const BROWSER_PROFILE_INVOKE_CHANNELS = [
  'browser:session:listProfiles',
  'browser:session:createProfile',
  'browser:session:deleteProfile',
  'browser:session:importCookies',
  'browser:session:resolvePartition',
  'browser:session:clearDefaultCookies',
  'browser:session:detectBrowsers',
  'browser:session:importFromBrowser',
  'browser:identity:get',
  'browser:identity:set',
  'browser:settings:get',
  'browser:settings:set'
] as const
