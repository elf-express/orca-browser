import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  normalizeBrowserPluginSettings,
  type BrowserPluginSettings
} from '../../shared/browser-plugin-settings'
import { durableWriteTempPath, writeFileDurableSync } from '../durable-file-write'

function settingsFilePath(userDataDir: string): string {
  return join(userDataDir, 'orca-browser', 'settings.json')
}

/** Reads the plugin settings; a missing or corrupt file yields the defaults. */
export function loadBrowserPluginSettings(userDataDir: string): BrowserPluginSettings {
  try {
    return normalizeBrowserPluginSettings(
      JSON.parse(readFileSync(settingsFilePath(userDataDir), 'utf8'))
    )
  } catch {
    return normalizeBrowserPluginSettings(null)
  }
}

/** Merges a patch into the stored settings, persists the result and returns it. */
export function saveBrowserPluginSettings(
  userDataDir: string,
  patch: Partial<BrowserPluginSettings>
): BrowserPluginSettings {
  const next = normalizeBrowserPluginSettings({
    ...loadBrowserPluginSettings(userDataDir),
    ...patch
  })
  const filePath = settingsFilePath(userDataDir)
  mkdirSync(join(userDataDir, 'orca-browser'), { recursive: true })
  writeFileDurableSync(
    durableWriteTempPath(filePath),
    filePath,
    `${JSON.stringify(next, null, 2)}\n`
  )
  return next
}
