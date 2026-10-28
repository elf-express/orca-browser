import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { toastSuccess, toastError, toastWarning } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError, warning: toastWarning }
}))

import { DEFAULT_BROWSER_PLUGIN_SETTINGS } from '../../../../shared/browser-plugin-settings'
import { useBrowserSessionStore } from '../../../store/browser-session-store'
import { useBrowserStore } from '../../../store/browser-store'
import { TooltipProvider } from '../../../ui/tooltip'
import { BrowserToolbarMenu } from './BrowserToolbarMenu'

const defaultProfile = {
  id: 'default',
  scope: 'default' as const,
  partition: 'persist:orca-browser',
  label: 'Default',
  source: null
}
const workProfile = {
  id: 'p-work',
  scope: 'isolated' as const,
  partition: 'persist:orca-browser-session-p-work',
  label: 'Work',
  source: null
}

const session = {
  listProfiles: vi.fn(),
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  importCookies: vi.fn(),
  importFromBrowser: vi.fn(),
  detectBrowsers: vi.fn(),
  resolvePartition: vi.fn(),
  clearDefaultCookies: vi.fn()
}
const setViewportOverride = vi.fn()
const onDestroyWebview = vi.fn()
const switchBrowserTabProfile = vi.fn()
const setBrowserPageViewportPreset = vi.fn()

beforeEach(() => {
  for (const fn of Object.values(session)) {
    fn.mockReset()
  }
  session.listProfiles.mockResolvedValue([defaultProfile, workProfile])
  setViewportOverride.mockReset().mockResolvedValue(true)
  onDestroyWebview.mockReset()
  switchBrowserTabProfile.mockReset()
  setBrowserPageViewportPreset.mockReset()
  toastSuccess.mockReset()
  toastError.mockReset()
  toastWarning.mockReset()
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: { session, setViewportOverride }
  })
  useBrowserSessionStore.setState({
    browserSessionProfiles: [defaultProfile, workProfile],
    detectedBrowsers: [
      { family: 'chrome', label: 'Google Chrome', profiles: [], selectedProfile: 'Default' }
    ],
    detectedBrowsersLoaded: true,
    browserSessionImportState: null,
    settings: { ...DEFAULT_BROWSER_PLUGIN_SETTINGS },
    settingsLoaded: true,
    identity: null
  })
  useBrowserStore.setState({ switchBrowserTabProfile, setBrowserPageViewportPreset })
})

afterEach(cleanup)

function renderMenu(): ReturnType<typeof userEvent.setup> {
  const user = userEvent.setup()
  render(
    <TooltipProvider>
      <BrowserToolbarMenu
        currentProfileId={null}
        scopeId="ws-1"
        browserPageId="tab-1"
        viewportPresetId={null}
        onDestroyWebview={onDestroyWebview}
        isActive
        overflow={{
          triggerRef: createRef<HTMLButtonElement>(),
          tools: [],
          deferUntilClose: (action) => action(),
          onMenuCloseAutoFocus: vi.fn()
        }}
      />
    </TooltipProvider>
  )
  return user
}

async function openMenu(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Browser menu' }))
}

async function openImportMenu(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await openMenu(user)
  await user.click(await screen.findByText('Import Cookies'))
}

describe('BrowserToolbarMenu', () => {
  it('destroys the webview before switching profile', async () => {
    const user = renderMenu()
    await openMenu(user)

    await user.click(await screen.findByText('Work'))
    await user.click(await screen.findByRole('button', { name: 'Switch' }))

    expect(onDestroyWebview).toHaveBeenCalledTimes(1)
    expect(switchBrowserTabProfile).toHaveBeenCalledWith(
      'tab-1',
      'p-work',
      'persist:orca-browser-session-p-work'
    )
    expect(onDestroyWebview.mock.invocationCallOrder[0]).toBeLessThan(
      switchBrowserTabProfile.mock.invocationCallOrder[0]
    )
  })

  it('applies viewport preset', async () => {
    const user = renderMenu()
    await openMenu(user)
    await user.click(await screen.findByText('Viewport Size'))
    fireEvent.click(await screen.findByText('Tablet — 768 × 1024'))

    expect(setViewportOverride).toHaveBeenCalledWith({
      browserPageId: 'tab-1',
      override: { width: 768, height: 1024, deviceScaleFactor: 2, mobile: true }
    })
    expect(setBrowserPageViewportPreset).toHaveBeenCalledWith('tab-1', 'tablet')

    await openMenu(user)
    await user.click(await screen.findByText('Viewport Size'))
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Default' }))

    expect(setViewportOverride).toHaveBeenLastCalledWith({
      browserPageId: 'tab-1',
      override: null
    })
    expect(setBrowserPageViewportPreset).toHaveBeenLastCalledWith('tab-1', null)
  })

  it('shows import failure reason', async () => {
    session.importFromBrowser.mockResolvedValue({
      ok: false,
      reason: 'Browser not found on this system.'
    })
    const user = renderMenu()
    await openImportMenu(user)
    fireEvent.click(await screen.findByText('From Google Chrome'))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Browser not found on this system.')
    )
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('canceled file import shows nothing', async () => {
    session.importCookies.mockResolvedValue({ ok: false, reason: 'canceled' })
    const user = renderMenu()
    await openImportMenu(user)
    fireEvent.click(await screen.findByText('From File…'))

    await waitFor(() => expect(session.importCookies).toHaveBeenCalledTimes(1))
    expect(toastError).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('reports an undecryptable import as a warning, not a success', async () => {
    session.importFromBrowser.mockResolvedValue({
      ok: true,
      profileId: 'default',
      summary: {
        totalCookies: 3,
        importedCookies: 0,
        skippedCookies: 3,
        domains: [],
        warning: { code: 'cookies-undecryptable', failedCookies: 3, reason: 'app-bound-encryption' }
      }
    })
    const user = renderMenu()
    await openImportMenu(user)
    fireEvent.click(await screen.findByText('From Google Chrome'))

    await waitFor(() => expect(toastWarning).toHaveBeenCalledTimes(1))
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('creates profile and switches', async () => {
    session.createProfile.mockResolvedValue({
      id: 'p-qa',
      scope: 'isolated',
      partition: 'persist:orca-browser-session-p-qa',
      label: 'QA',
      source: null
    })
    const user = renderMenu()
    await openMenu(user)
    await user.click(await screen.findByText('New Profile…'))
    await user.type(await screen.findByPlaceholderText('Profile name'), 'QA')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(onDestroyWebview).toHaveBeenCalledTimes(1))
    expect(session.createProfile).toHaveBeenCalledWith({ scope: 'isolated', label: 'QA' })
    expect(switchBrowserTabProfile).toHaveBeenCalledWith(
      'tab-1',
      'p-qa',
      'persist:orca-browser-session-p-qa'
    )
  })
})
