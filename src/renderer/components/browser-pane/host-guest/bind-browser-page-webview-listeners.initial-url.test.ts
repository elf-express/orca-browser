import { describe, expect, it } from 'vitest'
import { ORCA_BROWSER_BLANK_URL } from '../../../../shared/constants'
import { resolveInitialWebviewUrl } from './bind-browser-page-webview-listeners'

describe('resolveInitialWebviewUrl', () => {
  it('mounts a page created with a file: URL on the blank page', () => {
    expect(resolveInitialWebviewUrl('file:///etc/passwd')).toBe(ORCA_BROWSER_BLANK_URL)
    expect(resolveInitialWebviewUrl('/etc/passwd')).toBe(ORCA_BROWSER_BLANK_URL)
  })

  it('keeps an https URL and blanks an empty one', () => {
    expect(resolveInitialWebviewUrl('https://example.test/')).toBe('https://example.test/')
    expect(resolveInitialWebviewUrl('')).toBe(ORCA_BROWSER_BLANK_URL)
  })
})
