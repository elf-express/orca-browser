// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserChromeToolbar } from './browser-chrome-toolbar'
import { BrowserPageToolbar } from './browser-page-toolbar'

const openDevTools = vi.fn(async () => true)
const openExternal = vi.fn(async () => true)

beforeEach(() => {
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: { openDevTools, openExternal }
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderToolbar(currentUrl = 'https://a.test/'): void {
  render(
    <BrowserPageToolbar
      browserPageId="p1"
      canGoBack
      canGoForward
      loading={false}
      currentUrl={currentUrl}
      webviewRef={createRef<Electron.WebviewTag>()}
      reloadMenuOpen={false}
      setReloadMenuOpen={vi.fn()}
      reloadButtonLabel="Reload"
      reloadButtonLabelKind="reload"
      reloadShortcut="Ctrl+R"
      hardReloadShortcut="Ctrl+Shift+R"
      runReloadTrigger={vi.fn()}
      addressBarValue={currentUrl}
      setAddressBarValue={vi.fn()}
      submitAddressBar={vi.fn()}
      navigateToUrl={vi.fn()}
      addressBarInputRef={createRef<HTMLInputElement>()}
      dismissAddressBarSuggestionsRef={createRef<(() => void) | null>()}
    />
  )
}

function documentOrder(elements: HTMLElement[]): number[] {
  return elements.map((element) => Array.from(document.querySelectorAll('*')).indexOf(element))
}

describe('BrowserPageToolbar', () => {
  it('renders the P1 tools in order', () => {
    renderToolbar()

    const ordered = [
      screen.getByRole('button', { name: 'Back' }),
      screen.getByRole('button', { name: 'Forward' }),
      screen.getByRole('button', { name: 'Reload' }),
      screen.getByRole('combobox'),
      screen.getByRole('button', { name: 'Open browser devtools' }),
      screen.getByRole('button', { name: 'Open in default browser' })
    ]
    const positions = documentOrder(ordered)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('opens devtools for the page', () => {
    renderToolbar()

    fireEvent.click(screen.getByRole('button', { name: 'Open browser devtools' }))

    expect(openDevTools).toHaveBeenCalledTimes(1)
    expect(openDevTools).toHaveBeenCalledWith({ browserPageId: 'p1' })
  })

  it('opens the current page in the default browser', () => {
    renderToolbar('https://a.test/')

    fireEvent.click(screen.getByRole('button', { name: 'Open in default browser' }))

    expect(openExternal).toHaveBeenCalledWith({ url: 'https://a.test/' })
  })

  it('disables open externally on a blank page', () => {
    renderToolbar('data:text/html,')

    const button = screen.getByRole('button', { name: 'Open in default browser' })
    expect(button).toHaveProperty('disabled', true)
    fireEvent.click(button)
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('renders slot controls when provided', () => {
    render(
      <BrowserChromeToolbar
        controls={{
          canGoBack: false,
          canGoForward: false,
          loading: false,
          goBack: vi.fn(),
          goForward: vi.fn(),
          reload: vi.fn(),
          navigate: vi.fn()
        }}
        addressSlot={<input aria-label="address" />}
        importControl={() => <button>imp</button>}
        viewSource={{ label: 'Open browser devtools', onSelect: vi.fn() }}
        openExternal={null}
        overflowMenu={() => <button>more</button>}
      />
    )

    const ordered = [
      screen.getByLabelText('address'),
      screen.getByRole('button', { name: 'imp' }),
      screen.getByRole('button', { name: 'Open browser devtools' }),
      screen.getByRole('button', { name: 'more' })
    ]
    const positions = documentOrder(ordered)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})
