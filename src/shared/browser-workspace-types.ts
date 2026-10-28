export type BrowserLoadError = {
  code: number
  description: string
  validatedUrl: string
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
}

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
