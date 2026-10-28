import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BROWSER_PLUGIN_SETTINGS,
  normalizeBrowserPluginSettings
} from './browser-plugin-settings'

describe('normalizeBrowserPluginSettings', () => {
  it('returns defaults for non-object input', () => {
    expect(normalizeBrowserPluginSettings(null)).toEqual({
      searchEngine: 'google',
      importHintHidden: false
    })
    expect(normalizeBrowserPluginSettings('bing')).toEqual(DEFAULT_BROWSER_PLUGIN_SETTINGS)
    expect(normalizeBrowserPluginSettings(42)).toEqual(DEFAULT_BROWSER_PLUGIN_SETTINGS)
  })

  it('falls back to google for an unknown search engine', () => {
    expect(normalizeBrowserPluginSettings({ searchEngine: 'yahoo' }).searchEngine).toBe('google')
  })

  it('falls back to false for a non-boolean importHintHidden', () => {
    expect(normalizeBrowserPluginSettings({ importHintHidden: 'yes' }).importHintHidden).toBe(false)
  })

  it('keeps valid values as-is', () => {
    expect(
      normalizeBrowserPluginSettings({ searchEngine: 'bing', importHintHidden: true })
    ).toEqual({
      searchEngine: 'bing',
      importHintHidden: true
    })
  })

  it('does not return the shared defaults object', () => {
    expect(normalizeBrowserPluginSettings(null)).not.toBe(DEFAULT_BROWSER_PLUGIN_SETTINGS)
  })
})
