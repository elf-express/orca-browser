export type BrowserPagePaintabilityState = {
  isActive: boolean
}

export function isBrowserPagePanePaintable({ isActive }: BrowserPagePaintabilityState): boolean {
  return isActive
}
