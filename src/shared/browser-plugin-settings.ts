import { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINE_LABELS, type SearchEngine } from './browser-url'

export { DEFAULT_SEARCH_ENGINE, SEARCH_ENGINE_LABELS }
export type { SearchEngine }

export type BrowserPluginSettings = {
  searchEngine: SearchEngine
  importHintHidden: boolean
}

export const DEFAULT_BROWSER_PLUGIN_SETTINGS: BrowserPluginSettings = {
  searchEngine: DEFAULT_SEARCH_ENGINE,
  importHintHidden: false
}

const SEARCH_ENGINES: readonly SearchEngine[] = ['google', 'duckduckgo', 'bing', 'kagi']

/** Coerces untrusted persisted or IPC input into a complete, valid settings object. */
export function normalizeBrowserPluginSettings(raw: unknown): BrowserPluginSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_BROWSER_PLUGIN_SETTINGS }
  }
  const { searchEngine, importHintHidden } = raw as Record<string, unknown>
  return {
    searchEngine: SEARCH_ENGINES.includes(searchEngine as SearchEngine)
      ? (searchEngine as SearchEngine)
      : DEFAULT_SEARCH_ENGINE,
    importHintHidden: typeof importHintHidden === 'boolean' ? importHintHidden : false
  }
}
