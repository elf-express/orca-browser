import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  removeHandlerMock,
  handleMock,
  registerGuestMock,
  attachGuestPoliciesMock,
  unregisterGuestMock,
  getGuestWebContentsIdMock,
  getWebContentsIdByTabIdMock,
  getScopeIdForTabMock,
  webContentsFromIdMock
} = vi.hoisted(() => ({
  removeHandlerMock: vi.fn(),
  handleMock: vi.fn(),
  registerGuestMock: vi.fn(),
  attachGuestPoliciesMock: vi.fn(),
  unregisterGuestMock: vi.fn(),
  getGuestWebContentsIdMock: vi.fn(),
  getWebContentsIdByTabIdMock: vi.fn(() => new Map()),
  getScopeIdForTabMock: vi.fn(),
  webContentsFromIdMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: removeHandlerMock,
    handle: handleMock
  },
  webContents: {
    fromId: webContentsFromIdMock
  }
}))

vi.mock('../browser/browser-manager', () => ({
  browserManager: {
    registerGuest: registerGuestMock,
    attachGuestPolicies: attachGuestPoliciesMock,
    unregisterGuest: unregisterGuestMock,
    getGuestWebContentsId: getGuestWebContentsIdMock,
    getWebContentsIdByTabId: getWebContentsIdByTabIdMock,
    getScopeIdForTab: getScopeIdForTabMock
  }
}))

vi.mock('../plugin-runtime', () => ({
  getBrowserHost: () => ({ getMainWindow: () => ({ webContents: { id: 91 } }) })
}))

import { registerBrowserHandlers, type BrowserGuestArgs } from './browser'
import {
  waitForAnyTabRegistration,
  waitForScopeTabRegistration,
  waitForTabRegistration
} from './browser-tab-registration-wait'

type Handler = (event: { sender: Electron.WebContents }, args: unknown) => unknown

function findHandler(channel: string): Handler {
  const entry = handleMock.mock.calls.find(([name]) => name === channel)
  return entry?.[1] as Handler
}

const trustedSender = {
  id: 91,
  isDestroyed: () => false,
  getType: () => 'window'
} as Electron.WebContents

