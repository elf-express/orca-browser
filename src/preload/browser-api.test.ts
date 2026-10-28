import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))

vi.mock('electron', () => ({
  ipcRenderer: { invoke: mocks.invoke, on: mocks.on, removeListener: mocks.removeListener }
}))

import { createBrowserApi } from './browser-api'

const API_METHODS = [
  'registerGuest',
  'isGuestRegistered',
  'repairGuestRegistration',
  'unregisterGuest',
  'notifyActiveTabChanged',
  'openDevTools',
  'openExternal',
  'writeClipboardText',
  'onGuestLoadFailed',
  'onPermissionDenied',
  'onPopup',
  'onContextMenuRequested',
  'onContextMenuDismissed',
  'onOpenLinkInOrcaTab',
  'onFocusAddressBar',
  'onReloadPage',
  'onHardReloadPage',
  'onFindInPage',
  'onHistoryNavigate',
  'onZoomPage',
  'onSystemResumed'
]

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.removeListener.mockReset()
})

describe('createBrowserApi', () => {
  it('exposes exactly the api surface', () => {
    expect(Object.keys(createBrowserApi()).sort()).toEqual(['apiVersion', ...API_METHODS].sort())
  })

  it('notifies main of the active page', async () => {
    await createBrowserApi().notifyActiveTabChanged({ browserPageId: 'p1' })

    expect(mocks.invoke).toHaveBeenCalledWith('browser:activeTabChanged', { browserPageId: 'p1' })
  })

  it('invokes registerGuest over its channel', async () => {
    const args = { browserPageId: 'p1', scopeId: 's1', webContentsId: 7 }

    await createBrowserApi().registerGuest(args)

    expect(mocks.invoke).toHaveBeenCalledWith('browser:registerGuest', args)
  })

  it('subscribes and unsubscribes zoom commands', () => {
    const callback = vi.fn()

    const unsubscribe = createBrowserApi().onZoomPage(callback)

    expect(mocks.on).toHaveBeenCalledWith('browser:zoomPage', expect.any(Function))
    const listener = mocks.on.mock.calls.find(([channel]) => channel === 'browser:zoomPage')?.[1]
    unsubscribe()
    expect(mocks.removeListener).toHaveBeenCalledWith('browser:zoomPage', listener)
  })

  it('routes find commands to subscribers of the matching page', () => {
    const callback = vi.fn()
    const source = { browserPageId: 'p1', browserWorkspaceId: 'w1' }
    createBrowserApi().onFindInPage(source, callback)

    const listener = mocks.on.mock.calls.find(
      ([channel]) => channel === 'browser:findInPage'
    )?.[1] as (event: unknown, target: unknown) => void
    listener({}, { browserPageId: 'p1' })

    expect(callback).toHaveBeenCalledTimes(1)
  })
})
