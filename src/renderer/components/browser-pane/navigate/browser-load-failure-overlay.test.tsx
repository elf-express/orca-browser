// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BrowserLoadFailureOverlay } from './browser-load-failure-overlay'
import { BROWSER_GUEST_RECOVERY_ERROR_CODE } from '../host-guest/browser-page-guest-recovery'

const callbacks = {
  onRetry: vi.fn(),
  onTryHttps: vi.fn(),
  onCopy: vi.fn(),
  onOpenExternal: vi.fn()
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BrowserLoadFailureOverlay', () => {
  it('offers HTTPS recovery only for an eligible failed HTTP address', () => {
    const { rerender } = render(
      <BrowserLoadFailureOverlay
        loadError={{
          code: -102,
          description: 'ERR_CONNECTION_REFUSED',
          validatedUrl: 'http://localhost:3000/app'
        }}
        externalUrl="http://localhost:3000/app"
        currentUrl="http://localhost:3000/app"
        httpsRecoveryUrl="https://localhost:3000/app"
        {...callbacks}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Try HTTPS' }))
    expect(callbacks.onTryHttps).toHaveBeenCalledWith('https://localhost:3000/app')

    rerender(
      <BrowserLoadFailureOverlay
        loadError={{
          code: -102,
          description: 'ERR_CONNECTION_REFUSED',
          validatedUrl: 'https://localhost:3000/app'
        }}
        externalUrl="https://localhost:3000/app"
        currentUrl="https://localhost:3000/app"
        httpsRecoveryUrl={null}
        {...callbacks}
      />
    )
    expect(screen.queryByRole('button', { name: 'Try HTTPS' })).toBeNull()
  })

  it('presents guest recovery failures without network troubleshooting', () => {
    render(
      <BrowserLoadFailureOverlay
        loadError={{
          code: BROWSER_GUEST_RECOVERY_ERROR_CODE,
          description: 'The browser page stopped unexpectedly. Retry to restore it.',
          validatedUrl: 'http://localhost:3000/app'
        }}
        externalUrl="http://localhost:3000/app"
        currentUrl="http://localhost:3000/app"
        httpsRecoveryUrl="https://localhost:3000/app"
        {...callbacks}
      />
    )

    expect(screen.getByText('Browser page stopped')).toBeInTheDocument()
    expect(
      screen.getByText('The browser page stopped unexpectedly. Retry to restore it.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/make sure the server is running/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try HTTPS' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('hides Open Externally and works without an external handler', () => {
    render(
      <BrowserLoadFailureOverlay
        loadError={{
          code: -202,
          description: 'ERR_CERT_AUTHORITY_INVALID',
          validatedUrl: 'https://localhost:3443/'
        }}
        currentUrl="https://localhost:3443/"
        httpsRecoveryUrl={null}
        onRetry={callbacks.onRetry}
        onTryHttps={callbacks.onTryHttps}
        onCopy={callbacks.onCopy}
      />
    )

    // externalUrl / onOpenExternal omitted:
    // the action is absent and the overlay still renders its other recovery UI.
    expect(screen.queryByRole('button', { name: 'Open Externally' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Copy Address' })).toBeEnabled()
  })

  it('runs Retry and Open Externally with the failed address', () => {
    render(
      <BrowserLoadFailureOverlay
        loadError={{
          code: -102,
          description: 'ERR_CONNECTION_REFUSED',
          validatedUrl: 'http://localhost:3000/app'
        }}
        externalUrl="http://localhost:3000/app"
        currentUrl="http://localhost:3000/app"
        httpsRecoveryUrl={null}
        {...callbacks}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Externally' }))
    expect(callbacks.onRetry).toHaveBeenCalledTimes(1)
    expect(callbacks.onOpenExternal).toHaveBeenCalledWith('http://localhost:3000/app')
  })
})
