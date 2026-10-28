import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleMock,
  removeHandlerMock,
  createProfileMock,
  detectBrowsersMock,
  setBrowserIdentityModeMock,
  getProfileMock,
  updateProfileSourceMock,
  importFromBrowserMock,
  importFromFileMock,
  pickCookieFileMock,
  selectProfileMock,
  listProfilesMock,
  mainWindow
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  createProfileMock: vi.fn(),
  detectBrowsersMock: vi.fn(() => []),
  setBrowserIdentityModeMock: vi.fn(async () => ({ ok: true })),
  getProfileMock: vi.fn(),
  updateProfileSourceMock: vi.fn(),
  importFromBrowserMock: vi.fn(),
  importFromFileMock: vi.fn(),
  pickCookieFileMock: vi.fn(),
  selectProfileMock: vi.fn(),
  listProfilesMock: vi.fn(() => []),
  mainWindow: { webContents: { id: 91 } }
}))

vi.mock('../browser/browser-identity-mode-store', () => ({
  setBrowserIdentityMode: setBrowserIdentityModeMock,
  getBrowserIdentityModeStatus: vi.fn(() => ({ identity: {}, migrationNotice: null }))
}))

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: handleMock, removeHandler: removeHandlerMock },
  webContents: { fromId: vi.fn() }
}))

vi.mock('../browser/browser-session-registry', () => ({
  browserSessionRegistry: {
    createProfile: createProfileMock,
    getProfile: getProfileMock,
    updateProfileSource: updateProfileSourceMock,
    listProfiles: listProfilesMock
  }
}))

vi.mock('../plugin-runtime', () => ({
  getBrowserHost: () => ({ getMainWindow: () => mainWindow })
}))

vi.mock('../browser/browser-cookie-import', () => ({
  detectInstalledBrowsers: detectBrowsersMock,
  importCookiesFromBrowser: importFromBrowserMock,
  importCookiesFromFile: importFromFileMock,
  pickCookieFile: pickCookieFileMock,
  selectBrowserProfile: selectProfileMock
}))

import { registerBrowserSessionProfileHandlers } from './browser-session-profile-ipc'

