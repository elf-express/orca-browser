import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
  unregisterGuest: vi.fn(),
  getAuthorizedGuest: vi.fn(),
  setGrabMode: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler },
  webContents: { fromId: vi.fn() }
}))

vi.mock('../browser/browser-manager', () => ({
  browserManager: {
    unregisterGuest: mocks.unregisterGuest,
    getAuthorizedGuest: mocks.getAuthorizedGuest,
    setGrabMode: mocks.setGrabMode,
    attachGuestPolicies: vi.fn(),
    getGuestWebContentsId: vi.fn(),
    getWebContentsIdByTabId: vi.fn(() => new Map()),
    getScopeIdForTab: vi.fn()
  }
}))

vi.mock('../plugin-runtime', () => ({
  getBrowserHost: () => ({ getMainWindow: () => ({ webContents: { id: 91 } }) })
}))

import { registerBrowserHandlers } from './browser'
import { registerBrowserGrabHandlers, resetGrabModeState } from './browser-grab-ipc'

type Handler = (event: { sender: Electron.WebContents }, args: unknown) => unknown

function findHandler(channel: string): Handler {
  return mocks.handle.mock.calls.find(([name]) => name === channel)?.[1] as Handler
}

const sender = { id: 91, isDestroyed: () => false, getType: () => 'window' } as Electron.WebContents

describe('grab mode state on guest unregister', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetGrabModeState()
    registerBrowserHandlers()
    registerBrowserGrabHandlers()
    mocks.getAuthorizedGuest.mockReturnValue({})
  })

  it('drops the per-page grab mode queue when the guest unregisters', async () => {
    // The first enable never settles, so a surviving queue entry would block the next call.
    mocks.setGrabMode.mockImplementationOnce(() => new Promise(() => {}))
    mocks.setGrabMode.mockResolvedValue(true)
    const setGrabMode = findHandler('browser:setGrabMode')
    const args = { browserPageId: 'page-1', enabled: true }

    void setGrabMode({ sender }, args)
    await Promise.resolve()
    findHandler('browser:unregisterGuest')({ sender }, { browserPageId: 'page-1' })

    const outcome = await Promise.race([
      setGrabMode({ sender }, args),
      new Promise((resolve) => setTimeout(() => resolve('blocked'), 50))
    ])
    expect(outcome).toEqual({ ok: true })
  })
})
