import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionFromPartitionMock } = vi.hoisted(() => ({
  sessionFromPartitionMock: vi.fn()
}))
const processUserAgentMode = vi.hoisted(() => {
  const state: { value: 'clean' | 'native' } = { value: 'clean' }
  return state
})
const CLEAN_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.224 Safari/537.36'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/user-data') },
  session: {
    fromPartition: sessionFromPartitionMock
  }
}))

vi.mock('./browser-process-user-agent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./browser-process-user-agent')>()),
  getBrowserProcessUserAgentIdentity: () => ({
    mode: processUserAgentMode.value,
    userAgent: 'Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36'
  })
}))

vi.mock('./browser-manager', () => ({
  browserManager: {
    resolveBrowserGuestRequestUserAgent: vi.fn()
  }
}))

import { browserSessionRegistry } from './browser-session-registry'
import {
  initializeBrowserIdentityModeStore,
  resetBrowserIdentityModeStoreForTests
} from './browser-identity-mode-store'
import { googleAuthUserAgent } from './browser-google-auth-ua'
import { installBrowserSessionUserAgentPolicy } from './browser-session-ua'
import { ORCA_BROWSER_PARTITION } from '../../shared/constants'

let tmpUserData = ''

describe('BrowserSessionRegistry', () => {
  beforeEach(() => {
    sessionFromPartitionMock.mockReset()
    processUserAgentMode.value = 'clean'
    tmpUserData = mkdtempSync(join(tmpdir(), 'orca-browser-registry-'))
    browserSessionRegistry.configure({ userDataDir: tmpUserData })
    resetBrowserIdentityModeStoreForTests()
    initializeBrowserIdentityModeStore(join(tmpUserData, 'orca-browser'))
    sessionFromPartitionMock.mockReturnValue({
      setUserAgent: vi.fn(),
      getUserAgent: vi.fn(() => CLEAN_USER_AGENT),
      webRequest: { onBeforeSendHeaders: vi.fn() },
      on: vi.fn(),
      removeListener: vi.fn(),
      clearStorageData: vi.fn().mockResolvedValue(undefined),
      clearCache: vi.fn().mockResolvedValue(undefined)
    })
  })

  it('has a default profile on construction', () => {
    const defaultProfile = browserSessionRegistry.getDefaultProfile()
    expect(defaultProfile.id).toBe('default')
    expect(defaultProfile.scope).toBe('default')
    expect(defaultProfile.partition).toBe(ORCA_BROWSER_PARTITION)
  })

  it('allows the default partition', () => {
    expect(browserSessionRegistry.isAllowedPartition(ORCA_BROWSER_PARTITION)).toBe(true)
  })

  it('rejects unknown partitions', () => {
    expect(browserSessionRegistry.isAllowedPartition('persist:evil-partition')).toBe(false)
  })

  it('creates an isolated profile with a unique partition', async () => {
    const profile = await browserSessionRegistry.createProfile('isolated', 'Test Isolated')
    expect(profile).not.toBeNull()
    expect(profile!.scope).toBe('isolated')
    expect(profile!.partition).toMatch(/^persist:orca-browser-session-/)
    expect(profile!.partition).not.toBe(ORCA_BROWSER_PARTITION)
    expect(profile!.label).toBe('Test Isolated')
    expect(profile!.source).toBeNull()
  })

  it('rejects creating a profile with scope default', async () => {
    const profile = await browserSessionRegistry.createProfile('default', 'Sneaky')
    expect(profile).toBeNull()
  })

  it('allows created profile partitions', async () => {
    const profile = await browserSessionRegistry.createProfile('isolated', 'Allowed')
    expect(profile).not.toBeNull()
    expect(browserSessionRegistry.isAllowedPartition(profile!.partition)).toBe(true)
  })

  it('creates an imported profile', async () => {
    const profile = await browserSessionRegistry.createProfile('imported', 'My Import')
    expect(profile).not.toBeNull()
    expect(profile!.scope).toBe('imported')
    expect(profile!.partition).toMatch(/^persist:orca-browser-session-/)
  })

  it('resolves partition for a known profile', async () => {
    const profile = await browserSessionRegistry.createProfile('isolated', 'Resolve Test')
    expect(profile).not.toBeNull()
    expect(browserSessionRegistry.resolvePartition(profile!.id)).toBe(profile!.partition)
  })

  it('resolves default partition for null/undefined profileId', () => {
    expect(browserSessionRegistry.resolvePartition(null)).toBe(ORCA_BROWSER_PARTITION)
    expect(browserSessionRegistry.resolvePartition(undefined)).toBe(ORCA_BROWSER_PARTITION)
  })

  it('resolves default partition for unknown profileId', () => {
    expect(browserSessionRegistry.resolvePartition('nonexistent')).toBe(ORCA_BROWSER_PARTITION)
  })

  it('strictly resolves known profile partitions without downgrading unknown profiles', async () => {
    const profile = await browserSessionRegistry.createProfile('isolated', 'Strict Resolve')
    expect(profile).not.toBeNull()

    expect(browserSessionRegistry.resolveKnownPartition(null)).toBe(ORCA_BROWSER_PARTITION)
    expect(browserSessionRegistry.resolveKnownPartition(undefined)).toBe(ORCA_BROWSER_PARTITION)
    expect(browserSessionRegistry.resolveKnownPartition('default')).toBe(ORCA_BROWSER_PARTITION)
    expect(browserSessionRegistry.resolveKnownPartition(profile!.id)).toBe(profile!.partition)
    expect(browserSessionRegistry.resolveKnownPartition('missing-profile')).toBeNull()
  })

  it('lists all profiles', async () => {
    const before = browserSessionRegistry.listProfiles().length
    await browserSessionRegistry.createProfile('isolated', 'List Test')
    const after = browserSessionRegistry.listProfiles()
    expect(after.length).toBe(before + 1)
  })

  it('updates profile source', async () => {
    const profile = await browserSessionRegistry.createProfile('imported', 'Source Test')
    expect(profile).not.toBeNull()
    const updated = browserSessionRegistry.updateProfileSource(profile!.id, {
      browserFamily: 'edge',
      importedAt: Date.now()
    })
    expect(updated).not.toBeNull()
    expect(updated!.source?.browserFamily).toBe('edge')
  })

  it('updates profile source with comet family', async () => {
    const profile = await browserSessionRegistry.createProfile('imported', 'Comet Source Test')
    expect(profile).not.toBeNull()
    const updated = browserSessionRegistry.updateProfileSource(profile!.id, {
      browserFamily: 'comet',
      importedAt: Date.now()
    })
    expect(updated).not.toBeNull()
    expect(updated!.source?.browserFamily).toBe('comet')
  })

  it('deletes a non-default profile', async () => {
    const profile = await browserSessionRegistry.createProfile('isolated', 'Delete Test')
    expect(profile).not.toBeNull()
    expect(browserSessionRegistry.isAllowedPartition(profile!.partition)).toBe(true)
    const deleted = await browserSessionRegistry.deleteProfile(profile!.id)
    expect(deleted).toBe(true)
    expect(browserSessionRegistry.isAllowedPartition(profile!.partition)).toBe(false)
    expect(browserSessionRegistry.getProfile(profile!.id)).toBeNull()
  })

  // Why: the Electron Session outlives its partition, so a deleted profile must not keep a header hook.
  it('retires the user agent policy when deleting a profile', async () => {
    const profile = await browserSessionRegistry.createProfile('isolated', 'UA Delete Test')
    const mockSession = sessionFromPartitionMock.mock.results[0]?.value
    expect(mockSession.webRequest.onBeforeSendHeaders).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function)
    )

    await expect(browserSessionRegistry.deleteProfile(profile!.id)).resolves.toBe(true)

    expect(mockSession.webRequest.onBeforeSendHeaders).toHaveBeenLastCalledWith(null)
  })

  it('refuses to delete the default profile', async () => {
    const deleted = await browserSessionRegistry.deleteProfile('default')
    expect(deleted).toBe(false)
    expect(browserSessionRegistry.getDefaultProfile()).not.toBeNull()
  })

  it('hydrates profiles from persisted data', () => {
    const fakeProfile = {
      id: '00000000-0000-0000-0000-000000000001',
      scope: 'imported' as const,
      partition: 'persist:orca-browser-session-00000000-0000-0000-0000-000000000001',
      label: 'Hydrated',
      source: { browserFamily: 'manual' as const, importedAt: 1000 }
    }
    browserSessionRegistry.hydrateFromPersisted([fakeProfile])
    expect(browserSessionRegistry.getProfile('00000000-0000-0000-0000-000000000001')).not.toBeNull()
    expect(browserSessionRegistry.isAllowedPartition(fakeProfile.partition)).toBe(true)
  })

  it('rejects a persisted profile whose partition belongs to a different profile id', () => {
    const profileId = '00000000-0000-4000-8000-000000000021'
    const claimedPartition = 'persist:orca-browser-session-00000000-0000-4000-8000-000000000022'

    browserSessionRegistry.hydrateFromPersisted([
      {
        id: profileId,
        scope: 'isolated',
        partition: claimedPartition,
        label: 'Conflicting identity',
        source: null
      }
    ])

    expect(browserSessionRegistry.getProfile(profileId)).toBeNull()
    expect(browserSessionRegistry.isAllowedPartition(claimedPartition)).toBe(false)
  })

  it('sets up session policies for new partitions', async () => {
    await browserSessionRegistry.createProfile('isolated', 'Policy Test')
    expect(sessionFromPartitionMock).toHaveBeenCalled()
    const mockSession = sessionFromPartitionMock.mock.results[0]?.value
    expect(mockSession?.setUserAgent).toHaveBeenCalledWith(CLEAN_USER_AGENT)
    expect(mockSession?.webRequest.onBeforeSendHeaders).toHaveBeenCalled()
  })

  it('rolls back a new profile when its session policy cannot be installed', async () => {
    sessionFromPartitionMock.mockReturnValue({
      setUserAgent: vi.fn(() => {
        throw new Error('policy failed')
      }),
      getUserAgent: vi.fn(() => CLEAN_USER_AGENT),
      webRequest: { onBeforeSendHeaders: vi.fn() },
      on: vi.fn(),
      removeListener: vi.fn(),
      clearStorageData: vi.fn().mockResolvedValue(undefined),
      clearCache: vi.fn().mockResolvedValue(undefined)
    })
    const before = browserSessionRegistry.listProfiles().length

    await expect(browserSessionRegistry.createProfile('isolated', 'Broken')).rejects.toThrow(
      'policy failed'
    )

    expect(browserSessionRegistry.listProfiles()).toHaveLength(before)
  })

  it("createProfile('isolated', 'Work') returns partition persist:orca-browser-session-<id>", async () => {
    const profile = await browserSessionRegistry.createProfile('isolated', 'Work')
    expect(profile).not.toBeNull()
    expect(profile!.partition).toBe(`persist:orca-browser-session-${profile!.id}`)
    expect(profile!.scope).toBe('isolated')
    expect(profile!.source).toBeNull()
  })

  it('default profile uses persist:orca-browser', () => {
    expect(browserSessionRegistry.getDefaultProfile().partition).toBe('persist:orca-browser')
  })

  it('createProfile rejects scope default', async () => {
    expect(await browserSessionRegistry.createProfile('default' as never, 'x')).toBeNull()
  })

  it('deleteProfile removes partition from allowlist', async () => {
    const profile = await browserSessionRegistry.createProfile('isolated', 'Allowlist')
    expect(browserSessionRegistry.isAllowedPartition(profile!.partition)).toBe(true)

    expect(await browserSessionRegistry.deleteProfile(profile!.id)).toBe(true)

    expect(browserSessionRegistry.isAllowedPartition(profile!.partition)).toBe(false)
    expect(await browserSessionRegistry.deleteProfile('default')).toBe(false)
  })

  it('persists profiles under <userDataDir>/orca-browser/browser-session-meta.json', async () => {
    const profile = await browserSessionRegistry.createProfile('isolated', 'Persisted')
    const metaPath = join(tmpUserData, 'orca-browser', 'browser-session-meta.json')

    expect(existsSync(metaPath)).toBe(true)
    expect(JSON.parse(readFileSync(metaPath, 'utf8')).profiles[0]).toMatchObject({
      id: profile!.id,
      partition: profile!.partition,
      label: 'Persisted'
    })

    // A rebuilt registry reads the same file back.
    vi.resetModules()
    const rebuilt = await import('./browser-session-registry')
    const rebuiltIdentity = await import('./browser-identity-mode-store')
    rebuiltIdentity.initializeBrowserIdentityModeStore(join(tmpUserData, 'orca-browser'))
    rebuilt.browserSessionRegistry.configure({ userDataDir: tmpUserData })
    rebuilt.browserSessionRegistry.initializeBrowserSessionsFromPersistedState()
    expect(rebuilt.browserSessionRegistry.listProfiles().map((p) => p.id)).toContain(profile!.id)
  })

  describe('installBrowserSessionUserAgentPolicy', () => {
    function install(): (details: unknown, callback: ReturnType<typeof vi.fn>) => void {
      const onBeforeSendHeaders = vi.fn()
      installBrowserSessionUserAgentPolicy(
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook reads only the mocked webRequest member exercised here.
        { webRequest: { onBeforeSendHeaders } } as never,
        (request) =>
          request.currentUserAgent === googleAuthUserAgent()
            ? { kind: 'google-auth', userAgent: googleAuthUserAgent() }
            : undefined
      )
      expect(onBeforeSendHeaders).toHaveBeenCalledWith(
        { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
        expect.any(Function)
      )
      return onBeforeSendHeaders.mock.calls[0][1]
    }

    it('leaves ordinary-host identity headers untouched', () => {
      const callback = vi.fn()
      install()(
        {
          url: 'https://example.com/',
          requestHeaders: {
            'User-Agent': 'Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36',
            'sec-ch-ua': 'browser-owned',
            Cookie: 'abc=123'
          }
        },
        callback
      )

      expect(callback.mock.calls[0][0].requestHeaders).toEqual({
        'User-Agent': 'Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36',
        'sec-ch-ua': 'browser-owned',
        Cookie: 'abc=123'
      })
    })

    it('presents a Firefox UA and strips client hints on Google auth hosts', () => {
      const callback = vi.fn()
      install()(
        {
          url: 'https://accounts.google.com/v3/signin/identifier',
          requestHeaders: {
            'User-Agent': 'Chrome/147',
            'sec-ch-ua': 'old',
            'SEC-CH-UA-Full-Version-List': 'old',
            'sec-ch-ua-platform': '"macOS"',
            Accept: 'text/html'
          }
        },
        callback
      )
      const modified = callback.mock.calls[0][0].requestHeaders
      expect(modified['User-Agent']).toMatch(/Firefox\/\d/)
      expect(modified['User-Agent']).not.toContain('Chrome')
      expect(Object.keys(modified).some((key) => key.toLowerCase().startsWith('sec-ch-ua'))).toBe(
        false
      )
      expect(modified.Accept).toBe('text/html')
    })

    it('keeps native requests untouched on Google auth hosts', () => {
      processUserAgentMode.value = 'native'
      const callback = vi.fn()
      install()(
        {
          url: 'https://accounts.google.com/v3/signin/identifier',
          requestHeaders: {
            'User-Agent': 'NativeElectron/43.0',
            'sec-ch-ua': 'browser-owned'
          }
        },
        callback
      )
      expect(callback.mock.calls[0][0].requestHeaders).toEqual({
        'User-Agent': 'NativeElectron/43.0',
        'sec-ch-ua': 'browser-owned'
      })
    })

    it('strips client hints on a cross-host request that carries the Firefox auth UA', () => {
      const callback = vi.fn()
      install()(
        {
          url: 'https://play.google.com/log',
          requestHeaders: {
            'User-Agent': googleAuthUserAgent(),
            'sec-ch-ua': 'old',
            'sec-ch-ua-full-version-list': 'old',
            'sec-ch-ua-platform': '"macOS"',
            'sec-ch-ua-mobile': '?0'
          }
        },
        callback
      )
      const modified = callback.mock.calls[0][0].requestHeaders
      // UA stays Firefox and every client hint is dropped — one consistent identity.
      expect(modified['User-Agent']).toBe(googleAuthUserAgent())
      expect(modified['sec-ch-ua']).toBeUndefined()
      expect(modified['sec-ch-ua-full-version-list']).toBeUndefined()
      expect(modified['sec-ch-ua-platform']).toBeUndefined()
      expect(modified['sec-ch-ua-mobile']).toBeUndefined()
    })

    it('keeps the session identity on Google app subdomains', () => {
      const callback = vi.fn()
      install()(
        {
          url: 'https://myaccount.google.com/',
          requestHeaders: { 'User-Agent': 'Chrome/150', 'sec-ch-ua': 'browser-owned' }
        },
        callback
      )
      expect(callback.mock.calls[0][0].requestHeaders).toEqual({
        'User-Agent': 'Chrome/150',
        'sec-ch-ua': 'browser-owned'
      })
    })
  })
})