describe('browser session profile IPC', () => {
  beforeEach(() => {
    handleMock.mockReset()
    removeHandlerMock.mockReset()
    createProfileMock.mockReset()
    detectBrowsersMock.mockReset()
    detectBrowsersMock.mockReturnValue([])
    setBrowserIdentityModeMock.mockReset()
    setBrowserIdentityModeMock.mockResolvedValue({ ok: true })
    for (const mock of [
      getProfileMock,
      updateProfileSourceMock,
      importFromBrowserMock,
      importFromFileMock,
      pickCookieFileMock,
      selectProfileMock
    ]) {
      mock.mockReset()
    }
  })

  type Handler = (event: { sender: Electron.WebContents }, args?: unknown) => unknown

  function handlerFor(channel: string): Handler {
    registerBrowserSessionProfileHandlers()
    const handler = handleMock.mock.calls.find(([name]) => name === channel)?.[1]
    if (!handler) {
      throw new Error(`no handler for ${channel}`)
    }
    return handler
  }

  function untrustedSender(): Electron.WebContents {
    return {
      id: 92,
      isDestroyed: () => false,
      getType: () => 'window',
      getURL: () => 'file:///other/index.html'
    } as Electron.WebContents
  }

  const chromeBrowser = {
    family: 'chrome',
    label: 'Google Chrome',
    cookiesPath: '/Users/someone/Library/Chrome/Default/Cookies',
    keychainService: 'Chrome Safe Storage',
    keychainAccount: 'Chrome',
    profiles: [{ name: 'Default', directory: 'Default' }],
    selectedProfile: 'Default'
  }

  function trustedSender(): Electron.WebContents {
    return {
      id: 91,
      isDestroyed: () => false,
      getType: () => 'window',
      getURL: () => 'file:///renderer/index.html'
    } as Electron.WebContents
  }

  function identitySetHandler(): (
    event: { sender: Electron.WebContents },
    mode: unknown
  ) => Promise<unknown> {
    registerBrowserSessionProfileHandlers()
    return handleMock.mock.calls.find(([channel]) => channel === 'browser:identity:set')?.[1]
  }

  // Why reject rather than coerce: the RPC door validates mode against z.enum(['clean','native'])
  // and rejects. Coercing an unrecognized value to 'clean' here made one concept answer an unknown
  // value two different ways, and reported success for a mode that was quietly replaced.
  it('refuses an unrecognized identity mode instead of silently selecting Cleaned', async () => {
    const handler = identitySetHandler()

    await expect(handler({ sender: trustedSender() }, 'rotating')).rejects.toThrow(/rotating/)
    expect(setBrowserIdentityModeMock).not.toHaveBeenCalled()
  })

  it('commits a recognized identity mode unchanged', async () => {
    const handler = identitySetHandler()

    await expect(handler({ sender: trustedSender() }, 'native')).resolves.toEqual({ ok: true })
    expect(setBrowserIdentityModeMock).toHaveBeenCalledWith('native')
  })

  it('creates a profile for a trusted renderer', async () => {
    const profile = {
      id: 'profile-google',
      scope: 'isolated',
      partition: 'persist:orca-browser-session-profile-google',
      label: 'Google',
      source: null
    }
    createProfileMock.mockReturnValue(profile)
    registerBrowserSessionProfileHandlers()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the registered test handler is selected by its exact channel and called with its declared boundary shape.
    const createHandler = handleMock.mock.calls.find(
      ([channel]) => channel === 'browser:session:createProfile'
    )?.[1] as (
      event: { sender: Electron.WebContents },
      args: { scope: 'isolated'; label: string }
    ) => unknown
    const sender = {
      id: 91,
      isDestroyed: () => false,
      getType: () => 'window',
      getURL: () => 'file:///renderer/index.html'
    } as Electron.WebContents

    await expect(
      createHandler({ sender }, { scope: 'isolated', label: 'Google' })
    ).resolves.toEqual(profile)
    expect(createProfileMock).toHaveBeenCalledWith('isolated', 'Google')
  })

  it('rejects traversal in browserProfile', async () => {
    getProfileMock.mockReturnValue({ id: 'default', partition: 'persist:orca-browser' })
    detectBrowsersMock.mockReturnValue([chromeBrowser] as never)
    const handler = handlerFor('browser:session:importFromBrowser')

    for (const browserProfile of ['../x', 'a/b', 'a\\b', '..']) {
      await expect(
        handler(
          { sender: trustedSender() },
          { profileId: 'default', browserFamily: 'chrome', browserProfile }
        )
      ).resolves.toEqual({ ok: false, reason: 'Invalid browser profile name.' })
    }
    expect(importFromBrowserMock).not.toHaveBeenCalled()
  })

  it('untrusted sender gets Not authorized', async () => {
    const importHandler = handlerFor('browser:session:importCookies')
    const listHandler = handlerFor('browser:session:listProfiles')

    await expect(
      importHandler({ sender: untrustedSender() }, { profileId: 'default' })
    ).resolves.toEqual({
      ok: false,
      reason: 'Not authorized'
    })
    expect(listHandler({ sender: untrustedSender() })).toEqual([])
    expect(pickCookieFileMock).not.toHaveBeenCalled()
  })

  it('detectBrowsers strips filesystem paths', () => {
    detectBrowsersMock.mockReturnValue([chromeBrowser] as never)
    const handler = handlerFor('browser:session:detectBrowsers')

    const result = handler({ sender: trustedSender() }) as Record<string, unknown>[]
    expect(result).toHaveLength(1)
    expect(Object.keys(result[0]!).sort()).toEqual([
      'family',
      'label',
      'profiles',
      'selectedProfile'
    ])
    expect(handler({ sender: untrustedSender() })).toEqual([])
  })

  it('successful import records profile source', async () => {
    getProfileMock.mockReturnValue({ id: 'default', partition: 'persist:orca-browser' })
    detectBrowsersMock.mockReturnValue([chromeBrowser] as never)
    importFromBrowserMock.mockResolvedValue({ ok: true, totalCookies: 1, importedCookies: 1 })
    const handler = handlerFor('browser:session:importFromBrowser')

    const result = await handler(
      { sender: trustedSender() },
      { profileId: 'default', browserFamily: 'chrome' }
    )

    expect(result).toMatchObject({ ok: true, profileId: 'default' })
    expect(importFromBrowserMock).toHaveBeenCalledWith(chromeBrowser, 'persist:orca-browser')
    expect(updateProfileSourceMock).toHaveBeenCalledWith('default', {
      browserFamily: 'chrome',
      profileName: 'Default',
      importedAt: expect.any(Number)
    })
  })

  it('unknown identity mode is rejected', async () => {
    const handler = handlerFor('browser:identity:set')

    await expect(handler({ sender: trustedSender() }, 'weird')).rejects.toThrow(
      'Unsupported browser identity mode: weird'
    )
  })

  it('parents the cookie file picker on the host main window', async () => {
    getProfileMock.mockReturnValue({ id: 'default', partition: 'persist:orca-browser' })
    pickCookieFileMock.mockResolvedValue(null)
    const handler = handlerFor('browser:session:importCookies')

    await expect(handler({ sender: trustedSender() }, { profileId: 'default' })).resolves.toEqual({
      ok: false,
      reason: 'canceled'
    })
    expect(pickCookieFileMock).toHaveBeenCalledWith(mainWindow)
  })
})
