import { describe, expect, it } from 'vitest'
import {
  BROWSER_AGENT_IMAGE_NAMES,
  pngDataUrlToAgentImage,
  sanitizeAgentPageUrl
} from './agent-payload'

describe('sanitizeAgentPageUrl', () => {
  it('sanitizeAgentPageUrl strips query and hash', () => {
    expect(sanitizeAgentPageUrl('https://a.com/p?access_token=x#h')).toBe('https://a.com/p')
    expect(sanitizeAgentPageUrl('file:///C:/x.html?q=1')).toBe('file:///C:/x.html')
  })

  it('drops unsupported schemes and unparsable input', () => {
    expect(sanitizeAgentPageUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeAgentPageUrl('not a url')).toBe('')
    expect(sanitizeAgentPageUrl('')).toBe('')
  })

  it('strips URL credentials', () => {
    expect(sanitizeAgentPageUrl('https://user:pass@host/p?t=1')).toBe('https://host/p')
    expect(sanitizeAgentPageUrl('https://user@host/p')).toBe('https://host/p')
    expect(sanitizeAgentPageUrl('http://user:pass@host:8080/p#h')).toBe('http://host:8080/p')
  })

  it('keeps about:blank only', () => {
    expect(sanitizeAgentPageUrl('about:blank')).toBe('about:blank')
    expect(sanitizeAgentPageUrl('about:srcdoc')).toBe('')
  })
})

describe('pngDataUrlToAgentImage', () => {
  it('converts a png data url', () => {
    expect(pngDataUrlToAgentImage('a.png', 'data:image/png;base64,AAA')).toEqual({
      name: 'a.png',
      mimeType: 'image/png',
      dataBase64: 'AAA'
    })
  })

  it('rejects non-png and missing data', () => {
    expect(pngDataUrlToAgentImage('a.png', 'data:image/jpeg;base64,AAA')).toBeNull()
    expect(pngDataUrlToAgentImage('a.png', null)).toBeNull()
    expect(pngDataUrlToAgentImage('a.png', undefined)).toBeNull()
  })

  it('exposes the fixed image names', () => {
    expect(BROWSER_AGENT_IMAGE_NAMES).toEqual({
      grab: 'browser-grab.png',
      markup: 'browser-markup.png'
    })
  })
})
