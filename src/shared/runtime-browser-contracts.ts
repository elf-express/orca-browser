import type { BrowserCertificateFailure, BrowserLoadError } from './browser-workspace-types'

export type BrowserSnapshotRef = { ref: string; role: string; name: string }

export type BrowserSnapshotResult = {
  browserPageId: string
  snapshot: string
  refs: BrowserSnapshotRef[]
  url: string
  title: string
}

export type BrowserClickResult = { clicked: string }
export type BrowserGotoResult = { url: string; title: string }
export type BrowserFillResult = { filled: string }
export type BrowserTypeResult = { typed: boolean }
export type BrowserSelectResult = { selected: string }
export type BrowserScrollResult = { scrolled: 'up' | 'down' }
export type BrowserBackResult = { url: string; title: string }
export type BrowserReloadResult = { url: string; title: string }
export type BrowserScreenshotResult = { data: string; format: 'png' | 'jpeg' }

export type BrowserEvalResult = { result: string; origin: string }

export type BrowserTabInfo = {
  browserPageId: string
  index: number
  url: string
  title: string
  active: boolean
  loadError?: BrowserLoadError | null
  certificateFailure?: BrowserCertificateFailure | null
  worktreeId?: string | null
  profileId?: string | null
  profileLabel?: string | null
}

export type BrowserTabListResult = { tabs: BrowserTabInfo[] }
export type BrowserTabSwitchResult = { switched: number; browserPageId: string }

export type BrowserHoverResult = { hovered: string }
export type BrowserDragResult = { dragged: { from: string; to: string } }
export type BrowserUploadResult = { uploaded: number }
export type BrowserWaitResult = { waited: boolean }
export type BrowserCheckResult = { checked: boolean }
export type BrowserFocusResult = { focused: string }
export type BrowserClearResult = { cleared: string }
export type BrowserSelectAllResult = { selected: string }
export type BrowserKeypressResult = { pressed: string }
export type BrowserPdfResult = { data: string }

export type BrowserCookie = {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: string
}

export type BrowserCookieGetResult = { cookies: BrowserCookie[] }
export type BrowserCookieSetResult = { success: boolean }
export type BrowserCookieDeleteResult = { deleted: boolean }

export type BrowserViewportResult = {
  width: number
  height: number
  deviceScaleFactor: number
  mobile: boolean
}

export type BrowserGeolocationResult = {
  latitude: number
  longitude: number
  accuracy: number
}

export type BrowserInterceptEnableResult = { enabled: boolean; patterns: string[] }
export type BrowserInterceptDisableResult = { disabled: boolean }

export type BrowserConsoleEntry = {
  level: string
  text: string
  timestamp: number
  url?: string
  line?: number
}

export type BrowserConsoleResult = { entries: BrowserConsoleEntry[]; truncated: boolean }

export type BrowserNetworkEntry = {
  url: string
  method: string
  status: number
  mimeType: string
  size: number
  timestamp: number
}

export type BrowserNetworkLogResult = { entries: BrowserNetworkEntry[]; truncated: boolean }
export type BrowserCaptureStartResult = { capturing: boolean }
export type BrowserCaptureStopResult = { stopped: boolean }
