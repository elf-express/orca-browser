import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  webContentsFromIdMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/downloads' },
  BrowserWindow: { fromWebContents: vi.fn() },
  clipboard: { writeText: vi.fn() },
  Menu: { buildFromTemplate: vi.fn() },
  screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }) },
  webContents: { fromId: mocks.webContentsFromIdMock }
}))
vi.mock('./popup-origin-bar-window', () => ({ openPopupWithOriginBar: vi.fn() }))
vi.mock('../plugin-runtime', () => ({ getBrowserHost: () => ({ openExternal: vi.fn() }) }))

import { browserManager } from './browser-manager'

type FakeGuest = {
  id: number
  destroyed: boolean
  isDestroyed: () => boolean
  getType: () => string
  setBackgroundThrottling: ReturnType<typeof vi.fn>
  setWindowOpenHandler: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
}

function makeGuest(id: number): FakeGuest {
  const guest: FakeGuest = {
    id,
    destroyed: false,
    isDestroyed: () => guest.destroyed,
    getType: () => 'webview',
    setBackgroundThrottling: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
  return guest
}

function registerPage(guest: FakeGuest): void {
  mocks.webContentsFromIdMock.mockImplementation((id: number) => (id === guest.id ? guest : null))
  browserManager.attachGuestPolicies(guest as never)
  expect(
    browserManager.registerGuest({
      browserPageId: 'p1',
      scopeId: 'ws-1',
      webContentsId: guest.id,
      rendererWebContentsId: 1
    })
  ).toBe(true)
}

describe('browserManager.getAuthorizedGuest', () => {
  beforeEach(() => {
    browserManager.unregisterAll()
    mocks.webContentsFromIdMock.mockReset()
  })

  it('returns the guest for the renderer that registered the page', () => {
    const guest = makeGuest(100)
    registerPage(guest)

    expect(browserManager.getAuthorizedGuest('p1', 1)).toBe(guest)
  })

  it('refuses other renderers', () => {
    registerPage(makeGuest(100))

    expect(browserManager.getAuthorizedGuest('p1', 2)).toBeNull()
  })

  it('unregisters a destroyed guest', () => {
    const guest = makeGuest(100)
    registerPage(guest)
    guest.destroyed = true

    expect(browserManager.getAuthorizedGuest('p1', 1)).toBeNull()
    expect(browserManager.getGuestWebContentsId('p1')).toBeNull()
  })
})
