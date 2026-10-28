// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBrowserPageKeyboardShortcuts } from './use-browser-page-keyboard-shortcuts'

let actionShortcutListeners: ((data: { browserPageId: string; key: 'c' | 's' }) => void)[] = []

function Harness({
  id,
  isActive = true,
  grabIsInteractive,
  onAction
}: {
  id: string
  isActive?: boolean
  grabIsInteractive: boolean
  onAction: (key: 'c' | 's') => void
}): React.JSX.Element {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook never reads the webview in these cases.
  const webviewRef = useRef({} as unknown as Electron.WebviewTag)
  const isActiveRef = useRef(isActive)
  const paneZoomLevelRef = useRef(0)
  useBrowserPageKeyboardShortcuts({
    browserTabId: id,
    workspaceId: `workspace-${id}`,
    isActive,
    chromeShortcutScope: 'focused',
    isActiveRef,
    webviewRef,
    paneZoomLevelRef,
    setBrowserDefaultZoomLevel: vi.fn(),
    showBrowserZoomFeedback: vi.fn(),
    reloadWebviewOrRecoverGuest: vi.fn(),
    grabIsInteractive,
    handleGrabActionShortcut: onAction
  })
  return <input data-testid="field" />
}

function press(target: EventTarget, init: KeyboardEventInit): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
  })
}

beforeEach(() => {
  actionShortcutListeners = []
  const inert = (): (() => void) => () => {}
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: {
      onHistoryNavigate: inert,
      onReloadPage: inert,
      onHardReloadPage: inert,
      onZoomPage: inert,
      onFindInPage: inert,
      onGrabActionShortcut: (callback: (typeof actionShortcutListeners)[number]) => {
        actionShortcutListeners.push(callback)
        return () => {
          actionShortcutListeners = actionShortcutListeners.filter((entry) => entry !== callback)
        }
      }
    }
  })
})
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'browserAPI')
})

describe('renderer-side grab action keys', () => {
  it('copies on C and screenshots on S while the grab is interactive', () => {
    const onAction = vi.fn()
    render(<Harness id="page-a" grabIsInteractive onAction={onAction} />)

    press(document.body, { key: 'c' })
    press(document.body, { key: 'S' })

    expect(onAction.mock.calls).toEqual([['c'], ['s']])
  })

  it('attaches no action-key listener and ignores C and S while idle', () => {
    const onAction = vi.fn()
    const add = vi.spyOn(window, 'addEventListener')
    render(<Harness id="page-a" grabIsInteractive={false} onAction={onAction} />)
    const idleKeydownCaptures = add.mock.calls.filter(
      ([type, , options]) => type === 'keydown' && options === true
    ).length

    press(document.body, { key: 'c' })
    press(document.body, { key: 's' })
    expect(onAction).not.toHaveBeenCalled()

    cleanup()
    add.mockClear()
    render(<Harness id="page-a" grabIsInteractive onAction={onAction} />)
    const activeKeydownCaptures = add.mock.calls.filter(
      ([type, , options]) => type === 'keydown' && options === true
    ).length
    expect(activeKeydownCaptures).toBe(idleKeydownCaptures + 1)
    add.mockRestore()
  })

  it('keeps editable targets and modified chords out of the action keys', () => {
    const onAction = vi.fn()
    const { getByTestId } = render(<Harness id="page-a" grabIsInteractive onAction={onAction} />)

    press(getByTestId('field'), { key: 'c' })
    press(document.body, { key: 'c', metaKey: true })
    press(document.body, { key: 'c', ctrlKey: true })
    press(document.body, { key: 's', altKey: true })
    press(document.body, { key: 'x' })

    expect(onAction).not.toHaveBeenCalled()
  })

  it('does nothing in an inactive pane', () => {
    const onAction = vi.fn()
    render(<Harness id="page-a" isActive={false} grabIsInteractive onAction={onAction} />)

    press(document.body, { key: 'c' })
    act(() =>
      actionShortcutListeners.forEach((listener) => listener({ browserPageId: 'page-a', key: 'c' }))
    )

    expect(onAction).not.toHaveBeenCalled()
  })

  it('handles the action key a focused guest forwarded, only for its own page', () => {
    const onAction = vi.fn()
    render(<Harness id="page-a" grabIsInteractive onAction={onAction} />)

    act(() =>
      actionShortcutListeners.forEach((listener) => listener({ browserPageId: 'page-b', key: 's' }))
    )
    act(() =>
      actionShortcutListeners.forEach((listener) => listener({ browserPageId: 'page-a', key: 's' }))
    )

    expect(onAction.mock.calls).toEqual([['s']])
  })
})
