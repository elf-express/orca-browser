import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}))

import { DEFAULT_BROWSER_PLUGIN_SETTINGS } from '../../../shared/browser-plugin-settings'
import type { BrowserPage } from '../../../shared/browser-workspace-types'
import { useBrowserSessionStore } from '../../store/browser-session-store'
import { useBrowserStore } from '../../store/browser-store'
import { BrowserSettingsPanel } from './BrowserSettingsPanel'

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
const identityStatus = {
  identity: {
    state: 'valid' as const,
    appliedMode: 'clean' as const,
    configuredMode: 'clean' as const,
    explicitSelection: false,
    migrationNoticePending: false,
    restartRequired: false
  },
  migrationNotice: null
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
const identity = { get: vi.fn(), set: vi.fn() }
const settings = { get: vi.fn(), set: vi.fn() }

function page(id: string, profileId: string | null): BrowserPage {
  return {
    id,
    scopeId: 'ws-1',
    url: 'about:blank',
    title: 'T',
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: 0,
    sessionProfileId: profileId,
    sessionPartition: null,
    viewportPresetId: null
  }
}

function seedLoadedStore(): void {
  useBrowserSessionStore.setState({
    browserSessionProfiles: [defaultProfile, workProfile],
    detectedBrowsers: [],
    detectedBrowsersLoaded: true,
    browserSessionImportState: null,
    settings: { ...DEFAULT_BROWSER_PLUGIN_SETTINGS },
    settingsLoaded: true,
    identity: identityStatus
  })
}

beforeEach(() => {
  for (const fn of [
    ...Object.values(session),
    ...Object.values(identity),
    ...Object.values(settings)
  ]) {
    fn.mockReset()
  }
  session.listProfiles.mockResolvedValue([])
  settings.get.mockResolvedValue({ ...DEFAULT_BROWSER_PLUGIN_SETTINGS })
  identity.get.mockResolvedValue(identityStatus)
  Object.defineProperty(window, 'browserAPI', {
    configurable: true,
    value: { session, identity, settings }
  })
  // Radix Select relies on pointer-capture and scroll APIs that jsdom lacks.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
  useBrowserStore.setState({ pagesByScope: {}, activePageIdByScope: {} })
})

afterEach(cleanup)

function rowOf(label: string): HTMLElement {
  const row = screen.getByText(label).closest('[data-profile-id]')
  if (!row) {
    throw new Error(`no row for ${label}`)
  }
  return row as HTMLElement
}

describe('BrowserSettingsPanel', () => {
  it('saves the chosen search engine', async () => {
    seedLoadedStore()
    settings.set.mockResolvedValue({ searchEngine: 'duckduckgo', importHintHidden: false })
    const user = userEvent.setup()
    render(<BrowserSettingsPanel />)

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'DuckDuckGo' }))

    expect(settings.set).toHaveBeenCalledWith({ searchEngine: 'duckduckgo' })
  })

  it('deletes a profile after confirmation', async () => {
    seedLoadedStore()
    session.deleteProfile.mockResolvedValue(true)
    const user = userEvent.setup()
    render(<BrowserSettingsPanel />)

    await user.click(within(rowOf('Work')).getByRole('button', { name: /delete/i }))
    await user.click(
      await within(await screen.findByRole('dialog')).findByRole('button', { name: /delete/i })
    )

    await waitFor(() => expect(session.deleteProfile).toHaveBeenCalledWith({ profileId: 'p-work' }))
  })

  it('offers no delete button on the default profile row', () => {
    seedLoadedStore()
    render(<BrowserSettingsPanel />)

    expect(within(rowOf('Default')).queryByRole('button', { name: /delete/i })).toBeNull()
  })

  it('marks the profile used by scopeId', () => {
    seedLoadedStore()
    useBrowserStore.setState({
      pagesByScope: { 'ws-1': [page('a', null), page('b', 'p-work')] },
      activePageIdByScope: { 'ws-1': 'b' }
    })
    render(<BrowserSettingsPanel scopeId="ws-1" />)

    expect(within(rowOf('Work')).getByText('In use')).toBeTruthy()
    expect(within(rowOf('Default')).queryByText('In use')).toBeNull()
  })

  it('shows no in-use marker without scopeId', () => {
    seedLoadedStore()
    useBrowserStore.setState({
      pagesByScope: { 'ws-1': [page('b', 'p-work')] },
      activePageIdByScope: { 'ws-1': 'b' }
    })
    render(<BrowserSettingsPanel />)

    expect(screen.queryByText('In use')).toBeNull()
  })

  it('loads data when rendered outside the toolbar', async () => {
    useBrowserSessionStore.setState({
      browserSessionProfiles: [],
      detectedBrowsers: [],
      detectedBrowsersLoaded: false,
      browserSessionImportState: null,
      settings: { ...DEFAULT_BROWSER_PLUGIN_SETTINGS },
      settingsLoaded: false,
      identity: null
    })
    render(<BrowserSettingsPanel />)

    await waitFor(() => {
      expect(session.listProfiles).toHaveBeenCalledTimes(1)
      expect(settings.get).toHaveBeenCalledTimes(1)
      expect(identity.get).toHaveBeenCalledTimes(1)
    })
  })
})
