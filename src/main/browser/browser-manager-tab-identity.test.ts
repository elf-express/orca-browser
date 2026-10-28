import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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
  openPopupWithOriginBarMock: vi.fn(),
  processUserAgentMode: 'clean',
  processUserAgent: ''
}))

vi.mock('../plugin-runtime', () => ({
  getBrowserHost: () => ({ openExternal: mocks.hostOpenExternalMock })
}))

vi.mock('electron', () => ({
  app: { getPath: mocks.appGetPathMock },
  BrowserWindow: { fromWebContents: mocks.browserWindowFromWebContentsMock },
  clipboard: { writeText: vi.fn() },
  Menu: { buildFromTemplate: mocks.menuBuildFromTemplateMock },
  screen: { getCursorScreenPoint: mocks.screenGetCursorScreenPointMock },
  webContents: { fromId: mocks.webContentsFromIdMock }
}))
vi.mock('./popup-origin-bar-window', () => ({
  openPopupWithOriginBar: mocks.openPopupWithOriginBarMock
}))
vi.mock('./browser-process-user-agent', () => ({
  getBrowserProcessUserAgentIdentity: () => ({
    mode: mocks.processUserAgentMode,
    userAgent: mocks.processUserAgent
  })
}))

import { browserManager } from './browser-manager'
import { googleAuthUserAgent } from './browser-google-auth-ua'
import {
  rendererWebContentsId,
  resetBrowserManagerMocks,
  resetBrowserManagerState
} from './browser-manager-test-harness'
import {
  createViewportGuestFactory,
  flushViewportOps,
  GUEST_CLEAN_UA,
  type ViewportGuestHandle
} from './browser-manager-viewport-test-fixtures'

const makeGuest = createViewportGuestFactory(mocks)
const guests = new Map<number, Record<string, unknown>>()
const ORDINARY_URL = 'https://example.com/'
const AUTH_URL = 'https://accounts.google.com/v3/signin/identifier'
let nextGuestId = 7000

type Observed = {
  presented: string
  standingOverride: Record<string, unknown> | null
  requestIdentity: ReturnType<typeof browserManager.resolveBrowserGuestRequestUserAgent>
}

/** Opens a tab on `url` the way a real load does: did-start-navigation runs before any preset. */
function openTab(url: string): { tab: string; id: number; handle: ViewportGuestHandle } {
  const id = nextGuestId++
  const tab = `tab-${id}`
  const handle = makeGuest(id, url)
  guests.set(id, handle.guest)
  browserManager.attachGuestPolicies(handle.guest as never)
  expect(
    browserManager.registerGuest({
      browserPageId: tab,
      scopeId: 'scope-1',
      webContentsId: id,
      rendererWebContentsId: rendererWebContentsId
    })
  ).toBe(true)
  navigate(url)
  return { tab, id, handle }
}

function navigate(url: string, { inPlace = false } = {}): void {
  const didStartNavigation = mocks.guestOnMock.mock.calls.findLast(
    ([event]) => event === 'did-start-navigation'
  )?.[1]
  expect(didStartNavigation).toBeTypeOf('function')
  didStartNavigation(null, url, inPlace, true)
}

function redirectTo(url: string): void {
  const willRedirect = mocks.guestOnMock.mock.calls.findLast(
    ([event]) => event === 'will-redirect'
  )?.[1]
  willRedirect({ preventDefault: vi.fn() }, url, false, true)
}

// A redirect target that fails: the one failed-load path whose restore could otherwise write the UA.
function failLoad(url: string): void {
  redirectTo(url)
  const didFailLoad = mocks.guestOnMock.mock.calls.findLast(
    ([event]) => event === 'did-fail-load'
  )?.[1]
  didFailLoad(null, -102, 'ERR_CONNECTION_REFUSED', url, true)
}

async function observe(
  { id, handle }: { id: number; handle: ViewportGuestHandle },
  url: string
): Promise<Observed> {
  await flushViewportOps()
  return {
    presented: handle.presentedUserAgent(),
    standingOverride: handle.standingUserAgentOverride(),
    requestIdentity: browserManager.resolveBrowserGuestRequestUserAgent({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resolver reads no Session member.
      session: handle.guest.session as Electron.Session,
      url,
      webContentsId: id
    })
  }
}

