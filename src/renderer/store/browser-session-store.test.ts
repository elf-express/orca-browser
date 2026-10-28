import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BROWSER_PLUGIN_SETTINGS } from '../../shared/browser-plugin-settings'
import { useBrowserSessionStore } from './browser-session-store'

const defaultProfile = {
  id: 'default',
  scope: 'default' as const,
  partition: 'persist:orca-default',
  label: 'Default',
  source: null
}

const session = {
  listProfiles: vi.fn(),
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  importCookies: vi.fn(),
  importFromBrowser: vi.fn(),
  detectBrowsers: vi.fn(),
  resolvePartition: vi.fn(),
  clearDefaultCookies: vi.fn()
}
const identity = { get: vi.fn(), set: vi.fn() }
const settings = { get: vi.fn(), set: vi.fn() }

function resetStore(): void {
  useBrowserSessionStore.setState({
    browserSessionProfiles: [],
    detectedBrowsers: [],
    detectedBrowsersLoaded: false,
    browserSessionImportState: null,
    settings: { ...DEFAULT_BROWSER_PLUGIN_SETTINGS },
    settingsLoaded: false,
    identity: null
  })
}

beforeEach(() => {
  for (const fn of [
    ...Object.values(session),
    ...Object.values(identity),
    ...Object.values(settings)
  ]) {
    fn.mockReset()
  }
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: { session, identity, settings }
  })
  resetStore()
})

