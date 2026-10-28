import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

import { resolveBrowserAddressBarSubmission } from './browser-address-bar-navigation'

describe('resolveBrowserAddressBarSubmission', () => {
  it.each([
    ['example.com:8443/docs', 'https://example.com:8443/docs'],
    ['app.localhost:3000', 'http://app.localhost:3000/']
  ])('submits %s as a navigation for local and client-hosted panes', (input, url) => {
    expect(resolveBrowserAddressBarSubmission(input)).toEqual({ status: 'navigate', url })
    expect(resolveBrowserAddressBarSubmission(input, { allowFileUrls: false })).toEqual({
      status: 'navigate',
      url
    })
  })

  it('falls back to the default search engine instead of parsing a query as a host', () => {
    expect(resolveBrowserAddressBarSubmission('google maps')).toEqual({
      status: 'navigate',
      url: 'https://www.google.com/search?q=google%20maps'
    })
  })

  it('reports unsupported schemes as an invalid-input failure rather than navigating', () => {
    expect(resolveBrowserAddressBarSubmission('javascript:alert(1)')).toEqual({
      status: 'invalid',
      loadError: {
        code: 0,
        description: 'Enter a valid http(s) or localhost URL.',
        validatedUrl: 'javascript:alert(1)'
      }
    })
  })

  it('treats blank input as the blank page rather than an error', () => {
    expect(resolveBrowserAddressBarSubmission('   ')).toMatchObject({ status: 'navigate' })
  })

  it('keeps file URLs navigable for the local browser pane', () => {
    expect(resolveBrowserAddressBarSubmission('/tmp/report.html')).toMatchObject({
      status: 'navigate',
      url: 'file:///tmp/report.html'
    })
  })

  it('explains the refusal instead of blanking the tab when a client-hosted page gets a file URL', () => {
    expect(
      resolveBrowserAddressBarSubmission('/tmp/report.html', { allowFileUrls: false })
    ).toEqual({
      status: 'invalid',
      loadError: {
        code: 0,
        description:
          'This browser tab cannot open local files. Use "Open Preview to the Side" on the file instead.',
        validatedUrl: '/tmp/report.html'
      }
    })
  })

  it('still navigates http(s) when file URLs are refused', () => {
    expect(
      resolveBrowserAddressBarSubmission('https://example.com', { allowFileUrls: false })
    ).toMatchObject({ status: 'navigate' })
  })
})
