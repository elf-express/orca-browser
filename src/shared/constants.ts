export const DEFAULT_MCP_PORT = 47821
export const BROWSER_API_GLOBAL_KEY = 'browserAPI'
export const PACKAGE_LOG_PREFIX = 'orca-browser:'
export const ORCA_BROWSER_PARTITION = 'persist:orca-browser'
// Inert blank-tab URL shared by main/renderer so the attach policy can allow just this one data URL.
export const ORCA_BROWSER_BLANK_URL = 'data:text/html,'

export const BROWSER_FAMILY_LABELS: Record<string, string> = {
  chrome: 'Google Chrome',
  chromium: 'Chromium',
  comet: 'Comet',
  helium: 'Helium',
  arc: 'Arc',
  edge: 'Microsoft Edge',
  brave: 'Brave',
  firefox: 'Firefox',
  safari: 'Safari',
  manual: 'File'
}
