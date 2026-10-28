import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLEAN_USER_AGENT,
  configureRegistry,
  createFsState,
  installModuleMocks,
  META_PATH,
  seedMeta
} from './__mocks__/browser-session-registry-persistence-fixture'

describe('BrowserSessionRegistry persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('migrates and consumes legacy pendingCookieDbPath into default partition replay', async () => {
    const fsState = createFsState()
    seedMeta(fsState, {
      defaultSource: null,
      userAgent: null,
      pendingCookieDbPath: '/staged/legacy',
      profiles: []
    })
    fsState.present.add('/staged/legacy')

    installModuleMocks(fsState)
    const { browserSessionRegistry } = await import('./browser-session-registry')
    await configureRegistry(browserSessionRegistry)

    browserSessionRegistry.applyPendingCookieImport()

    const written = JSON.parse(fsState.files.get(META_PATH) ?? '{}')
    expect(written.pendingCookieDbPath).toBeNull()
    expect(written.pendingCookieImports).toEqual({})
    expect(fsState.present.has('/user-data/Partitions/orca-browser/Cookies')).toBe(true)
  })

  it('replays pending cookies into an existing Network database', async () => {
    const stagedPath = '/staged/network-import'
    const networkPath = '/user-data/Partitions/orca-browser/Network/Cookies'
    const legacyPath = '/user-data/Partitions/orca-browser/Cookies'
    const fsState = createFsState()
    seedMeta(fsState, {
      defaultSource: null,
      userAgent: null,
      pendingCookieDbPath: stagedPath,
      profiles: []
    })
    fsState.files.set(stagedPath, 'imported cookies')
    fsState.files.set(networkPath, 'old cookies')
    fsState.present.add(stagedPath)
    fsState.present.add(networkPath)

    installModuleMocks(fsState)
    const { browserSessionRegistry } = await import('./browser-session-registry')
    await configureRegistry(browserSessionRegistry)

    browserSessionRegistry.applyPendingCookieImport()

    expect(fsState.files.get(networkPath)).toBe('imported cookies')
    expect(fsState.present.has(legacyPath)).toBe(false)
  })

  it('applies the process identity and request exceptions to new profiles', async () => {
    const fsState = createFsState()
    const { sessionFromPartitionMock, installBrowserSessionUserAgentPolicyMock } =
      installModuleMocks(fsState)
    const { browserSessionRegistry } = await import('./browser-session-registry')
    await configureRegistry(browserSessionRegistry)

    await browserSessionRegistry.createProfile('isolated', 'Default identity')

    const profileSession = sessionFromPartitionMock.mock.results.at(-1)?.value
    expect(profileSession.setUserAgent).toHaveBeenCalledWith(CLEAN_USER_AGENT)
    expect(installBrowserSessionUserAgentPolicyMock).toHaveBeenCalledWith(
      profileSession,
      expect.any(Function)
    )
  })

  it('merges partition-keyed pending entries without clobbering unrelated entries', async () => {
    const fsState = createFsState()
    seedMeta(fsState, {
      defaultSource: null,
      userAgent: null,
      userAgentByPartition: {},
      pendingCookieDbPath: null,
      pendingCookieImports: {},
      profiles: []
    })

    installModuleMocks(fsState)
    const { browserSessionRegistry } = await import('./browser-session-registry')
    await configureRegistry(browserSessionRegistry)

    browserSessionRegistry.setPendingCookieImport('persist:orca-browser', '/staged/default')
    browserSessionRegistry.setPendingCookieImport(
      'persist:orca-browser-session-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '/staged/imported'
    )

    const written = JSON.parse(fsState.files.get(META_PATH) ?? '{}')
    expect(written.pendingCookieDbPath).toBeNull()
    expect(written.pendingCookieImports).toEqual({
      'persist:orca-browser': { format: 'scoped-v1', path: '/staged/default' },
      'persist:orca-browser-session-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': {
        format: 'scoped-v1',
        path: '/staged/imported'
      }
    })
  })

  it('clears only the requested partition and unlinks its staged database files', async () => {
    const otherPartition = 'persist:orca-browser-session-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const fsState = createFsState()
    seedMeta(fsState, {
      defaultSource: null,
      userAgent: null,
      userAgentByPartition: {},
      pendingCookieDbPath: '/staged/default',
      pendingCookieImports: {
        'persist:orca-browser': '/staged/default',
        [otherPartition]: '/staged/other'
      },
      profiles: []
    })
    for (const suffix of ['', '-wal', '-shm']) {
      fsState.files.set(`/staged/other${suffix}`, 'db')
      fsState.present.add(`/staged/other${suffix}`)
      fsState.files.set(`/staged/default${suffix}`, 'db')
      fsState.present.add(`/staged/default${suffix}`)
    }

    installModuleMocks(fsState)
    const { browserSessionRegistry } = await import('./browser-session-registry')
    await configureRegistry(browserSessionRegistry)

    browserSessionRegistry.clearPendingCookieImport(otherPartition)

    const written = JSON.parse(fsState.files.get(META_PATH) ?? '{}')
    expect(written.pendingCookieImports).toEqual({ 'persist:orca-browser': '/staged/default' })
    // Why: the default partition still has a staged replay, so the legacy pointer must survive.
    expect(written.pendingCookieDbPath).toBe('/staged/default')
    for (const suffix of ['', '-wal', '-shm']) {
      expect(fsState.present.has(`/staged/other${suffix}`)).toBe(false)
      expect(fsState.present.has(`/staged/default${suffix}`)).toBe(true)
    }
  })

  it('drops the legacy pointer when the default partition is the one cleared', async () => {
    const otherPartition = 'persist:orca-browser-session-cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const fsState = createFsState()
    seedMeta(fsState, {
      defaultSource: null,
      userAgent: null,
      userAgentByPartition: {},
      pendingCookieDbPath: '/staged/default',
      pendingCookieImports: {
        'persist:orca-browser': '/staged/default',
        [otherPartition]: '/staged/other'
      },
      profiles: []
    })

    installModuleMocks(fsState)
    const { browserSessionRegistry } = await import('./browser-session-registry')
    await configureRegistry(browserSessionRegistry)

    browserSessionRegistry.clearPendingCookieImport('persist:orca-browser')

    const written = JSON.parse(fsState.files.get(META_PATH) ?? '{}')
    expect(written.pendingCookieImports).toEqual({ [otherPartition]: '/staged/other' })
    expect(written.pendingCookieDbPath).toBeNull()
  })

  it('is a no-op when the partition has no pending import', async () => {
    const fsState = createFsState()
    seedMeta(fsState, {
      defaultSource: null,
      userAgent: null,
      userAgentByPartition: {},
      pendingCookieDbPath: '/staged/default',
      pendingCookieImports: { 'persist:orca-browser': '/staged/default' },
      profiles: []
    })
    fsState.files.set('/staged/default', 'db')
    fsState.present.add('/staged/default')

    installModuleMocks(fsState)
    const { browserSessionRegistry } = await import('./browser-session-registry')
    await configureRegistry(browserSessionRegistry)
    const metaBefore = fsState.files.get(META_PATH)

    browserSessionRegistry.clearPendingCookieImport('persist:orca-browser-session-unknown')

    // Why: an absent key must not rewrite meta or touch another partition's staged file.
    expect(fsState.files.get(META_PATH)).toBe(metaBefore)
    expect(fsState.present.has('/staged/default')).toBe(true)
  })

  it('keeps failed partition replay pending and removes unrelated missing entries', async () => {
    const importedPartition = 'persist:orca-browser-session-22222222-2222-4222-8222-222222222222'
    const fsState = createFsState()
    seedMeta(fsState, {
      defaultSource: null,
      userAgent: null,
      userAgentByPartition: {},
      pendingCookieDbPath: null,
      pendingCookieImports: {
        [importedPartition]: '/staged/imported',
        'persist:orca-browser': '/staged/missing'
      },
      profiles: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          scope: 'imported',
          partition: importedPartition,
          label: 'Imported',
          source: { browserFamily: 'comet', importedAt: 1 }
        }
      ]
    })
    fsState.present.add('/staged/imported')

    installModuleMocks(fsState, new Set(['/staged/imported']))
    const { browserSessionRegistry } = await import('./browser-session-registry')
    await configureRegistry(browserSessionRegistry)

    browserSessionRegistry.applyPendingCookieImport()

    const written = JSON.parse(fsState.files.get(META_PATH) ?? '{}')
    expect(written.pendingCookieImports).toEqual({ [importedPartition]: '/staged/imported' })
    expect(written.pendingCookieDbPath).toBeNull()
  })

  it('ignores pending cookie imports for invalid persisted profile partitions', async () => {
    const invalidPartition = 'persist:../../outside'
    const fsState = createFsState()
    seedMeta(fsState, {
      defaultSource: null,
      userAgent: null,
      userAgentByPartition: {},
      pendingCookieDbPath: null,
      pendingCookieImports: {
        [invalidPartition]: '/staged/evil'
      },
      profiles: [
        {
          id: 'profile-1',
          scope: 'imported',
          partition: invalidPartition,
          label: 'Invalid',
          source: null
        }
      ]
    })
    fsState.present.add('/staged/evil')

    installModuleMocks(fsState)
    const { browserSessionRegistry } = await import('./browser-session-registry')
    await configureRegistry(browserSessionRegistry)

    browserSessionRegistry.applyPendingCookieImport()

    const written = JSON.parse(fsState.files.get(META_PATH) ?? '{}')
    expect(written.pendingCookieImports).toEqual({})
    expect(fsState.present.has('/outside/Cookies')).toBe(false)
  })
})
