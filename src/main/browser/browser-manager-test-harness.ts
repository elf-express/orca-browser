import { vi, type Mock } from 'vitest'
import { browserManager } from './browser-manager'

export const rendererWebContentsId = 5001
// Base (non-Firefox) UA a guest reports off the Google auth hosts.
export const guestBaseUserAgent = 'Mozilla/5.0 (Test) Chrome/140.0.0.0'

export type GuestUserAgentMethods = {
  getUserAgent: Mock<() => string>
  setUserAgent: Mock<(userAgent: string) => void>
  session: { getUserAgent: Mock<() => string> }
}

export const guestUaMethods = (): GuestUserAgentMethods => ({
  getUserAgent: vi.fn(() => guestBaseUserAgent),
  setUserAgent: vi.fn(),
  session: { getUserAgent: vi.fn(() => guestBaseUserAgent) }
})

// Why: vi.mock factories are hoisted per file, so every browser-manager test file declares its own
// vi.hoisted bundle; this is the shape they all produce.
export type BrowserManagerMocks = {
  appGetPathMock: Mock
  hostOpenExternalMock: Mock
  browserWindowFromWebContentsMock: Mock
  menuBuildFromTemplateMock: Mock
  guestOffMock: Mock
  guestOnMock: Mock
  guestSetBackgroundThrottlingMock: Mock
  guestSetWindowOpenHandlerMock: Mock
  guestOpenDevToolsMock: Mock
  webContentsFromIdMock: Mock
  screenGetCursorScreenPointMock: Mock
  openPopupWithOriginBarMock: Mock
}

export function resetBrowserManagerMocks(mocks: BrowserManagerMocks): void {
  mocks.appGetPathMock.mockReset()
  mocks.appGetPathMock.mockReturnValue('/downloads')
  mocks.hostOpenExternalMock.mockReset()
  mocks.browserWindowFromWebContentsMock.mockReset()
  mocks.menuBuildFromTemplateMock.mockReset()
  mocks.guestOffMock.mockReset()
  mocks.guestOnMock.mockReset()
  mocks.guestSetBackgroundThrottlingMock.mockReset()
  mocks.guestSetWindowOpenHandlerMock.mockReset()
  mocks.guestOpenDevToolsMock.mockReset()
  mocks.webContentsFromIdMock.mockReset()
  mocks.openPopupWithOriginBarMock.mockReset()
}

export function resetBrowserManagerState(): void {
  browserManager.unregisterAll()
  browserManager.setBrowserGuestStateChangedListener(null)
}