describe('registerBrowserHandlers', () => {
  beforeEach(() => {
    removeHandlerMock.mockReset()
    handleMock.mockReset()
    registerGuestMock.mockReset()
    registerGuestMock.mockReturnValue(true)
    attachGuestPoliciesMock.mockReset()
    unregisterGuestMock.mockReset()
    getGuestWebContentsIdMock.mockReset()
    getWebContentsIdByTabIdMock.mockReset()
    getWebContentsIdByTabIdMock.mockReturnValue(new Map())
    getScopeIdForTabMock.mockReset()
    webContentsFromIdMock.mockReset()
    webContentsFromIdMock.mockReturnValue({ isDestroyed: () => false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects non-window callers', async () => {
    registerBrowserHandlers()

    const result = findHandler('browser:registerGuest')(
      {
        sender: {
          isDestroyed: () => false,
          getType: () => 'webview',
          getURL: () => 'http://localhost:5173/'
        } as Electron.WebContents
      },
      { browserTabId: 'browser-1', webContentsId: 101 }
    )

    expect(result).toBe(false)
    expect(registerGuestMock).not.toHaveBeenCalled()
  })

  it('does not resolve registration waiters when BrowserManager rejects the guest', async () => {
    vi.useFakeTimers()
    registerGuestMock.mockReturnValue(false)
    const settled = Promise.allSettled([waitForTabRegistration('page-1', 1000)])
    registerBrowserHandlers()

    const args: BrowserGuestArgs = {
      browserPageId: 'page-1',
      scopeId: 'scope-1',
      webContentsId: 123
    }
    const result = findHandler('browser:registerGuest')({ sender: trustedSender }, args)

    expect(result).toBe(false)
    await vi.advanceTimersByTimeAsync(1001)
    expect(await settled).toEqual([{ status: 'rejected', reason: expect.any(Error) }])
  })

  it('validates exact live guest registration only for the trusted renderer', () => {
    getGuestWebContentsIdMock.mockReturnValue(123)
    registerBrowserHandlers()
    const validateHandler = findHandler('browser:isGuestRegistered')

    expect(
      validateHandler({ sender: trustedSender }, { browserPageId: 'page-1', webContentsId: 123 })
    ).toBe(true)
    expect(
      validateHandler({ sender: trustedSender }, { browserPageId: 'page-1', webContentsId: 124 })
    ).toBe(false)

    webContentsFromIdMock.mockReturnValue({ isDestroyed: () => true })
    expect(
      validateHandler({ sender: trustedSender }, { browserPageId: 'page-1', webContentsId: 123 })
    ).toBe(false)
    expect(
      validateHandler(
        {
          sender: {
            id: 92,
            isDestroyed: () => false,
            getType: () => 'webview'
          } as Electron.WebContents
        },
        { browserPageId: 'page-1', webContentsId: 123 }
      )
    ).toBe(false)
  })

  it('repairs only a live webview owned by the trusted renderer', () => {
    registerBrowserHandlers()
    const repairHandler = findHandler('browser:repairGuestRegistration')
    const guest = {
      id: 123,
      hostWebContents: trustedSender,
      isDestroyed: () => false,
      getType: () => 'webview'
    } as Electron.WebContents
    webContentsFromIdMock.mockReturnValue(guest)
    const args = {
      browserPageId: 'page-1',
      scopeId: 'scope-1',
      webContentsId: 123
    }

    expect(repairHandler({ sender: trustedSender }, args)).toBe(true)
    expect(attachGuestPoliciesMock).toHaveBeenCalledWith(guest)
    expect(registerGuestMock).toHaveBeenCalledWith({
      ...args,
      rendererWebContentsId: trustedSender.id
    })

    webContentsFromIdMock.mockReturnValue({
      ...guest,
      hostWebContents: { id: 92 }
    })
    expect(repairHandler({ sender: trustedSender }, args)).toBe(false)
    expect(registerGuestMock).toHaveBeenCalledTimes(1)
  })

  it('resolves concurrent tab registration waiters for the same page', async () => {
    vi.useFakeTimers()
    getGuestWebContentsIdMock.mockReturnValue(null)
    const first = waitForTabRegistration('page-1', 1000)
    const second = waitForTabRegistration('page-1', 1000)
    const settled = Promise.allSettled([first, second])

    registerBrowserHandlers()

    const result = findHandler('browser:registerGuest')(
      { sender: trustedSender },
      { browserPageId: 'page-1', scopeId: 'scope-1', webContentsId: 123 }
    )

    expect(result).toBe(true)
    await vi.advanceTimersByTimeAsync(1001)
    expect(await settled).toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined }
    ])
  })

  it('resolves scope and any-tab registration waiters when a guest registers', async () => {
    vi.useFakeTimers()
    getWebContentsIdByTabIdMock.mockReturnValue(new Map())
    const scopeWait = waitForScopeTabRegistration('scope-1', 1000)
    const anyWait = waitForAnyTabRegistration(1000)
    const settled = Promise.allSettled([scopeWait, anyWait])

    registerBrowserHandlers()

    const result = findHandler('browser:registerGuest')(
      { sender: trustedSender },
      { browserPageId: 'page-scope-1', scopeId: 'scope-1', webContentsId: 123 }
    )

    expect(result).toBe(true)
    await vi.advanceTimersByTimeAsync(1001)
    expect(await settled).toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined }
    ])
  })

  it('resolves scope registration waits immediately when a tab is already registered', async () => {
    getWebContentsIdByTabIdMock.mockReturnValue(new Map([['page-1', 123]]))
    getScopeIdForTabMock.mockReturnValue('scope-1')

    await expect(waitForScopeTabRegistration('scope-1', 1000)).resolves.toBeUndefined()

    expect(getScopeIdForTabMock).toHaveBeenCalledWith('page-1')
  })

  it('resolves any-tab registration waits immediately when a tab is already registered', async () => {
    getWebContentsIdByTabIdMock.mockReturnValue(new Map([['page-1', 123]]))

    await expect(waitForAnyTabRegistration(1000)).resolves.toBeUndefined()
  })

  it('does not resolve scope registration waits from a stale registered guest', async () => {
    getWebContentsIdByTabIdMock.mockReturnValue(new Map([['page-1', 123]]))
    getScopeIdForTabMock.mockReturnValue('scope-1')
    webContentsFromIdMock.mockReturnValue({ isDestroyed: () => true })

    let resolved = false
    const wait = waitForScopeTabRegistration('scope-1', 1000).then(() => {
      resolved = true
    })
    await Promise.resolve()

    expect(resolved).toBe(false)

    registerBrowserHandlers()
    const result = findHandler('browser:registerGuest')(
      { sender: trustedSender },
      { browserPageId: 'page-1', scopeId: 'scope-1', webContentsId: 456 }
    )

    expect(result).toBe(true)
    await expect(wait).resolves.toBeUndefined()
    expect(resolved).toBe(true)
  })

  it('rejects activeTabChanged from untrusted senders', () => {
    registerBrowserHandlers()

    const result = findHandler('browser:activeTabChanged')(
      {
        sender: {
          id: 92,
          isDestroyed: () => false,
          getType: () => 'window'
        } as Electron.WebContents
      },
      { browserPageId: 'page-1' }
    )

    expect(result).toBe(false)
  })

  it('answers activeTabChanged with false while no agent bridge is installed', () => {
    registerBrowserHandlers()

    const result = findHandler('browser:activeTabChanged')(
      { sender: trustedSender },
      { browserPageId: 'page-1' }
    )

    expect(result).toBe(false)
  })

  it('removes every registered handler when disposed', () => {
    const dispose = registerBrowserHandlers()
    const channels = handleMock.mock.calls.map(([name]) => name).sort()
    removeHandlerMock.mockClear()

    dispose()

    expect(removeHandlerMock.mock.calls.map(([name]) => name).sort()).toEqual(channels)
  })
})
