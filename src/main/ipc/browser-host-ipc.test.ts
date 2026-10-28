import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock, removeHandlerMock, writeTextMock, openExternalMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  writeTextMock: vi.fn(),
  openExternalMock: vi.fn(async () => {})
}))

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock, removeHandler: removeHandlerMock },
  clipboard: { writeText: writeTextMock }
}))

vi.mock('../plugin-runtime', () => ({
  getBrowserHost: () => ({
    getMainWindow: () => ({ webContents: { id: 91 } }),
    openExternal: openExternalMock
  })
}))

import { normalizeExternalBrowserUrl } from '../../shared/browser-url'
import { registerBrowserHostHandlers } from './browser-host-ipc'

type Handler = (event: { sender: Electron.WebContents }, arg: unknown) => unknown

function findHandler(channel: string): Handler {
  return handleMock.mock.calls.find(([name]) => name === channel)?.[1] as Handler
}

const trustedSender = {
  id: 91,
  isDestroyed: () => false,
  getType: () => 'window'
} as Electron.WebContents

const untrustedSender = {
  id: 92,
  isDestroyed: () => false,
  getType: () => 'window'
} as Electron.WebContents

beforeEach(() => {
  handleMock.mockReset()
  removeHandlerMock.mockReset()
  writeTextMock.mockReset()
  openExternalMock.mockClear()
  registerBrowserHostHandlers()
})

describe('browser host IPC', () => {
  it('opens a normalized web URL through the host', async () => {
    const result = await findHandler('browser:openExternal')(
      { sender: trustedSender },
      { url: 'https://example.com' }
    )

    expect(result).toBe(true)
    expect(openExternalMock).toHaveBeenCalledTimes(1)
    expect(openExternalMock).toHaveBeenCalledWith(
      normalizeExternalBrowserUrl('https://example.com')
    )
  })

  it('refuses non-web URLs', async () => {
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd']) {
      const result = await findHandler('browser:openExternal')({ sender: trustedSender }, { url })
      expect(result).toBe(false)
    }
    expect(openExternalMock).not.toHaveBeenCalled()
  })

  it('refuses untrusted senders', async () => {
    const result = await findHandler('browser:openExternal')(
      { sender: untrustedSender },
      { url: 'https://example.com' }
    )

    expect(result).toBe(false)
    expect(openExternalMock).not.toHaveBeenCalled()
  })

  it('writes clipboard text for the trusted renderer', async () => {
    await findHandler('browser:writeClipboardText')({ sender: trustedSender }, 'hello')
    expect(writeTextMock).toHaveBeenCalledWith('hello')
  })

  it('ignores clipboard writes from untrusted senders', async () => {
    await findHandler('browser:writeClipboardText')({ sender: untrustedSender }, 'hello')
    expect(writeTextMock).not.toHaveBeenCalled()
  })
})
