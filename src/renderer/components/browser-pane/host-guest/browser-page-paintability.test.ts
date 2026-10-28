import { describe, expect, it } from 'vitest'
import { isBrowserPagePanePaintable } from './browser-page-paintability'

const PARKED = {
  isActive: false
}

describe('isBrowserPagePanePaintable', () => {
  it.each([{ ...PARKED, isActive: true }])('keeps the pane paintable for %o', (state) => {
    expect(isBrowserPagePanePaintable(state)).toBe(true)
  })

  it('parks an inactive pane', () => {
    expect(isBrowserPagePanePaintable(PARKED)).toBe(false)
  })
})
