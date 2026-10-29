export type BrowserLoadError = {
  code: number
  description: string
  validatedUrl: string
}

export type BrowserCertificateFailure = {
  challengeId: string
  browserPageId: string
  errorCode: number | null
  error: string
  origin: string
  displayHost: string
  canProceed: boolean
  observedAt: number
}

export type BrowserPage = {
  id: string
  scopeId: string
  url: string
  title: string
  loading: boolean
  faviconUrl: string | null
  canGoBack: boolean
  canGoForward: boolean
  loadError: BrowserLoadError | null
  createdAt: number
  sessionProfileId: string | null
  sessionPartition: string | null
  viewportPresetId: BrowserViewportPresetId | null
}

// Why: BrowserPage persists the active viewport preset so CDP emulation can be
// reapplied on reload/navigation without the user re-picking from the toolbar.
export type BrowserViewportPresetId =
  | 'mobile-s'
  | 'mobile-m'
  | 'mobile-l'
  | 'tablet'
  | 'laptop'
  | 'laptop-l'
  | 'desktop'

export type BrowserViewportOverride = {
  width: number
  height: number
  deviceScaleFactor: number
  mobile: boolean
}

export type BrowserViewportScrollState = {
  scrollLeft: number
  scrollTop: number
  maxScrollLeft: number
  maxScrollTop: number
}

export type BrowserHistoryEntry = {
  url: string
  normalizedUrl: string
  title: string
  faviconUrl?: string | null
  lastVisitedAt: number
  visitCount: number
}

export type BrowserSessionProfileSource = {
  browserFamily:
    | 'chrome'
    | 'chromium'
    | 'arc'
    | 'edge'
    | 'firefox'
    | 'safari'
    | 'comet'
    | 'helium'
    | 'manual'
  profileName?: string
  importedAt: number
}

export type BrowserCookieImportSummary = {
  totalCookies: number
  importedCookies: number
  skippedCookies: number
  googleCookiesSkipped?: number
  // Why (STA-4300): cookies whose source partition identity could not be read faithfully are
  // skipped rather than written unpartitioned, and a skip is only honest if it is reported.
  partitionSkippedCookies?: number
  domains: string[]
  warning?:
    | {
        code: 'restart-fallback-unavailable'
        loadedCookies: number
        failedCookies: number
      }
    | {
        // Why: a row that will not decrypt is indistinguishable from a corrupt one by the time
        // decrypt returns null, so the cause is captured at the point of failure and reported
        // here. Without this an undecryptable profile is reported as a successful empty import.
        code: 'cookies-undecryptable'
        failedCookies: number
        otherFailedCookies?: number
        reason: 'app-bound-encryption' | 'linux-keyring-unavailable' | 'unknown'
      }
}

export type BrowserSessionProfileScope = 'default' | 'isolated' | 'imported'

export type BrowserSessionProfile = {
  id: string
  scope: BrowserSessionProfileScope
  partition: string
  label: string
  source: BrowserSessionProfileSource | null
}

export type BrowserCookieImportResult =
  | { ok: true; profileId: string; summary: BrowserCookieImportSummary }
  | { ok: false; reason: string }
