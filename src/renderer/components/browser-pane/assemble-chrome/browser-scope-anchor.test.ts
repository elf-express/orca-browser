import { describe, expect, it } from 'vitest'
import { browserScopeAnchorName } from './browser-scope-anchor'

describe('browserScopeAnchorName', () => {
  it('keeps letters, digits and dashes', () => {
    expect(browserScopeAnchorName('ws-1')).toBe('--orca-browser-ws-1')
  })

  it('escapes other characters as hex code points', () => {
    expect(browserScopeAnchorName('a.b')).toBe('--orca-browser-a_2eb')
    expect(browserScopeAnchorName('工')).toBe('--orca-browser-_5de5')
  })
})
