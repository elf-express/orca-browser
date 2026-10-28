// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BrowserContextMenuDismissedEvent,
  BrowserContextMenuRequestedEvent
} from '../../../../shared/browser-guest-events'
import { useBrowserStore } from '../../../store/browser-store'
import { BrowserPageContextMenu } from './browser-page-context-menu'

const openDevTools = vi.fn(async () => true)
const openExternal = vi.fn(async () => true)
const writeClipboardText = vi.fn(async () => {})
let requested: ((event: BrowserContextMenuRequestedEvent) => void) | null = null
let dismissed: ((event: BrowserContextMenuDismissedEvent) => void) | null = null

function menuEvent(
  overrides: Partial<BrowserContextMenuRequestedEvent> = {}
): BrowserContextMenuRequestedEvent {
  return {
    browserPageId: 'p1',
    x: 10,
    y: 20,
    screenX: 10,
    screenY: 20,
    pageUrl: 'https://page.test/',
    linkUrl: null,
    selectionText: '',
    canGoBack: true,
    canGoForward: false,
    ...overrides
  }
}

function renderMenu(): void {
  render(
    <BrowserPageContextMenu
      browserPageId="p1"
      scopeId="ws-1"
      canGoBack
      canGoForward={false}
      webviewRef={createRef<Electron.WebviewTag>()}
      onReload={vi.fn()}
    />
  )
}

function openMenu(overrides: Partial<BrowserContextMenuRequestedEvent> = {}): void {
  act(() => {
    requested?.(menuEvent(overrides))
  })
}

beforeEach(() => {
  requested = null
  dismissed = null
  useBrowserStore.setState({ pagesByScope: {}, activePageIdByScope: {} })
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: {
      openDevTools,
      openExternal,
      writeClipboardText,
      onContextMenuRequested: (cb: typeof requested) => {
        requested = cb
        return () => {}
      },
      onContextMenuDismissed: (cb: typeof dismissed) => {
        dismissed = cb
        return () => {}
      }
    }
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BrowserPageContextMenu', () => {
  it('shows link items only when a link was right-clicked', () => {
    renderMenu()
    openMenu({ linkUrl: 'https://l.test/' })
    expect(screen.getByRole('menuitem', { name: 'Open Link in New Page' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Copy Link' })).toBeTruthy()

    act(() => {
      dismissed?.({ browserPageId: 'p1' })
    })
    openMenu({ linkUrl: null })
    expect(screen.queryByRole('menuitem', { name: 'Open Link in New Page' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Copy Link' })).toBeNull()
  })

  it('keeps the Orca labels for the default-browser items', () => {
    renderMenu()
    openMenu({ linkUrl: 'https://l.test/' })
    expect(screen.getByRole('menuitem', { name: 'Open Link In Default Browser' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Open Page In Default Browser' })).toBeTruthy()
  })

  it('copies the page URL', () => {
    renderMenu()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Page URL' }))
    expect(writeClipboardText).toHaveBeenCalledWith('https://page.test/')
  })

  it('opens devtools from Inspect Page', () => {
    renderMenu()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Inspect Page' }))
    expect(openDevTools).toHaveBeenCalledWith({ browserPageId: 'p1' })
  })

  it('opens a link as a new page in the same scope', () => {
    renderMenu()
    openMenu({ linkUrl: 'https://l.test/' })
    expect(useBrowserStore.getState().pagesByScope['ws-1'] ?? []).toHaveLength(0)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open Link in New Page' }))
    const pages = useBrowserStore.getState().pagesByScope['ws-1']
    expect(pages).toHaveLength(1)
    expect(pages[0].url).toBe('https://l.test/')
  })

  it('never opens a file link in a new page', () => {
    renderMenu()
    openMenu({ linkUrl: 'file:///etc/passwd' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open Link in New Page' }))
    expect(useBrowserStore.getState().pagesByScope['ws-1'] ?? []).toHaveLength(0)
  })

  it('ignores events for other pages', () => {
    renderMenu()
    openMenu({ browserPageId: 'other' })
    expect(screen.queryByTestId('browser-context-menu')).toBeNull()
  })

  it('closes on context-menu-dismissed', () => {
    renderMenu()
    openMenu()
    expect(screen.getByTestId('browser-context-menu')).toBeTruthy()
    act(() => {
      dismissed?.({ browserPageId: 'p1' })
    })
    expect(screen.queryByTestId('browser-context-menu')).toBeNull()
  })
})
