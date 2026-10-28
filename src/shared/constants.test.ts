import { describe, expect, it } from 'vitest'
import { BROWSER_API_GLOBAL_KEY, DEFAULT_MCP_PORT } from './constants'

describe('shared constants', () => {
  it('uses 47821 as the default MCP port', () => {
    expect(DEFAULT_MCP_PORT).toBe(47821)
  })

  it('exposes the api under window.browserAPI', () => {
    expect(BROWSER_API_GLOBAL_KEY).toBe('browserAPI')
  })
})
