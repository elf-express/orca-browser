import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  loadBrowserPluginSettings,
  saveBrowserPluginSettings
} from './browser-plugin-settings-store'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'orca-browser-settings-'))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('browser plugin settings store', () => {
  it('returns defaults when no file exists', () => {
    expect(loadBrowserPluginSettings(tmp)).toEqual({
      searchEngine: 'google',
      importHintHidden: false
    })
  })

  it('persists a patch under orca-browser/settings.json', () => {
    const saved = saveBrowserPluginSettings(tmp, { searchEngine: 'duckduckgo' })

    expect(saved.searchEngine).toBe('duckduckgo')
    expect(loadBrowserPluginSettings(tmp).searchEngine).toBe('duckduckgo')
    expect(existsSync(join(tmp, 'orca-browser', 'settings.json'))).toBe(true)
  })

  it('merges patches without losing earlier fields', () => {
    saveBrowserPluginSettings(tmp, { searchEngine: 'kagi' })
    const saved = saveBrowserPluginSettings(tmp, { importHintHidden: true })

    expect(saved).toEqual({ searchEngine: 'kagi', importHintHidden: true })
  })

  it('returns defaults when the file holds invalid JSON', () => {
    mkdirSync(join(tmp, 'orca-browser'), { recursive: true })
    writeFileSync(join(tmp, 'orca-browser', 'settings.json'), '{not json')

    expect(loadBrowserPluginSettings(tmp)).toEqual({
      searchEngine: 'google',
      importHintHidden: false
    })
  })

  it('normalizes an invalid patch value', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- exercising untrusted input
    const saved = saveBrowserPluginSettings(tmp, { searchEngine: 'yahoo' } as never)

    expect(saved.searchEngine).toBe('google')
  })
})
