import { describe, expect, it } from 'vitest'
import { browserAnnotationMatchesPageUrl } from './browser-annotation-page-url'

describe('browserAnnotationMatchesPageUrl', () => {
  it('matches the captured page ignoring query and fragment', () => {
    expect(
      browserAnnotationMatchesPageUrl('https://example.com/a', 'https://example.com/a?x=1#h')
    ).toBe(true)
    expect(browserAnnotationMatchesPageUrl('https://example.com/a', 'https://example.com/b')).toBe(
      false
    )
  })

  it('matches a page whose live URL carries credentials', () => {
    expect(
      browserAnnotationMatchesPageUrl(
        'https://example.com/a',
        'https://user:pass@example.com/a?x=1'
      )
    ).toBe(true)
    expect(
      browserAnnotationMatchesPageUrl('https://example.com/a', 'https://user@example.com/a')
    ).toBe(true)
  })

  it('ignores credentials on the captured side too', () => {
    expect(
      browserAnnotationMatchesPageUrl('https://user:pass@example.com/a', 'https://example.com/a')
    ).toBe(true)
  })
})
