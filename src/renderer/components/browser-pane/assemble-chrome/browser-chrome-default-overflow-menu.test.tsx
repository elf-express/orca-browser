// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Share2 } from 'lucide-react'
import { BrowserChromeDefaultOverflowMenu } from './browser-chrome-folded-tools'

afterEach(cleanup)

describe('BrowserChromeDefaultOverflowMenu', () => {
  it('exposes the overflow trigger as a named button', () => {
    render(
      <BrowserChromeDefaultOverflowMenu
        triggerRef={createRef<HTMLButtonElement>()}
        tools={[{ stage: 'share', label: 'Share', icon: Share2, onSelect: vi.fn() }]}
        deferUntilClose={vi.fn()}
        onMenuCloseAutoFocus={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'More tools' })).toBeTruthy()
  })
})
