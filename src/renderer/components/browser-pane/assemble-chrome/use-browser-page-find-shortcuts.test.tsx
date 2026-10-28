// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import type { Dispatch, SetStateAction } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserChromeShortcutScope } from '../describe-page/browser-page-types'
import { useBrowserPageFindShortcuts } from './use-browser-page-find-shortcuts'

// Why: Find is Cmd+F on macOS and Ctrl+F elsewhere, so the platform cannot be left to the runner.
const MAC_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'

function FindHarness({
  id,
  scope,
  setFindOpen
}: {
  id: string
  scope: BrowserChromeShortcutScope
  setFindOpen: Dispatch<SetStateAction<boolean>>
}): React.JSX.Element {
  useBrowserPageFindShortcuts({
    browserTabId: `page-${id}`,
    workspaceId: `workspace-${id}`,
    isActive: true,
    chromeShortcutScope: scope,
    setFindOpen
  })
  return (
    <div data-browser-overlay-tab-id={`workspace-${id}`}>
      <button type="button" data-testid={`toolbar-${id}`}>
        toolbar
      </button>
    </div>
  )
}

function renderSiblingPanes(scopeA: BrowserChromeShortcutScope) {
  const first = vi.fn()
  const second = vi.fn()
  render(
    <>
      <FindHarness id="a" scope={scopeA} setFindOpen={first} />
      <FindHarness id="b" scope="owned-target" setFindOpen={second} />
    </>
  )
  return { first, second }
}

function pressFind(testId: string): void {
  const target = document.querySelector(`[data-testid="${testId}"]`)
  act(() => {
    target?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true })
    )
  })
}

beforeEach(() => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: MAC_USER_AGENT })
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: { onFindInPage: () => () => {} }
  })
})

afterEach(() => {
  cleanup()
})

describe('useBrowserPageFindShortcuts', () => {
  it('opens find only in the owning pane for a chord from its chrome', () => {
    const { first, second } = renderSiblingPanes('inactive')

    pressFind('toolbar-b')

    expect(second).toHaveBeenCalledWith(true)
    expect(first).not.toHaveBeenCalled()
  })

  it('ignores a chord from another pane chrome when scoped to its own target', () => {
    const { first, second } = renderSiblingPanes('inactive')

    pressFind('toolbar-a')

    expect(second).not.toHaveBeenCalled()
    expect(first).not.toHaveBeenCalled()
  })

  it('answers a chord from anywhere when the pane is the focused one', () => {
    const { first, second } = renderSiblingPanes('focused')

    pressFind('toolbar-a')

    expect(first).toHaveBeenCalledWith(true)
    expect(second).not.toHaveBeenCalled()
  })
})
