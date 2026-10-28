import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserSessionProfile } from '../../shared/browser-workspace-types'

const ELECTRON_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Orca/1.0 Chrome/150.0.7871.224 Electron/43.0.0 Safari/537.36'
const APP_USER_AGENT_FALLBACK = 'Mozilla/5.0 AppFallback Electron/43.0.0'

const mocks = vi.hoisted(() => ({
  installBrowserSessionUserAgentPolicy: vi.fn(() => vi.fn())
}))

type FakeSession = {
  getUserAgent: () => string
  setUserAgent: ReturnType<typeof vi.fn>
  setPermissionRequestHandler: ReturnType<typeof vi.fn>
  setPermissionCheckHandler: ReturnType<typeof vi.fn>
  setDisplayMediaRequestHandler: ReturnType<typeof vi.fn>
}

const sessionsByPartition = new Map<string, FakeSession>()

vi.mock('electron', () => ({
  app: { userAgentFallback: 'Mozilla/5.0 AppFallback Electron/43.0.0' },
  session: {
    fromPartition: (partition: string) => {
      const existing = sessionsByPartition.get(partition)
      if (existing) {
        return existing
      }
      const created: FakeSession = {
        getUserAgent: () =>
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Orca/1.0 Chrome/150.0.7871.224 Electron/43.0.0 Safari/537.36',
        setUserAgent: vi.fn(),
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        setDisplayMediaRequestHandler: vi.fn()
      }
      sessionsByPartition.set(partition, created)
      return created
    }
  }
}))
vi.mock('./browser-manager', () => ({
  browserManager: { resolveBrowserGuestRequestUserAgent: vi.fn(), notifyPermissionDenied: vi.fn() }
}))
vi.mock('./browser-media-access', () => ({
  hasSystemMediaAccess: () => false,
  requestSystemMediaAccess: async () => false
}))
vi.mock('./browser-session-ua', () => ({
  installBrowserSessionUserAgentPolicy: mocks.installBrowserSessionUserAgentPolicy
}))

function profileFor(partition: string): BrowserSessionProfile {
  return { id: partition, scope: 'isolated', partition, label: partition, source: null }
}

function makeIdentityDir(mode: 'clean' | 'native'): string {
  const dir = mkdtempSync(join(tmpdir(), 'orca-browser-policies-'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'browser-identity-mode.json'),
    JSON.stringify({
      version: 1,
      mode,
      explicitSelection: true,
      migrationNoticePending: false
    }),
    'utf8'
  )
  return dir
}

// Why imported per test rather than at the top: the installer remembers which partitions it has
// already configured in module state, and the identity store is process-wide state too.
async function loadPolicies(mode: 'clean' | 'native') {
  const identity = await import('./browser-identity-mode-store')
  identity.initializeBrowserIdentityModeStore(makeIdentityDir(mode))
  return await import('./browser-session-partition-policies')
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionsByPartition.clear()
  vi.resetModules()
})

describe('partition user agent policy', () => {
  it('clean mode strips Electron token from session UA', async () => {
    const policies = await loadPolicies('clean')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))

    const sess = sessionsByPartition.get('persist:browsing-1')!
    expect(sess.setUserAgent).toHaveBeenCalledTimes(1)
    const applied = sess.setUserAgent.mock.calls[0][0] as string
    expect(applied).not.toContain('Electron/')
    expect(applied).toContain('Chrome/150.0.7871.224')
  })

  it('native mode keeps session UA', async () => {
    const policies = await loadPolicies('native')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))

    const sess = sessionsByPartition.get('persist:browsing-1')!
    expect(sess.setUserAgent).toHaveBeenCalledWith(ELECTRON_USER_AGENT)
  })

  it('does not touch app.userAgentFallback', async () => {
    const { app } = await import('electron')
    const before = app.userAgentFallback
    const policies = await loadPolicies('clean')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))

    expect(before).toBe(APP_USER_AGENT_FALLBACK)
    expect(app.userAgentFallback).toBe(before)
  })

  it('installs request-level exceptions unless the caller opts out', async () => {
    const policies = await loadPolicies('clean')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))
    expect(mocks.installBrowserSessionUserAgentPolicy).toHaveBeenCalledTimes(1)

    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-2'), {
      userAgentExceptions: false
    })
    expect(mocks.installBrowserSessionUserAgentPolicy).toHaveBeenCalledTimes(1)
  })

  it('retires the request-level exceptions when the partition policies are cleared', async () => {
    const dispose = vi.fn()
    mocks.installBrowserSessionUserAgentPolicy.mockReturnValueOnce(dispose)
    const policies = await loadPolicies('clean')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))

    policies.clearBrowserSessionPartitionPolicies(
      'persist:browsing-1',
      sessionsByPartition.get('persist:browsing-1') as never
    )

    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('rejects when the identity store was never initialized', async () => {
    const policies = await import('./browser-session-partition-policies')
    await expect(
      policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))
    ).rejects.toThrow('not initialized')
  })
})

describe('partition permission policy', () => {
  it('keeps ordinary browser partitions on the browser permission policy', async () => {
    const policies = await loadPolicies('clean')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))
    const sess = sessionsByPartition.get('persist:browsing-1')!

    expect(sess.setPermissionRequestHandler).toHaveBeenCalledTimes(1)
    expect(sess.setPermissionCheckHandler).toHaveBeenCalledTimes(1)
    const requestHandler = sess.setPermissionRequestHandler.mock.calls[0][0] as (
      webContents: unknown,
      permission: string,
      callback: (allowed: boolean) => void
    ) => void
    const decisions: boolean[] = []
    const guest = { id: 1, getURL: () => 'https://example.com/' }
    requestHandler(guest, 'fullscreen', (a) => decisions.push(a))
    requestHandler(guest, 'geolocation', (a) => decisions.push(a))
    expect(decisions).toEqual([true, false])
  })

  it('denies display media capture', async () => {
    const policies = await loadPolicies('clean')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))
    const sess = sessionsByPartition.get('persist:browsing-1')!
    const handler = sess.setDisplayMediaRequestHandler.mock.calls[0][0] as (
      request: unknown,
      callback: (streams: unknown) => void
    ) => void
    const callback = vi.fn()
    handler(null, callback)
    expect(callback).toHaveBeenCalledWith({ video: undefined, audio: undefined })
  })

  it('does not stack handlers when a partition is installed twice', async () => {
    const policies = await loadPolicies('clean')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))
    const sess = sessionsByPartition.get('persist:browsing-1')!
    expect(sess.setPermissionRequestHandler).toHaveBeenCalledTimes(1)
  })

  it('installs again after the partition configuration is forgotten', async () => {
    const policies = await loadPolicies('clean')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))
    policies.forgetBrowserSessionPartitionConfiguration('persist:browsing-1')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))
    const sess = sessionsByPartition.get('persist:browsing-1')!
    expect(sess.setPermissionRequestHandler).toHaveBeenCalledTimes(2)
  })

  it('clears the handlers with the partition policies', async () => {
    const policies = await loadPolicies('clean')
    await policies.installBrowserSessionPartitionPolicies(profileFor('persist:browsing-1'))
    const sess = sessionsByPartition.get('persist:browsing-1')!
    policies.clearBrowserSessionPartitionPolicies('persist:browsing-1', sess as never)
    expect(sess.setPermissionRequestHandler).toHaveBeenLastCalledWith(null)
    expect(sess.setPermissionCheckHandler).toHaveBeenLastCalledWith(null)
    expect(sess.setDisplayMediaRequestHandler).toHaveBeenLastCalledWith(null)
  })
})
