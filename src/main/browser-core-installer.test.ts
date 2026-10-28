import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
  powerOn: vi.fn(),
  powerOff: vi.fn(),
  unregisterAll: vi.fn(),
  disposeWebviewSecurity: vi.fn(),
  installWebviewSecurity: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler },
  powerMonitor: { on: mocks.powerOn, removeListener: mocks.powerOff },
  clipboard: { writeText: vi.fn() },
  webContents: { fromId: vi.fn() }
}))

vi.mock('./browser/browser-manager', () => ({
  browserManager: { unregisterAll: mocks.unregisterAll }
}))

vi.mock('./window/main-window-webview-security', () => ({
  installWebviewSecurity: mocks.installWebviewSecurity
}))

import { BROWSER_INVOKE_CHANNELS } from '../shared/browser-ipc-channels'
import type { ResolvedBrowserPluginOptions } from './plugin-options'
import { installBrowserCore } from './browser-core-installer'

const send = vi.fn()
const mainWindow = { isDestroyed: () => false, webContents: { id: 91, send } }

const options = {
  host: {
    getMainWindow: () => mainWindow,
    userDataDir: '/tmp/user-data',
    resourcesPath: '/tmp/resources',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    openExternal: vi.fn(async () => {})
  },
  mcpPort: 47821
} as unknown as ResolvedBrowserPluginOptions

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
  send.mockReset()
  mocks.installWebviewSecurity.mockReturnValue(mocks.disposeWebviewSecurity)
})

describe('installBrowserCore', () => {
  it('registers every invoke channel', () => {
    installBrowserCore(options)

    expect(new Set(mocks.handle.mock.calls.map(([channel]) => channel))).toEqual(
      new Set(BROWSER_INVOKE_CHANNELS)
    )
  })

  it('removes handlers and guests on dispose', () => {
    const dispose = installBrowserCore(options)
    mocks.removeHandler.mockClear()

    expect(dispose).toBeTypeOf('function')
    ;(dispose as () => void)()

    for (const channel of BROWSER_INVOKE_CHANNELS) {
      expect(mocks.removeHandler.mock.calls.filter(([name]) => name === channel)).toHaveLength(1)
    }
    expect(mocks.unregisterAll).toHaveBeenCalledTimes(1)
    expect(mocks.disposeWebviewSecurity).toHaveBeenCalledTimes(1)
  })

  it('forwards system resume to the main window', () => {
    installBrowserCore(options)

    const resume = mocks.powerOn.mock.calls.find(([event]) => event === 'resume')?.[1] as () => void
    resume()

    expect(send).toHaveBeenCalledWith('browser:systemResumed')
  })

  it('stops forwarding system resume after dispose', () => {
    const dispose = installBrowserCore(options) as () => void
    const resume = mocks.powerOn.mock.calls.find(([event]) => event === 'resume')?.[1] as () => void

    dispose()

    expect(mocks.powerOff).toHaveBeenCalledWith('resume', resume)
  })
})
