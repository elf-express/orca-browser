import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
  registerGuest: vi.fn(),
  unregisterGuest: vi.fn(),
  getGuestWebContentsId: vi.fn(),
  getScopeIdForTab: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler },
  webContents: { fromId: vi.fn() }
}))

vi.mock('../browser/browser-manager', () => ({
  browserManager: {
    registerGuest: mocks.registerGuest,
    unregisterGuest: mocks.unregisterGuest,
    getGuestWebContentsId: mocks.getGuestWebContentsId,
    getScopeIdForTab: mocks.getScopeIdForTab,
    attachGuestPolicies: vi.fn()
  }
}))

vi.mock('../plugin-runtime', () => ({
  getBrowserHost: () => ({ getMainWindow: () => ({ webContents: { id: 91 } }) })
}))

import { registerBrowserHandlers, setAgentBrowserBridgeRef } from './browser'

type Handler = (event: { sender: Electron.WebContents }, args: unknown) => unknown

function handler(channel: string): Handler {
  return mocks.handle.mock.calls.find(([name]) => name === channel)?.[1] as Handler
}

const sender = { id: 91, isDestroyed: () => false, getType: () => 'window' } as Electron.WebContents

function fakeBridge() {
  return {
    onTabClosed: vi.fn(),
    onProcessSwap: vi.fn(),
    onTabChanged: vi.fn()
  }
}

let dispose: (() => void) | undefined

beforeEach(() => {
  dispose?.()
  setAgentBrowserBridgeRef(null)
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
  mocks.registerGuest.mockReturnValue(true)
  dispose = registerBrowserHandlers()
})

describe('agent bridge hooks in browser ipc', () => {
  it('unregisterGuest notifies the bridge before the guest mapping is cleared', () => {
    const bridge = fakeBridge()
    setAgentBrowserBridgeRef(bridge as never)
    mocks.getGuestWebContentsId.mockReturnValue(100)

    handler('browser:unregisterGuest')({ sender }, { browserPageId: 'tab-1' })

    expect(bridge.onTabClosed).toHaveBeenCalledWith(100)
    expect(bridge.onTabClosed.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.unregisterGuest.mock.invocationCallOrder[0]
    )
  })

  it('registerGuest with a new webContents id for an existing page triggers onProcessSwap', () => {
    const bridge = fakeBridge()
    setAgentBrowserBridgeRef(bridge as never)
    mocks.getGuestWebContentsId.mockReturnValue(100)

    handler('browser:registerGuest')(
      { sender },
      { browserPageId: 'tab-1', scopeId: 'ws-a', webContentsId: 200 }
    )

    expect(bridge.onProcessSwap).toHaveBeenCalledWith('tab-1', 200, 100)
  })

  it('activeTabChanged forwards the owning scope', () => {
    const bridge = fakeBridge()
    setAgentBrowserBridgeRef(bridge as never)
    mocks.getGuestWebContentsId.mockReturnValue(100)
    mocks.getScopeIdForTab.mockReturnValue('ws-a')

    const result = handler('browser:activeTabChanged')({ sender }, { browserPageId: 'tab-1' })

    expect(mocks.getScopeIdForTab).toHaveBeenCalledWith('tab-1')
    expect(bridge.onTabChanged).toHaveBeenCalledWith(100, 'ws-a')
    expect(result).toBe(true)
  })

  it('hooks are no-ops when no bridge is set', () => {
    mocks.getGuestWebContentsId.mockReturnValue(100)

    expect(() =>
      handler('browser:unregisterGuest')({ sender }, { browserPageId: 'tab-1' })
    ).not.toThrow()
    expect(() =>
      handler('browser:registerGuest')(
        { sender },
        { browserPageId: 'tab-1', scopeId: 'ws-a', webContentsId: 200 }
      )
    ).not.toThrow()
    expect(handler('browser:activeTabChanged')({ sender }, { browserPageId: 'tab-1' })).toBe(false)
  })
})
