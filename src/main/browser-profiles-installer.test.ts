import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
  sessions: new Map<string, Record<string, ReturnType<typeof vi.fn>>>()
}))

function createFakeSession(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    setUserAgent: vi.fn(),
    getUserAgent: vi.fn(() => 'Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36'),
    webRequest: { onBeforeSendHeaders: vi.fn() } as never,
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    setDisplayMediaRequestHandler: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    clearStorageData: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined)
  }
}

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/user-data'),
    isReady: vi.fn(() => true),
    userAgentFallback:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Orca/1.0.0 Chrome/150.0.0.0 Electron/43.0.0 Safari/537.36'
  },
  ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler },
  session: {
    fromPartition: (partition: string) => {
      let fake = mocks.sessions.get(partition)
      if (!fake) {
        fake = createFakeSession()
        mocks.sessions.set(partition, fake)
      }
      return fake
    }
  },
  systemPreferences: {
    askForMediaAccess: vi.fn().mockResolvedValue(true),
    getMediaAccessStatus: vi.fn(() => 'granted')
  },
  dialog: { showOpenDialog: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() },
  webContents: { fromId: vi.fn() }
}))

vi.mock('./browser/browser-manager', () => ({
  browserManager: {
    resolveBrowserGuestRequestUserAgent: vi.fn(),
    notifyPermissionDenied: vi.fn()
  }
}))

import { app } from 'electron'
import { BROWSER_PROFILE_INVOKE_CHANNELS } from '../shared/browser-ipc-channels'
import { ORCA_BROWSER_PARTITION } from '../shared/constants'
import type { ResolvedBrowserPluginOptions } from './plugin-options'

let tmp = ''
let dispose: (() => void | Promise<void>) | void

function makeOptions(userDataDir: string): ResolvedBrowserPluginOptions {
  return {
    host: {
      getMainWindow: () => null,
      userDataDir,
      resourcesPath: '/tmp/resources',
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      openExternal: vi.fn(async () => {})
    },
    mcpPort: 47821
  } as unknown as ResolvedBrowserPluginOptions
}

// Why: session startup is once-per-process, so each test loads a fresh module graph.
async function loadFresh() {
  vi.resetModules()
  const identity = await import('./browser/browser-identity-mode-store')
  const registry = await import('./browser/browser-session-registry')
  const startup = await import('./browser/browser-session-startup')
  const allowlist = await import('./browser/browser-partition-allowlist')
  const initializeIdentity = vi.spyOn(identity, 'initializeBrowserIdentityModeStore')
  const initializeSessions = vi.spyOn(startup, 'initializeBrowserSessionsForApp')
  const configure = vi.spyOn(registry.browserSessionRegistry, 'configure')
  const installer = await import('./browser-profiles-installer')
  return {
    initializeBrowserIdentityModeStore: initializeIdentity,
    initializeBrowserSessionsForApp: initializeSessions,
    configure,
    browserSessionRegistry: registry.browserSessionRegistry,
    isAllowedBrowserPartition: allowlist.isAllowedBrowserPartition,
    installBrowserProfiles: installer.installBrowserProfiles
  }
}

beforeEach(() => {
  mocks.handle.mockReset()
  mocks.removeHandler.mockReset()
  mocks.sessions.clear()
  tmp = mkdtempSync(join(tmpdir(), 'orca-browser-profiles-installer-'))
})

afterEach(async () => {
  await dispose?.()
  dispose = undefined
  rmSync(tmp, { recursive: true, force: true })
})

