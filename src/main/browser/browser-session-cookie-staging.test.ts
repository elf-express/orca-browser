import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { appGetPathMock } = vi.hoisted(() => ({ appGetPathMock: vi.fn() }))

vi.mock('electron', () => ({ app: { getPath: appGetPathMock } }))

import {
  applyPendingBrowserCookieImports,
  supportsPendingBrowserCookieImportReplay
} from './browser-session-cookie-staging'
import { loadBrowserSessionMeta, persistBrowserSessionMeta } from './browser-session-meta-store'

const defaultPartition = 'persist:orca-browser-default'
const unknownPartition = `persist:orca-browser-v1-${'c'.repeat(64)}`
let userData = ''
const metadataPath = (): string => join(userData, 'browser-session-meta.json')

beforeEach(() => {
  // Why: macOS reports /private/var for a /var mkdtemp path, so resolve before comparing paths.
  userData = realpathSync(mkdtempSync(join(tmpdir(), 'orca-cookie-staging-')))
  appGetPathMock.mockReturnValue(userData)
})

afterEach(() => {
  rmSync(userData, { recursive: true, force: true })
})

describe('supportsPendingBrowserCookieImportReplay', () => {
  it('allows the default partition and profile partitions', () => {
    expect(supportsPendingBrowserCookieImportReplay(defaultPartition)).toBe(true)
    expect(supportsPendingBrowserCookieImportReplay('persist:orca-browser-profile-a')).toBe(true)
  })
})

describe('applyPendingBrowserCookieImports', () => {
  it('unlinks the plaintext staged database when the partition is not a known profile partition', () => {
    const stagedPath = join(userData, 'cookie-import-staging', 'Cookies-unknown')
    mkdirSync(join(userData, 'cookie-import-staging'), { recursive: true })
    for (const suffix of ['', '-wal', '-shm']) {
      writeFileSync(stagedPath + suffix, 'plaintext cookies', { flag: 'w' })
    }
    persistBrowserSessionMeta(metadataPath, defaultPartition, {
      pendingCookieImports: { [unknownPartition]: stagedPath }
    })

    applyPendingBrowserCookieImports({
      resolveMetadataPath: metadataPath,
      defaultPartition,
      activeOrcaProfileId: 'profile-a'
    })

    for (const suffix of ['', '-wal', '-shm']) {
      expect(existsSync(stagedPath + suffix)).toBe(false)
    }
    expect(loadBrowserSessionMeta(metadataPath, defaultPartition).pendingCookieImports).toEqual({})
  })
})
