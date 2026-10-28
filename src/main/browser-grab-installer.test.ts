import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
  resetGrabModeState: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler },
  webContents: { fromId: vi.fn() }
}))

vi.mock('./browser/browser-manager', () => ({
  browserManager: {}
}))

vi.mock('./ipc/browser-grab-ipc', async (importActual) => {
  const actual = await importActual<typeof import('./ipc/browser-grab-ipc')>()
  return {
    ...actual,
    resetGrabModeState: () => {
      mocks.resetGrabModeState()
      actual.resetGrabModeState()
    }
  }
})

import { BROWSER_GRAB_INVOKE_CHANNELS } from '../shared/browser-ipc-channels'
import { installBrowserGrab } from './browser-grab-installer'
import type { ResolvedBrowserPluginOptions } from './plugin-options'

describe('installBrowserGrab', () => {
  beforeEach(() => {
    mocks.handle.mockReset()
    mocks.removeHandler.mockReset()
    mocks.resetGrabModeState.mockReset()
  })

  it('registers every grab channel', () => {
    installBrowserGrab({} as ResolvedBrowserPluginOptions)

    expect(new Set(mocks.handle.mock.calls.map(([channel]) => channel))).toEqual(
      new Set(BROWSER_GRAB_INVOKE_CHANNELS)
    )
  })

  it('removes grab handlers and resets grab state on dispose', async () => {
    const dispose = installBrowserGrab({} as ResolvedBrowserPluginOptions)
    mocks.removeHandler.mockClear()

    await dispose?.()

    for (const channel of BROWSER_GRAB_INVOKE_CHANNELS) {
      expect(mocks.removeHandler.mock.calls.filter(([c]) => c === channel)).toHaveLength(1)
    }
    expect(mocks.removeHandler).toHaveBeenCalledTimes(BROWSER_GRAB_INVOKE_CHANNELS.length)
    expect(mocks.resetGrabModeState).toHaveBeenCalledTimes(1)
  })
})
