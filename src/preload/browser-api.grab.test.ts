import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: mocks.invoke,
    send: mocks.send,
    on: mocks.on,
    removeListener: mocks.removeListener
  }
}))

import { createBrowserApi } from './browser-api'

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.on.mockReset()
  mocks.removeListener.mockReset()
})

describe('browser api grab members', () => {
  it('invokes setGrabMode over its channel', async () => {
    const args = { browserPageId: 'p1', enabled: true }

    await createBrowserApi().setGrabMode(args)

    expect(mocks.invoke).toHaveBeenCalledWith('browser:setGrabMode', args)
  })

  it('invokes the other grab channels with their arguments', async () => {
    const api = createBrowserApi()

    await api.awaitGrabSelection({ browserPageId: 'p1', opId: 'op' })
    await api.cancelGrab({ browserPageId: 'p1' })
    await api.captureSelectionScreenshot({
      browserPageId: 'p1',
      rect: { x: 0, y: 0, width: 1, height: 1 }
    })
    await api.extractHoverPayload({ browserPageId: 'p1' })

    expect(mocks.invoke.mock.calls.map(([channel]) => channel)).toEqual([
      'browser:awaitGrabSelection',
      'browser:cancelGrab',
      'browser:captureSelectionScreenshot',
      'browser:extractHoverPayload'
    ])
  })

  it('subscribes to grab mode toggles and unsubscribes with the same listener', () => {
    const cb = vi.fn()

    const dispose = createBrowserApi().onGrabModeToggle(cb)

    expect(mocks.on).toHaveBeenCalledWith('browser:grabModeToggle', expect.any(Function))
    const listener = mocks.on.mock.calls[0][1]
    listener({}, 'p1', 'copy')
    expect(cb).toHaveBeenCalledWith('p1', 'copy')

    dispose()
    expect(mocks.removeListener).toHaveBeenCalledWith('browser:grabModeToggle', listener)
  })

  it('subscribes to grab action shortcuts and unsubscribes with the same listener', () => {
    const cb = vi.fn()

    const dispose = createBrowserApi().onGrabActionShortcut(cb)

    expect(mocks.on).toHaveBeenCalledWith('browser:grabActionShortcut', expect.any(Function))
    const listener = mocks.on.mock.calls[0][1]
    listener({}, { browserPageId: 'p1', key: 's' })
    expect(cb).toHaveBeenCalledWith({ browserPageId: 'p1', key: 's' })

    dispose()
    expect(mocks.removeListener).toHaveBeenCalledWith('browser:grabActionShortcut', listener)
  })
})
