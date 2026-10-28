import { describe, expect, it } from 'vitest'
import type { BrowserHost } from '../shared'
import { resolveBrowserPluginOptions } from './plugin-options'

const host = {} as BrowserHost

describe('resolveBrowserPluginOptions', () => {
  it('defaults the MCP port to 47821', () => {
    expect(resolveBrowserPluginOptions({ host }).mcpPort).toBe(47821)
  })

  it('keeps an explicit MCP port', () => {
    expect(resolveBrowserPluginOptions({ host, mcp: { port: 50000 } }).mcpPort).toBe(50000)
  })

  it.each([0, 80, 1023, 65536, 47821.5])('rejects MCP port %s', (port) => {
    expect(() => resolveBrowserPluginOptions({ host, mcp: { port } })).toThrow(RangeError)
    expect(() => resolveBrowserPluginOptions({ host, mcp: { port } })).toThrow(
      'orca-browser: mcp.port must be an integer between 1024 and 65535'
    )
  })
})
