import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
  trusted: vi.fn(),
  getEndpoint: vi.fn(),
  getStatus: vi.fn(),
  rotate: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler }
}))

vi.mock('./browser-renderer-trust', () => ({ isTrustedBrowserRenderer: mocks.trusted }))

vi.mock('../mcp/browser-mcp-runtime', () => ({
  getMcpEndpoint: mocks.getEndpoint,
  getMcpStatus: mocks.getStatus,
  rotateMcpToken: mocks.rotate
}))

import { BROWSER_MCP_INVOKE_CHANNELS } from '../../shared/browser-ipc-channels'
import { registerBrowserMcpHandlers, unregisterBrowserMcpHandlers } from './browser-mcp-ipc'

type Handler = (event: { sender: unknown }) => unknown

function handler(channel: string): Handler {
  return mocks.handle.mock.calls.find(([name]) => name === channel)?.[1] as Handler
}

const event = { sender: {} }

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
  registerBrowserMcpHandlers()
})

describe('browser MCP ipc', () => {
  it('getEndpoint returns the endpoint to the trusted main renderer', () => {
    const endpoint = { url: 'http://127.0.0.1:1/mcp', token: 'abc' }
    mocks.trusted.mockReturnValue(true)
    mocks.getEndpoint.mockReturnValue(endpoint)

    expect(handler('browser:mcpGetEndpoint')(event)).toEqual(endpoint)
  })

  it('getEndpoint returns null for an untrusted sender', () => {
    mocks.trusted.mockReturnValue(false)
    mocks.getEndpoint.mockReturnValue({ url: 'x', token: 'y' })

    expect(handler('browser:mcpGetEndpoint')(event)).toBeNull()
    expect(mocks.getEndpoint).not.toHaveBeenCalled()
  })

  it('getStatus returns the runtime status to the trusted main renderer', () => {
    mocks.trusted.mockReturnValue(true)
    mocks.getStatus.mockReturnValue({ state: 'listening', port: 5 })

    expect(handler('browser:mcpGetStatus')(event)).toEqual({ state: 'listening', port: 5 })
  })

  it('rotateToken rejects for an untrusted sender', async () => {
    mocks.trusted.mockReturnValue(false)

    await expect(async () => handler('browser:mcpRotateToken')(event)).rejects.toThrow(
      'Untrusted renderer'
    )
    expect(mocks.rotate).not.toHaveBeenCalled()
  })

  it('unregister removes every MCP handler', () => {
    mocks.removeHandler.mockClear()

    unregisterBrowserMcpHandlers()

    for (const channel of BROWSER_MCP_INVOKE_CHANNELS) {
      expect(mocks.removeHandler.mock.calls.filter(([c]) => c === channel)).toHaveLength(1)
    }
    expect(mocks.removeHandler).toHaveBeenCalledTimes(BROWSER_MCP_INVOKE_CHANNELS.length)
  })
})
