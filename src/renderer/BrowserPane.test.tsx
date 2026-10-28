import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BrowserPane } from './BrowserPane'
import { BrowserPluginProvider } from './BrowserPluginProvider'
import type { BrowserRendererHost } from './host-context'
import { translate } from './i18n'

const host: BrowserRendererHost = { t: () => 'from host' }

describe('BrowserPane', () => {
  it('renders the pane placeholder for a scope', () => {
    const { container } = render(
      <BrowserPluginProvider host={host}>
        <BrowserPane scopeId="ws-1" active />
      </BrowserPluginProvider>
    )
    const pane = container.querySelector('[data-orca-browser-pane]')
    expect(pane).not.toBeNull()
    expect(pane?.getAttribute('data-scope-id')).toBe('ws-1')
    expect(pane?.getAttribute('data-active')).toBe('true')
  })

  it('throws outside BrowserPluginProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<BrowserPane scopeId="ws-1" active />)).toThrow(
        'orca-browser: BrowserPane must be rendered inside BrowserPluginProvider'
      )
    } finally {
      spy.mockRestore()
    }
  })

  it('sets and clears the translate host with the provider lifecycle', () => {
    const { unmount } = render(
      <BrowserPluginProvider host={host}>
        <BrowserPane scopeId="ws-1" active={false} />
      </BrowserPluginProvider>
    )
    expect(translate('a', 'b')).toBe('from host')
    unmount()
    expect(translate('a', 'b')).toBe('b')
  })
})