describe('tab identity ownership', () => {
  beforeEach(() => {
    resetBrowserManagerMocks(mocks)
    resetBrowserManagerState()
    guests.clear()
    mocks.webContentsFromIdMock.mockImplementation((id) => guests.get(id))
  })
  afterEach(() => {
    browserManager.unregisterAll()
    vi.restoreAllMocks()
  })

  // Why a table over every entry point: Chromium cancels a redirect, and reloads a loading document,
  // when the WebContents UA changes anywhere but a cross-document navigation start.
  it.each([
    ['a redirect', () => redirectTo(ORDINARY_URL)],
    ['a failed load', () => failLoad(ORDINARY_URL)],
    ['a same-document navigation', () => navigate(`${AUTH_URL}#step`, { inPlace: true })]
  ])(
    'writes the WebContents UA only at a cross-document navigation start, not on %s',
    async (_label, act) => {
      mocks.processUserAgentMode = 'clean'
      mocks.processUserAgent = GUEST_CLEAN_UA
      const opened = openTab(AUTH_URL)
      expect(opened.handle.guest.setUserAgent).toHaveBeenCalledOnce()

      act()
      await flushViewportOps()
      expect(opened.handle.guest.setUserAgent).toHaveBeenCalledOnce()

      navigate('https://example.org/')
      // Synchronous: the write must land inside did-start-navigation, before any await.
      expect(opened.handle.guest.setUserAgent).toHaveBeenCalledTimes(2)
      expect(opened.handle.webContentsUserAgent()).toBe(GUEST_CLEAN_UA)
    }
  )

  // Why: setUserAgent() while a document loads makes Chromium reload it, and an OAuth callback that
  // strips its code with replaceState would be requested twice — the one-time code replayed.
  it('leaves the WebContents UA alone on a same-document navigation', async () => {
    mocks.processUserAgentMode = 'clean'
    mocks.processUserAgent = GUEST_CLEAN_UA
    const opened = openTab(AUTH_URL)
    const willRedirect = mocks.guestOnMock.mock.calls.findLast(
      ([event]) => event === 'will-redirect'
    )?.[1]
    willRedirect({ preventDefault: vi.fn() }, `${ORDINARY_URL}callback?code=1`, false, true)
    await flushViewportOps()

    navigate(`${ORDINARY_URL}callback`, { inPlace: true })
    expect(opened.handle.webContentsUserAgent()).toBe(googleAuthUserAgent())
    expect((await observe(opened, ORDINARY_URL)).presented).toBe(GUEST_CLEAN_UA)

    navigate('https://example.org/')
    expect(opened.handle.webContentsUserAgent()).toBe(GUEST_CLEAN_UA)
  })

  // Why: a failed navigation commits an error page that is still loading at did-fail-load, and
  // setUserAgent() then makes Chromium reload it — the failed request replayed.
  it('leaves the WebContents UA alone when a redirected navigation fails', async () => {
    mocks.processUserAgentMode = 'clean'
    mocks.processUserAgent = GUEST_CLEAN_UA
    const opened = openTab(ORDINARY_URL)
    navigate(`${ORDINARY_URL}start`)
    const willRedirect = mocks.guestOnMock.mock.calls.findLast(
      ([event]) => event === 'will-redirect'
    )?.[1]
    willRedirect({ preventDefault: vi.fn() }, AUTH_URL, false, true)
    await flushViewportOps()

    opened.handle.commitNavigationTo(AUTH_URL)
    const didFailLoad = mocks.guestOnMock.mock.calls.findLast(
      ([event]) => event === 'did-fail-load'
    )?.[1]
    didFailLoad(null, -102, 'ERR_CONNECTION_REFUSED', AUTH_URL, true)
    expect(opened.handle.webContentsUserAgent()).toBe(GUEST_CLEAN_UA)
    const observed = await observe(opened, AUTH_URL)
    expect(observed.presented).toBe(googleAuthUserAgent())
    expect(observed.requestIdentity.kind).toBe('google-auth')
  })
})
