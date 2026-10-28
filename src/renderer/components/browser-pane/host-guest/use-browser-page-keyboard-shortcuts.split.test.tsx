// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type {
  BrowserHistoryNavigateCommand,
  BrowserPageCommandTarget
} from '../../../../shared/browser-page-command-target'
import type { BrowserPageZoomCommand } from '../../../../shared/browser-page-zoom'
import type { BrowserChromeShortcutScope } from '../describe-page/browser-page-types'
import { useBrowserPageKeyboardShortcuts } from './use-browser-page-keyboard-shortcuts'

// Why: the chords are Cmd on macOS and Ctrl elsewhere, so the platform cannot be left to the runner.
const MAC_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'

type PaneChannel<T> = {
  subscribe: (callback: (event: T) => void) => () => void
  emit: (event: T) => void
}

function paneChannel<T>(): PaneChannel<T> {
  let listeners: ((event: T) => void)[] = []
  return {
    subscribe: (callback) => {
      listeners.push(callback)
      return () => {
        listeners = listeners.filter((entry) => entry !== callback)
      }
    },
    emit: (event) => {
      for (const listener of listeners.slice()) {
        listener(event)
      }
    }
  }
}

type FakeWebview = {
  goBack: ReturnType<typeof vi.fn>
  goForward: ReturnType<typeof vi.fn>
  getZoomLevel: () => number
  setZoomLevel: ReturnType<typeof vi.fn>
}

type PaneSpies = {
  webview: FakeWebview
  reload: Mock<(ignoreCache: boolean) => void>
}

let historyNavigate = paneChannel<BrowserHistoryNavigateCommand>()
let reloadRequests = paneChannel<BrowserPageCommandTarget>()
let hardReloadRequests = paneChannel<BrowserPageCommandTarget>()
let zoomRequests = paneChannel<BrowserPageZoomCommand>()

function createSpies(): PaneSpies {
  return {
    webview: {
      goBack: vi.fn(),
      goForward: vi.fn(),
      getZoomLevel: () => 0,
      setZoomLevel: vi.fn()
    },
    reload: vi.fn()
  }
}

function PaneHarness({
  id,
  scope,
  spies
}: {
  id: 'a' | 'b'
  scope: BrowserChromeShortcutScope
  spies: PaneSpies
}): React.JSX.Element {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook only calls the history and zoom members the fake provides.
  const webviewRef = useRef(spies.webview as unknown as Electron.WebviewTag)
  const isActiveRef = useRef(true)
  const paneZoomLevelRef = useRef(0)
  useBrowserPageKeyboardShortcuts({
    browserTabId: `page-${id}`,
    workspaceId: `workspace-${id}`,
    isActive: true,
    chromeShortcutScope: scope,
    isActiveRef,
    webviewRef,
    paneZoomLevelRef,
    setBrowserDefaultZoomLevel: vi.fn(),
    showBrowserZoomFeedback: vi.fn(),
    reloadWebviewOrRecoverGuest: spies.reload
  })
  return (
    <div data-browser-overlay-tab-id={`workspace-${id}`}>
      <button type="button" data-testid={`toolbar-${id}`}>
        toolbar
      </button>
    </div>
  )
}

function renderSplit(scopeA: BrowserChromeShortcutScope, scopeB: BrowserChromeShortcutScope) {
  const a = createSpies()
  const b = createSpies()
  render(
    <>
      <PaneHarness id="a" scope={scopeA} spies={a} />
      <PaneHarness id="b" scope={scopeB} spies={b} />
    </>
  )
  return { a, b }
}

function byTestId(testId: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  if (!element) {
    throw new Error(`missing ${testId}`)
  }
  return element
}

function press(target: EventTarget, init: KeyboardEventInit): void {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { metaKey: true, bubbles: true, cancelable: true, ...init })
    )
  })
}

beforeEach(() => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: MAC_USER_AGENT })
  historyNavigate = paneChannel()
  reloadRequests = paneChannel()
  hardReloadRequests = paneChannel()
  zoomRequests = paneChannel()
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: {
      onHistoryNavigate: historyNavigate.subscribe,
      onReloadPage: reloadRequests.subscribe,
      onHardReloadPage: hardReloadRequests.subscribe,
      onZoomPage: zoomRequests.subscribe
    }
  })
})

afterEach(() => {
  window.getSelection()?.removeAllRanges()
  cleanup()
})

describe('useBrowserPageKeyboardShortcuts in a split of two active browser panes', () => {
  it('acts only in the pane whose guest forwarded the chord', () => {
    const { a, b } = renderSplit('focused', 'inactive')

    act(() => historyNavigate.emit({ browserPageId: 'page-b', direction: 'back' }))
    act(() => historyNavigate.emit({ browserPageId: 'page-b', direction: 'forward' }))
    act(() => reloadRequests.emit({ browserPageId: 'page-b' }))
    act(() => hardReloadRequests.emit({ browserPageId: 'page-b' }))
    act(() => zoomRequests.emit({ browserPageId: 'page-b', direction: 'in' }))

    expect(b.webview.goBack).toHaveBeenCalledTimes(1)
    expect(b.webview.goForward).toHaveBeenCalledTimes(1)
    expect(b.reload.mock.calls).toEqual([[false], [true]])
    expect(b.webview.setZoomLevel).toHaveBeenCalledTimes(1)
    expect(a.webview.goBack).not.toHaveBeenCalled()
    expect(a.webview.goForward).not.toHaveBeenCalled()
    expect(a.reload).not.toHaveBeenCalled()
    expect(a.webview.setZoomLevel).not.toHaveBeenCalled()
  })

  it('answers a chrome chord only in the focused split', () => {
    const { a, b } = renderSplit('focused', 'inactive')

    press(window, { key: '[', code: 'BracketLeft' })
    press(window, { key: 'r', code: 'KeyR' })

    expect(a.webview.goBack).toHaveBeenCalledTimes(1)
    expect(a.reload).toHaveBeenCalledWith(false)
    expect(b.webview.goBack).not.toHaveBeenCalled()
    expect(b.reload).not.toHaveBeenCalled()
  })

  it('answers a chrome chord only in the pane it came from when no split is focused', () => {
    const { a, b } = renderSplit('owned-target', 'owned-target')

    press(byTestId('toolbar-b'), { key: '[', code: 'BracketLeft' })
    press(byTestId('toolbar-b'), { key: 'r', code: 'KeyR' })

    expect(b.webview.goBack).toHaveBeenCalledTimes(1)
    expect(b.reload).toHaveBeenCalledTimes(1)
    expect(a.webview.goBack).not.toHaveBeenCalled()
    expect(a.reload).not.toHaveBeenCalled()
  })
})
