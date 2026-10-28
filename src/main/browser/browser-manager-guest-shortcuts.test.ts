import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const browserMocks = vi.hoisted(() => ({
  appGetPathMock: vi.fn(() => '/downloads'),
  hostOpenExternalMock: vi.fn(),
  browserWindowFromWebContentsMock: vi.fn(),
  menuBuildFromTemplateMock: vi.fn(),
  guestOffMock: vi.fn(),
  guestOnMock: vi.fn(),
  guestSetBackgroundThrottlingMock: vi.fn(),
  guestSetWindowOpenHandlerMock: vi.fn(),
  guestOpenDevToolsMock: vi.fn(),
  webContentsFromIdMock: vi.fn(),
  screenGetCursorScreenPointMock: vi.fn(() => ({ x: 0, y: 0 })),
  openPopupWithOriginBarMock: vi.fn()
}))

vi.mock('../plugin-runtime', () => ({
  getBrowserHost: () => ({ openExternal: browserMocks.hostOpenExternalMock })
}))

vi.mock('electron', () => ({
  app: {
    getPath: browserMocks.appGetPathMock
  },
  BrowserWindow: {
    fromWebContents: browserMocks.browserWindowFromWebContentsMock
  },
  clipboard: { writeText: vi.fn() },
  Menu: {
    buildFromTemplate: browserMocks.menuBuildFromTemplateMock
  },
  screen: {
    getCursorScreenPoint: browserMocks.screenGetCursorScreenPointMock
  },
  webContents: {
    fromId: browserMocks.webContentsFromIdMock
  }
}))

vi.mock('./popup-origin-bar-window', () => ({
  openPopupWithOriginBar: browserMocks.openPopupWithOriginBarMock
}))

import { browserManager } from './browser-manager'
import {
  rendererWebContentsId,
  resetBrowserManagerMocks,
  resetBrowserManagerState
} from './browser-manager-test-harness'

const {
  guestOffMock,
  guestOnMock,
  guestSetBackgroundThrottlingMock,
  guestSetWindowOpenHandlerMock,
  guestOpenDevToolsMock,
  webContentsFromIdMock
} = browserMocks

describe('browserManager', () => {
  beforeEach(() => {
    resetBrowserManagerMocks(browserMocks)
    resetBrowserManagerState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not forward ctrl/cmd+r or readline chords from browser guests', () => {
    const rendererSendMock = vi.fn()
    const guest = {
      id: 405,
      isDestroyed: vi.fn(() => false),
      getType: vi.fn(() => 'webview'),
      setBackgroundThrottling: guestSetBackgroundThrottlingMock,
      setWindowOpenHandler: guestSetWindowOpenHandlerMock,
      on: guestOnMock,
      off: guestOffMock,
      openDevTools: guestOpenDevToolsMock
    }

    webContentsFromIdMock.mockImplementation((id: number) => {
      if (id === guest.id) {
        return guest
      }
      if (id === rendererWebContentsId) {
        return { isDestroyed: vi.fn(() => false), send: rendererSendMock }
      }
      return null
    })

    browserManager.attachGuestPolicies(guest as never)
    browserManager.registerGuest({
      browserPageId: 'browser-1',
      scopeId: 'scope-1',
      webContentsId: guest.id,
      rendererWebContentsId
    })

    const beforeInputHandler = guestOnMock.mock.calls.findLast(
      ([event]) => event === 'before-input-event'
    )?.[1] as
      | ((event: { preventDefault: () => void }, input: Record<string, unknown>) => void)
      | undefined

    expect(beforeInputHandler).toBeTypeOf('function')

    // Why: on Linux, Ctrl is the shortcut modifier, so Ctrl+R is the reload
    // shortcut (not a readline chord). Only test Ctrl+R as a readline passthrough
    // on macOS where Cmd is the modifier and Ctrl+R is genuinely a readline chord.
    const readlineChords = [
      ...(process.platform === 'darwin'
        ? [
            {
              type: 'keyDown',
              code: 'KeyR',
              key: 'r',
              meta: false,
              control: true,
              alt: false,
              shift: false
            }
          ]
        : []),
      {
        type: 'keyDown',
        code: 'KeyU',
        key: 'u',
        meta: false,
        control: true,
        alt: false,
        shift: false
      },
      {
        type: 'keyDown',
        code: 'KeyE',
        key: 'e',
        meta: false,
        control: true,
        alt: false,
        shift: false
      },
      {
        type: 'keyDown',
        code: 'KeyJ',
        key: 'j',
        meta: false,
        control: true,
        alt: false,
        shift: false
      }
    ]
    for (const input of readlineChords) {
      const preventDefault = vi.fn()
      beforeInputHandler?.({ preventDefault }, input)
      expect(preventDefault).not.toHaveBeenCalled()
    }

    expect(rendererSendMock).not.toHaveBeenCalled()
  })

  it('forwards browser guest page shortcuts to the renderer', () => {
    const isDarwin = process.platform === 'darwin'
    const rendererSendMock = vi.fn()
    const guest = {
      id: 406,
      isDestroyed: vi.fn(() => false),
      getType: vi.fn(() => 'webview'),
      setBackgroundThrottling: guestSetBackgroundThrottlingMock,
      setWindowOpenHandler: guestSetWindowOpenHandlerMock,
      on: guestOnMock,
      off: guestOffMock,
      openDevTools: guestOpenDevToolsMock
    }

    webContentsFromIdMock.mockImplementation((id: number) => {
      if (id === guest.id) {
        return guest
      }
      if (id === rendererWebContentsId) {
        return { isDestroyed: vi.fn(() => false), send: rendererSendMock }
      }
      return null
    })

    browserManager.attachGuestPolicies(guest as never)
    browserManager.registerGuest({
      browserPageId: 'browser-1',
      scopeId: 'scope-1',
      webContentsId: guest.id,
      rendererWebContentsId
    })

    const beforeInputHandler = guestOnMock.mock.calls.findLast(
      ([event]) => event === 'before-input-event'
    )?.[1] as
      | ((event: { preventDefault: () => void }, input: Record<string, unknown>) => void)
      | undefined

    expect(beforeInputHandler).toBeTypeOf('function')

    const inputs = [
      {
        type: 'keyDown',
        code: 'KeyL',
        key: 'l',
        meta: isDarwin,
        control: !isDarwin,
        alt: false,
        shift: false
      },
      {
        type: 'keyDown',
        code: 'KeyR',
        key: 'r',
        meta: isDarwin,
        control: !isDarwin,
        alt: false,
        shift: false
      },
      {
        type: 'keyDown',
        code: 'KeyR',
        key: 'r',
        meta: isDarwin,
        control: !isDarwin,
        alt: false,
        shift: true
      }
    ]

    for (const input of inputs) {
      const preventDefault = vi.fn()
      beforeInputHandler?.({ preventDefault }, input)
      expect(preventDefault).toHaveBeenCalledTimes(1)
    }

    expect(rendererSendMock).toHaveBeenNthCalledWith(1, 'browser:focusAddressBar', {
      browserPageId: 'browser-1'
    })
    expect(rendererSendMock).toHaveBeenNthCalledWith(2, 'browser:reloadPage', {
      browserPageId: 'browser-1'
    })
    expect(rendererSendMock).toHaveBeenNthCalledWith(3, 'browser:hardReloadPage', {
      browserPageId: 'browser-1'
    })
  })
})
