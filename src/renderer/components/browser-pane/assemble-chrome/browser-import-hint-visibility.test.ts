import { describe, expect, it } from 'vitest'
import { shouldShowBrowserImportHint } from './browser-import-hint-visibility'

describe('shouldShowBrowserImportHint', () => {
  it('shows after settings load', () => {
    expect(
      shouldShowBrowserImportHint({
        settingsLoaded: true,
        browserImportHintHidden: false
      })
    ).toBe(true)
  })

  it('stays hidden until settings load', () => {
    expect(
      shouldShowBrowserImportHint({
        settingsLoaded: false,
        browserImportHintHidden: false
      })
    ).toBe(false)
  })

  it('honors explicit hint dismissal', () => {
    expect(
      shouldShowBrowserImportHint({
        settingsLoaded: true,
        browserImportHintHidden: true
      })
    ).toBe(false)
  })
})
