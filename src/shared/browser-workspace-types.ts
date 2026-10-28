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
