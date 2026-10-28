import type { JSX } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrowserPluginProvider } from './BrowserPluginProvider'
import type { BrowserRendererHost } from './host-context'
import { translate } from './i18n'

function Probe(): JSX.Element {
  return <span data-testid="probe">{translate('a', 'fallback')}</span>
}

describe('BrowserPluginProvider', () => {
  it('translates through the host during the first child render', () => {
    const host: BrowserRendererHost = { t: () => 'from host' }
    const { getByTestId, unmount } = render(
      <BrowserPluginProvider host={host}>
        <Probe />
      </BrowserPluginProvider>
    )
    expect(getByTestId('probe').textContent).toBe('from host')
    unmount()
  })

  it('keeps the newer host when an older provider unmounts later', () => {
    const older: BrowserRendererHost = { t: () => 'older' }
    const newer: BrowserRendererHost = { t: () => 'newer' }
    const first = render(
      <BrowserPluginProvider host={older}>
        <span />
      </BrowserPluginProvider>
    )
    const second = render(
      <BrowserPluginProvider host={newer}>
        <span />
      </BrowserPluginProvider>
    )
    first.unmount()
    expect(translate('a', 'b')).toBe('newer')
    second.unmount()
    expect(translate('a', 'b')).toBe('b')
  })
})
