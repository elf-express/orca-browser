import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BrowserRendererHost } from './host-context'
import { setBrowserRendererHost, translate } from './i18n'

describe('translate', () => {
  afterEach(() => {
    setBrowserRendererHost(null)
  })

  it('interpolates the fallback when no host is set', () => {
    expect(translate('k', 'Hello {{name}}', { name: 'Ann' })).toBe('Hello Ann')
  })

  it('delegates to host.t with key, fallback and vars', () => {
    const t = vi.fn(() => 'host result')
    setBrowserRendererHost({ t } satisfies BrowserRendererHost)
    expect(translate('k', 'Hello {{name}}', { name: 'Ann' })).toBe('host result')
    expect(t).toHaveBeenCalledWith('k', 'Hello {{name}}', { name: 'Ann' })
  })

  it('falls back again after the host is cleared', () => {
    setBrowserRendererHost({ t: () => 'host result' })
    setBrowserRendererHost(null)
    expect(translate('k', 'Hello {{name}}', { name: 'Ann' })).toBe('Hello Ann')
  })
})
