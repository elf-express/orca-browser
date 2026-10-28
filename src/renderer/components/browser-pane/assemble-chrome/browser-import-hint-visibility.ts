export type BrowserImportHintVisibilityInput = {
  settingsLoaded: boolean
  browserImportHintHidden: boolean
}

export function shouldShowBrowserImportHint({
  settingsLoaded,
  browserImportHintHidden
}: BrowserImportHintVisibilityInput): boolean {
  // Why: keep import one click away so users can re-import cookies without
  // hunting through Settings or the toolbar overflow menu.
  return settingsLoaded && !browserImportHintHidden
}
