import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('electron', () => ({ ipcRenderer: { invoke: mocks.invoke } }))

import { browserMcpApi } from './browser-mcp'

beforeEach(() => {
  mocks.invoke.mockReset()
})

describe('browser MCP preload api', () => {
  it.each([
    ['getEndpoint', 'browser:mcpGetEndpoint'],
    ['getStatus', 'browser:mcpGetStatus'],
    ['rotateToken', 'browser:mcpRotateToken']
  ] as const)('%s invokes %s', async (method, channel) => {
    await browserMcpApi[method]()

    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    expect(mocks.invoke).toHaveBeenCalledWith(channel)
  })
})
