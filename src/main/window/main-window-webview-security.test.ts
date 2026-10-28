import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ORCA_BROWSER_GUEST_WEB_PREFERENCES } from '../../shared/browser-guest-web-preferences'

const mocks = vi.hoisted(() => ({
  attachGuestPolicies: vi.fn(),
  getAllWebContents: vi.fn((): unknown[] => []),
  appOn: vi.fn(),
  appOff: vi.fn()
}))

vi.mock('electron', () => ({
  app: { on: mocks.appOn, off: mocks.appOff },
  webContents: { getAllWebContents: mocks.getAllWebContents }
}))
vi.mock('../browser/browser-manager', () => ({
  browserManager: { attachGuestPolicies: mocks.attachGuestPolicies }
}))

import { registerAllowedBrowserPartitionSource } from '../browser/browser-partition-allowlist'
import { installWebviewSecurity } from './main-window-webview-security'

type Handler = (...args: never[]) => void

type FakeContents = {
  id: number
  getType: () => string
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  handlers: Record<string, Handler>
}

function makeContents(id: number, type = 'window'): FakeContents {
  const handlers: Record<string, Handler> = {}
  return {
    id,
    getType: () => type,
    handlers,
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler
    }),
    off: vi.fn()
  }
}

function makeWindow(contents: FakeContents): Electron.BrowserWindow {
  return { webContents: contents, isDestroyed: () => false } as unknown as Electron.BrowserWindow
}

function attach(
  contents: FakeContents,
  preferences: Record<string, unknown>,
  params: Record<string, unknown>
): ReturnType<typeof vi.fn> {
  const preventDefault = vi.fn()
  contents.handlers['will-attach-webview']?.(
    { preventDefault } as never,
    preferences as never,
    params as never
  )
  return preventDefault
}