describe('useBrowserSessionStore', () => {
  it('fetches browser profiles through the preload api', async () => {
    session.listProfiles.mockResolvedValueOnce([defaultProfile])

    await useBrowserSessionStore.getState().fetchBrowserSessionProfiles()

    expect(session.listProfiles).toHaveBeenCalledTimes(1)
    expect(useBrowserSessionStore.getState().browserSessionProfiles).toEqual([defaultProfile])
  })

  it('keeps the previous profile list when listing fails', async () => {
    useBrowserSessionStore.setState({ browserSessionProfiles: [defaultProfile] })
    session.listProfiles.mockRejectedValueOnce(new Error('ipc down'))

    await useBrowserSessionStore.getState().fetchBrowserSessionProfiles()

    expect(useBrowserSessionStore.getState().browserSessionProfiles).toEqual([defaultProfile])
  })

  it('creates a profile through the preload api and appends it', async () => {
    const profile = {
      id: 'local-google',
      scope: 'isolated' as const,
      partition: 'persist:local-google',
      label: 'Google',
      source: null
    }
    useBrowserSessionStore.setState({ browserSessionProfiles: [defaultProfile] })
    session.createProfile.mockResolvedValueOnce(profile)

    await expect(
      useBrowserSessionStore.getState().createBrowserSessionProfile('isolated', 'Google')
    ).resolves.toEqual(profile)
    expect(session.createProfile).toHaveBeenCalledWith({ scope: 'isolated', label: 'Google' })
    expect(useBrowserSessionStore.getState().browserSessionProfiles).toEqual([
      defaultProfile,
      profile
    ])
  })

  it('returns null when profile creation throws', async () => {
    session.createProfile.mockRejectedValueOnce(new Error('boom'))

    await expect(
      useBrowserSessionStore.getState().createBrowserSessionProfile('isolated', 'Google')
    ).resolves.toBeNull()
  })

  it('removes a deleted profile from the list', async () => {
    const work = { ...defaultProfile, id: 'p-work', label: 'Work', scope: 'isolated' as const }
    useBrowserSessionStore.setState({ browserSessionProfiles: [defaultProfile, work] })
    session.deleteProfile.mockResolvedValueOnce(true)

    await expect(
      useBrowserSessionStore.getState().deleteBrowserSessionProfile('p-work')
    ).resolves.toBe(true)

    expect(session.deleteProfile).toHaveBeenCalledWith({ profileId: 'p-work' })
    expect(useBrowserSessionStore.getState().browserSessionProfiles).toEqual([defaultProfile])
  })

  it('keeps the profile when deletion is refused', async () => {
    useBrowserSessionStore.setState({ browserSessionProfiles: [defaultProfile] })
    session.deleteProfile.mockResolvedValueOnce(false)

    await expect(
      useBrowserSessionStore.getState().deleteBrowserSessionProfile('default')
    ).resolves.toBe(false)
    expect(useBrowserSessionStore.getState().browserSessionProfiles).toEqual([defaultProfile])
  })

  it('records a successful browser import and refreshes profiles', async () => {
    const summary = { totalCookies: 2, importedCookies: 2, skippedCookies: 0, domains: [] }
    session.importFromBrowser.mockResolvedValueOnce({ ok: true, profileId: 'default', summary })
    session.listProfiles.mockResolvedValueOnce([defaultProfile])

    const result = await useBrowserSessionStore
      .getState()
      .importCookiesFromBrowser('default', 'chrome', 'Default')

    expect(result).toEqual({ ok: true, profileId: 'default', summary })
    expect(session.importFromBrowser).toHaveBeenCalledWith({
      profileId: 'default',
      browserFamily: 'chrome',
      browserProfile: 'Default'
    })
    expect(useBrowserSessionStore.getState().browserSessionImportState).toEqual({
      profileId: 'default',
      status: 'success',
      summary
    })
    expect(session.listProfiles).toHaveBeenCalledTimes(1)
  })

  it('importCookiesFromBrowser failure sets status error', async () => {
    session.importFromBrowser.mockResolvedValueOnce({ ok: false, reason: 'boom' })

    const result = await useBrowserSessionStore
      .getState()
      .importCookiesFromBrowser('default', 'chrome')

    expect(result).toEqual({ ok: false, reason: 'boom' })
    expect(useBrowserSessionStore.getState().browserSessionImportState).toEqual({
      profileId: 'default',
      status: 'error',
      error: 'boom'
    })
  })

  it('turns a thrown browser import into an error result', async () => {
    session.importFromBrowser.mockRejectedValueOnce(new Error('ipc exploded'))

    const result = await useBrowserSessionStore
      .getState()
      .importCookiesFromBrowser('default', 'chrome')

    expect(result).toEqual({ ok: false, reason: 'ipc exploded' })
    expect(useBrowserSessionStore.getState().browserSessionImportState).toEqual({
      profileId: 'default',
      status: 'error',
      error: 'ipc exploded'
    })
  })

  it('clears the import state when a file import is canceled', async () => {
    session.importCookies.mockResolvedValueOnce({ ok: false, reason: 'canceled' })

    const result = await useBrowserSessionStore.getState().importCookiesToProfile('default')

    expect(result).toEqual({ ok: false, reason: 'canceled' })
    expect(useBrowserSessionStore.getState().browserSessionImportState).toBeNull()
  })

  it('probes detected browsers once', async () => {
    session.detectBrowsers.mockResolvedValue([
      { family: 'chrome', label: 'Google Chrome', profiles: [], selectedProfile: 'Default' }
    ])

    await useBrowserSessionStore.getState().fetchDetectedBrowsers()
    await useBrowserSessionStore.getState().fetchDetectedBrowsers()

    expect(session.detectBrowsers).toHaveBeenCalledTimes(1)
    expect(useBrowserSessionStore.getState().detectedBrowsersLoaded).toBe(true)
    expect(useBrowserSessionStore.getState().detectedBrowsers).toHaveLength(1)
  })

  it('marks detection loaded with an empty list when probing fails', async () => {
    session.detectBrowsers.mockRejectedValueOnce(new Error('denied'))

    await useBrowserSessionStore.getState().fetchDetectedBrowsers()

    expect(useBrowserSessionStore.getState().detectedBrowsers).toEqual([])
    expect(useBrowserSessionStore.getState().detectedBrowsersLoaded).toBe(true)
  })

  it('refreshes profiles after clearing the default cookies', async () => {
    session.clearDefaultCookies.mockResolvedValueOnce(true)
    session.listProfiles.mockResolvedValueOnce([defaultProfile])

    await expect(useBrowserSessionStore.getState().clearDefaultSessionCookies()).resolves.toBe(true)

    expect(session.listProfiles).toHaveBeenCalledTimes(1)
  })

  it('loads settings and flags them loaded', async () => {
    settings.get.mockResolvedValueOnce({ searchEngine: 'bing', importHintHidden: true })

    await useBrowserSessionStore.getState().loadSettings()

    expect(useBrowserSessionStore.getState().settings).toEqual({
      searchEngine: 'bing',
      importHintHidden: true
    })
    expect(useBrowserSessionStore.getState().settingsLoaded).toBe(true)
  })

  it('applies a settings patch and adopts the merged result', async () => {
    settings.set.mockResolvedValueOnce({ searchEngine: 'duckduckgo', importHintHidden: false })

    await useBrowserSessionStore.getState().updateSettings({ searchEngine: 'duckduckgo' })

    expect(settings.set).toHaveBeenCalledWith({ searchEngine: 'duckduckgo' })
    expect(useBrowserSessionStore.getState().settings.searchEngine).toBe('duckduckgo')
  })

  it('rolls a settings patch back when persisting fails', async () => {
    settings.set.mockResolvedValueOnce(null)

    await useBrowserSessionStore.getState().updateSettings({ searchEngine: 'bing' })

    expect(useBrowserSessionStore.getState().settings).toEqual(DEFAULT_BROWSER_PLUGIN_SETTINGS)
  })

  it('loads and updates the identity mode', async () => {
    const snapshot = {
      state: 'valid' as const,
      appliedMode: 'clean' as const,
      configuredMode: 'clean' as const,
      explicitSelection: false,
      migrationNoticePending: false,
      restartRequired: false
    }
    identity.get.mockResolvedValueOnce({ identity: snapshot, migrationNotice: null })
    await useBrowserSessionStore.getState().loadIdentity()
    expect(useBrowserSessionStore.getState().identity?.identity.configuredMode).toBe('clean')

    identity.set.mockResolvedValueOnce({
      ok: true,
      identity: { ...snapshot, configuredMode: 'native', restartRequired: true }
    })
    await useBrowserSessionStore.getState().setIdentityMode('native')

    expect(identity.set).toHaveBeenCalledWith('native')
    expect(useBrowserSessionStore.getState().identity?.identity).toMatchObject({
      configuredMode: 'native',
      restartRequired: true
    })
  })
})