describe('installBrowserProfiles', () => {
  it('initializes identity mode and sessions under <userDataDir>/orca-browser before registering IPC', async () => {
    const m = await loadFresh()
    const { configure } = m
    dispose = m.installBrowserProfiles(makeOptions(tmp))

    expect(m.initializeBrowserIdentityModeStore).toHaveBeenCalledWith(join(tmp, 'orca-browser'))
    expect(configure).toHaveBeenCalledWith({ userDataDir: tmp })
    expect(m.initializeBrowserSessionsForApp).toHaveBeenCalledWith({ userDataDir: tmp })

    const identityOrder = m.initializeBrowserIdentityModeStore.mock.invocationCallOrder[0]!
    const configureOrder = configure.mock.invocationCallOrder[0]!
    const sessionsOrder = m.initializeBrowserSessionsForApp.mock.invocationCallOrder[0]!
    const firstHandleOrder = mocks.handle.mock.invocationCallOrder[0]!
    expect(identityOrder).toBeLessThan(configureOrder)
    expect(configureOrder).toBeLessThan(sessionsOrder)
    expect(sessionsOrder).toBeLessThan(firstHandleOrder)
  })

  it('installs the permission policy on the default partition', async () => {
    const m = await loadFresh()
    dispose = m.installBrowserProfiles(makeOptions(tmp))

    const defaultSession = mocks.sessions.get(ORCA_BROWSER_PARTITION)
    expect(defaultSession).toBeDefined()
    expect(defaultSession!.setPermissionRequestHandler).toHaveBeenCalledTimes(1)
  })

  it('registers every profile channel', async () => {
    const m = await loadFresh()
    dispose = m.installBrowserProfiles(makeOptions(tmp))

    const channels = mocks.handle.mock.calls.map(([channel]) => channel as string)
    expect([...channels].sort()).toEqual([...BROWSER_PROFILE_INVOKE_CHANNELS].sort())
  })

  it('allows registered profile partitions through the webview allowlist', async () => {
    const m = await loadFresh()
    dispose = m.installBrowserProfiles(makeOptions(tmp))

    const profile = await m.browserSessionRegistry.createProfile('isolated', 'Work')
    expect(profile).not.toBeNull()
    expect(m.isAllowedBrowserPartition(profile!.partition)).toBe(true)
  })

  it('removes handlers and the partition source on dispose', async () => {
    const m = await loadFresh()
    dispose = m.installBrowserProfiles(makeOptions(tmp))
    const profile = await m.browserSessionRegistry.createProfile('isolated', 'Work')
    mocks.removeHandler.mockClear()

    await dispose?.()
    dispose = undefined

    for (const channel of BROWSER_PROFILE_INVOKE_CHANNELS) {
      const removed = mocks.removeHandler.mock.calls.filter(([name]) => name === channel)
      expect(removed).toHaveLength(1)
    }
    expect(m.isAllowedBrowserPartition(profile!.partition)).toBe(false)
  })

  it('can be installed again after dispose', async () => {
    const m = await loadFresh()
    const firstDispose = m.installBrowserProfiles(makeOptions(tmp))
    await firstDispose?.()
    mocks.handle.mockClear()

    expect(() => {
      dispose = m.installBrowserProfiles(makeOptions(tmp))
    }).not.toThrow()
    expect(mocks.handle).toHaveBeenCalledTimes(BROWSER_PROFILE_INVOKE_CHANNELS.length)
  })

  it('initializes the process user agent identity so request header policies can run', async () => {
    const m = await loadFresh()
    dispose = m.installBrowserProfiles(makeOptions(tmp))

    const defaultSession = mocks.sessions.get(ORCA_BROWSER_PARTITION)!
    const webRequest = defaultSession.webRequest as unknown as {
      onBeforeSendHeaders: ReturnType<typeof vi.fn>
    }
    const listener = webRequest.onBeforeSendHeaders.mock.calls.find(
      ([filter]) => filter !== null
    )![1] as (details: unknown, callback: (response: unknown) => void) => void
    const callback = vi.fn()

    listener(
      {
        url: 'https://example.com/',
        requestHeaders: { 'User-Agent': 'x' },
        resourceType: 'mainFrame'
      },
      callback
    )

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not assign app.userAgentFallback', async () => {
    const before = app.userAgentFallback
    const m = await loadFresh()
    dispose = m.installBrowserProfiles(makeOptions(tmp))

    expect(app.userAgentFallback).toBe(before)
  })
})