describe('main window webview security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllWebContents.mockReturnValue([])
  })

  it('fails closed before applying hardened guest preferences', () => {
    const contents = makeContents(1)
    mocks.getAllWebContents.mockReturnValue([contents])
    installWebviewSecurity(() => makeWindow(contents))
    const preferences: Record<string, unknown> = {
      partition: 'persist:untrusted',
      preload: 'attacker.js'
    }

    const preventDefault = attach(contents, preferences, {
      src: 'https://example.com',
      preload: 'attacker.js'
    })

    expect(preventDefault).toHaveBeenCalledOnce()
  })

  it('removes renderer preload input and restores every hardened preference', () => {
    const contents = makeContents(1)
    mocks.getAllWebContents.mockReturnValue([contents])
    installWebviewSecurity(() => makeWindow(contents))
    const params = { src: 'https://example.com', preload: 'attacker.js' }
    const preferences: Record<string, unknown> = {
      partition: 'persist:orca-browser',
      preload: 'attacker.js',
      preloadURL: 'attacker.js',
      sandbox: false
    }

    const preventDefault = attach(contents, preferences, params)

    expect(preventDefault).not.toHaveBeenCalled()
    expect(params).not.toHaveProperty('preload')
    expect(preferences).toMatchObject({
      ...ORCA_BROWSER_GUEST_WEB_PREFERENCES,
      partition: 'persist:orca-browser',
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true
    })
    expect(preferences).not.toHaveProperty('preloadURL')
  })

  it('denies webview attach in a window that is not the host main window', () => {
    const mainContents = makeContents(1)
    const otherContents = makeContents(2)
    mocks.getAllWebContents.mockReturnValue([mainContents, otherContents])
    installWebviewSecurity(() => makeWindow(mainContents))

    const preventDefault = attach(
      otherContents,
      { partition: 'persist:orca-browser' },
      { src: 'https://example.com' }
    )

    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it('denies a partition outside the allowlist', () => {
    const contents = makeContents(1)
    mocks.getAllWebContents.mockReturnValue([contents])
    installWebviewSecurity(() => makeWindow(contents))

    const preventDefault = attach(
      contents,
      { partition: 'persist:evil' },
      { src: 'https://example.com' }
    )

    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it('allows a partition from a registered source', () => {
    const contents = makeContents(1)
    mocks.getAllWebContents.mockReturnValue([contents])
    installWebviewSecurity(() => makeWindow(contents))
    const remove = registerAllowedBrowserPartitionSource((p) => p === 'persist:p1')

    const preventDefault = attach(
      contents,
      { partition: 'persist:p1' },
      { src: 'https://example.com' }
    )
    remove()

    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('denies a src the browser cannot navigate to', () => {
    const contents = makeContents(1)
    mocks.getAllWebContents.mockReturnValue([contents])
    installWebviewSecurity(() => makeWindow(contents))

    const preventDefault = attach(
      contents,
      { partition: 'persist:orca-browser' },
      { src: 'javascript:alert(1)' }
    )

    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it('strips any guest preload', () => {
    const contents = makeContents(1)
    mocks.getAllWebContents.mockReturnValue([contents])
    installWebviewSecurity(() => makeWindow(contents))
    const params: Record<string, unknown> = { src: 'https://example.com', preload: 'a.js' }
    const preferences: Record<string, unknown> = {
      partition: 'persist:orca-browser',
      preload: 'b.js',
      preloadURL: 'c.js'
    }

    attach(contents, preferences, params)

    expect(params.preload).toBeUndefined()
    expect(preferences.preload).toBeUndefined()
    expect(preferences.preloadURL).toBeUndefined()
  })

  it('forces web security even when the host window disables it', () => {
    const contents = makeContents(1)
    mocks.getAllWebContents.mockReturnValue([contents])
    installWebviewSecurity(() => makeWindow(contents))
    const preferences: Record<string, unknown> = {
      partition: 'persist:orca-browser',
      webSecurity: false,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: true,
      contextIsolation: false,
      sandbox: false,
      allowRunningInsecureContent: true,
      disableHtmlFullscreenWindowResize: false
    }

    attach(contents, preferences, { src: 'https://example.com' })

    expect(preferences.webSecurity).toBe(true)
    expect(preferences.nodeIntegration).toBe(false)
    expect(preferences.nodeIntegrationInSubFrames).toBe(false)
    expect(preferences.contextIsolation).toBe(true)
    expect(preferences.sandbox).toBe(true)
    expect(preferences.allowRunningInsecureContent).toBe(false)
    expect(preferences.disableHtmlFullscreenWindowResize).toBe(true)
  })

  it('attaches guest policies on did-attach-webview for the main window only', () => {
    const mainContents = makeContents(1)
    const otherContents = makeContents(2)
    mocks.getAllWebContents.mockReturnValue([mainContents, otherContents])
    installWebviewSecurity(() => makeWindow(mainContents))
    const guest = { id: 50 }

    otherContents.handlers['did-attach-webview']?.({} as never, guest as never)
    expect(mocks.attachGuestPolicies).not.toHaveBeenCalled()

    mainContents.handlers['did-attach-webview']?.({} as never, guest as never)
    expect(mocks.attachGuestPolicies).toHaveBeenCalledExactlyOnceWith(guest)
  })

  it('guards main windows created before and after install', () => {
    const before = makeContents(1)
    const after = makeContents(3)
    const notAWindow = makeContents(4, 'webview')
    mocks.getAllWebContents.mockReturnValue([before])
    installWebviewSecurity(() => makeWindow(before))

    expect(before.on).toHaveBeenCalledWith('will-attach-webview', expect.any(Function))
    const onCreated = mocks.appOn.mock.calls.find(
      ([event]) => event === 'web-contents-created'
    )?.[1] as (event: unknown, contents: unknown) => void
    expect(onCreated).toBeTypeOf('function')

    onCreated({}, after)
    onCreated({}, notAWindow)

    expect(after.on).toHaveBeenCalledWith('will-attach-webview', expect.any(Function))
    expect(notAWindow.on).not.toHaveBeenCalled()
  })

  it('follows the main window when the host rebuilds it', () => {
    const oldContents = makeContents(1)
    const newContents = makeContents(2)
    mocks.getAllWebContents.mockReturnValue([oldContents, newContents])
    let current = oldContents
    installWebviewSecurity(() => makeWindow(current))
    current = newContents

    const newAttach = attach(
      newContents,
      { partition: 'persist:orca-browser' },
      { src: 'https://example.com' }
    )
    const oldAttach = attach(
      oldContents,
      { partition: 'persist:orca-browser' },
      { src: 'https://example.com' }
    )

    expect(newAttach).not.toHaveBeenCalled()
    expect(oldAttach).toHaveBeenCalledTimes(1)
  })

  it('removes its listeners when disposed', () => {
    const contents = makeContents(1)
    mocks.getAllWebContents.mockReturnValue([contents])
    const dispose = installWebviewSecurity(() => makeWindow(contents))
    const onCreated = mocks.appOn.mock.calls.find(
      ([event]) => event === 'web-contents-created'
    )?.[1]

    dispose()

    expect(mocks.appOff).toHaveBeenCalledWith('web-contents-created', onCreated)
    expect(contents.off).toHaveBeenCalledWith(
      'will-attach-webview',
      contents.handlers['will-attach-webview']
    )
    expect(contents.off).toHaveBeenCalledWith(
      'did-attach-webview',
      contents.handlers['did-attach-webview']
    )
  })
})
