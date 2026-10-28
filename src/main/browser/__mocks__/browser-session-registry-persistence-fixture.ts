import { join } from 'node:path'
import { vi } from 'vitest'

type RegistryMock = ReturnType<typeof vi.fn>

/**
 * In-memory filesystem and module mocks shared by the BrowserSessionRegistry persistence suites.
 *
 * `vi.doMock` is not hoisted, which is why it can live here: each test installs the mocks and then
 * dynamically imports the registry, so the relative specifiers below resolve against this
 * directory exactly as they did when this block lived inside the test file.
 */
export const USER_DATA = '/user-data'
// join() so the directory matches the registry's own spelling on Windows too.
export const DATA_DIR = join(USER_DATA, 'orca-browser')
const DATA_DIR_KEY = DATA_DIR.replaceAll('\\', '/')
export const META_PATH = `${DATA_DIR_KEY}/browser-session-meta.json`
export const IDENTITY_RECORD_PATH = `${DATA_DIR_KEY}/browser-identity-mode.json`
export const CLEAN_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.224 Safari/537.36'

export type FsState = {
  files: Map<string, string>
  present: Set<string>
}

const fsKey = (pathValue: string): string => pathValue.replaceAll('\\', '/')

export const createFsState = (): FsState => ({ files: new Map(), present: new Set() })

export function seedMeta(fsState: FsState, meta: unknown): void {
  const raw = JSON.stringify(meta)
  fsState.files.set(META_PATH, raw)
  fsState.present.add(META_PATH)
}

/** Annotated rather than inferred: vitest's inferred mock type cannot be named across a module boundary. */
export type BrowserSessionRegistryMocks = {
  sessionFromPartitionMock: RegistryMock
  installBrowserSessionUserAgentPolicyMock: RegistryMock
  browserManagerNotifyPermissionDeniedMock: RegistryMock
  requestSystemMediaAccessMock: RegistryMock
}

export function installModuleMocks(
  fsState: FsState,
  copyFailures = new Set<string>(),
  failIdentityWrite = false
): BrowserSessionRegistryMocks {
  const sessionFromPartitionMock: ReturnType<typeof vi.fn> = vi.fn((partition: string) => ({
    partition,
    setUserAgent: vi.fn(),
    getUserAgent: vi.fn(() => CLEAN_USER_AGENT),
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    setDisplayMediaRequestHandler: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    clearStorageData: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined)
  }))
  const installBrowserSessionUserAgentPolicyMock: RegistryMock = vi.fn(() => vi.fn())
  const browserManagerNotifyPermissionDeniedMock: RegistryMock = vi.fn()
  const requestSystemMediaAccessMock: RegistryMock = vi.fn().mockResolvedValue(true)

  vi.doMock('electron', () => ({
    app: { getPath: vi.fn(() => USER_DATA) },
    session: { fromPartition: sessionFromPartitionMock },
    systemPreferences: {
      askForMediaAccess: vi.fn().mockResolvedValue(true),
      getMediaAccessStatus: vi.fn(() => 'granted')
    }
  }))

  vi.doMock('node:fs', () => ({
    // The identity sidecar goes through writeFileDurableSync, so the in-memory fs has to
    // answer its fsync/rename syscalls too or every identity write looks like a disk failure.
    closeSync: vi.fn(),
    fsyncSync: vi.fn(),
    openSync: vi.fn(() => 1),
    rmSync: vi.fn((p: string) => {
      const key = fsKey(p)
      fsState.present.delete(key)
      fsState.files.delete(key)
    }),
    copyFileSync: vi.fn((src: string, dst: string) => {
      const sourceKey = fsKey(src)
      const destinationKey = fsKey(dst)
      if (copyFailures.has(sourceKey)) {
        throw new Error(`copy fail for ${src}`)
      }
      fsState.present.add(destinationKey)
      const value = fsState.files.get(sourceKey)
      if (value !== undefined) {
        fsState.files.set(destinationKey, value)
      }
    }),
    existsSync: vi.fn((p: string) => fsState.present.has(fsKey(p))),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn((p: string) => {
      const v = fsState.files.get(fsKey(p))
      if (v === undefined) {
        // Carry the code: absent data reads as "missing", while a codeless throw would
        // look "unreadable" and make every caller refuse to write.
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      }
      return v
    }),
    renameSync: vi.fn((from: string, to: string) => {
      const sourceKey = fsKey(from)
      const destinationKey = fsKey(to)
      const v = fsState.files.get(sourceKey)
      if (v === undefined) {
        throw new Error('ENOENT')
      }
      fsState.files.set(destinationKey, v)
      fsState.present.add(destinationKey)
      fsState.files.delete(sourceKey)
      fsState.present.delete(sourceKey)
    }),
    unlinkSync: vi.fn((p: string) => {
      const key = fsKey(p)
      fsState.present.delete(key)
      fsState.files.delete(key)
    }),
    writeFileSync: vi.fn((p: string, data: string | Uint8Array) => {
      if (failIdentityWrite && fsKey(p).includes('browser-identity-mode.json')) {
        throw new Error('read-only userData')
      }
      const value = typeof data === 'string' ? data : Buffer.from(data).toString('utf-8')
      const key = fsKey(p)
      fsState.files.set(key, value)
      fsState.present.add(key)
    })
  }))

  vi.doMock('../browser-manager', () => ({
    browserManager: {
      resolveBrowserGuestRequestUserAgent: vi.fn(),
      notifyPermissionDenied: browserManagerNotifyPermissionDeniedMock
    }
  }))
  vi.doMock('../browser-media-access', () => ({
    hasSystemMediaAccess: vi.fn(() => true),
    requestSystemMediaAccess: requestSystemMediaAccessMock
  }))
  vi.doMock('../browser-session-ua', () => ({
    installBrowserSessionUserAgentPolicy: installBrowserSessionUserAgentPolicyMock
  }))
  // These suites model replay with an in-memory filesystem. The real file-backed SQLite merge has
  // dedicated coverage; these fixtures are legacy unmarked images and keep the copy path.
  vi.doMock('../browser-cookie-staged-import', () => ({
    SCOPED_COOKIE_IMPORT_FORMAT: 'scoped-v1',
    applyScopedStagedCookieImport: vi.fn(() => false),
    isScopedStagedCookieImport: vi.fn(() => false),
    removeCookieImportScopeMarker: vi.fn()
  }))
  vi.doMock('../../fs-utils', () => ({
    renameFileWithWindowsRetry: vi.fn((source: string, target: string) => {
      const sourceKey = fsKey(source)
      const targetKey = fsKey(target)
      if (!fsState.present.has(sourceKey)) {
        throw new Error('ENOENT')
      }
      const value = fsState.files.get(sourceKey)
      fsState.present.delete(sourceKey)
      fsState.files.delete(sourceKey)
      fsState.present.add(targetKey)
      if (value !== undefined) {
        fsState.files.set(targetKey, value)
      }
    })
  }))

  return {
    sessionFromPartitionMock,
    installBrowserSessionUserAgentPolicyMock,
    browserManagerNotifyPermissionDeniedMock,
    requestSystemMediaAccessMock
  }
}

/**
 * Points a freshly imported registry at the in-memory userData and opens the identity store the
 * session policies read their applied mode from, mirroring what the host wires up at startup.
 */
export async function configureRegistry(registry: {
  configure: (opts: { userDataDir: string }) => void
}): Promise<void> {
  registry.configure({ userDataDir: USER_DATA })
  const identity = await import('../browser-identity-mode-store')
  identity.initializeBrowserIdentityModeStore(DATA_DIR)
}
