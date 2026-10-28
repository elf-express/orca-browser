import { create } from 'zustand'
import {
  DEFAULT_BROWSER_PLUGIN_SETTINGS,
  type BrowserPluginSettings
} from '../../shared/browser-plugin-settings'
import type { DetectedBrowserPickerEntry } from '../../shared/browser-api-types'
import type {
  BrowserIdentityModeSetResult,
  BrowserIdentityModeStatus,
  BrowserUserAgentMode
} from '../../shared/browser-user-agent-mode'
import type {
  BrowserCookieImportResult,
  BrowserCookieImportSummary,
  BrowserSessionProfile
} from '../../shared/browser-workspace-types'

export type BrowserSessionImportState = {
  profileId: string
  status: 'importing' | 'success' | 'error'
  summary?: BrowserCookieImportSummary
  error?: string
}

export interface BrowserSessionStoreState {
  browserSessionProfiles: BrowserSessionProfile[]
  detectedBrowsers: DetectedBrowserPickerEntry[]
  detectedBrowsersLoaded: boolean
  browserSessionImportState: BrowserSessionImportState | null
  settings: BrowserPluginSettings
  settingsLoaded: boolean
  identity: BrowserIdentityModeStatus | null

  fetchBrowserSessionProfiles: () => Promise<void>
  createBrowserSessionProfile: (
    scope: 'isolated' | 'imported',
    label: string
  ) => Promise<BrowserSessionProfile | null>
  deleteBrowserSessionProfile: (profileId: string) => Promise<boolean>
  fetchDetectedBrowsers: () => Promise<void>
  importCookiesFromBrowser: (
    profileId: string,
    browserFamily: string,
    browserProfile?: string
  ) => Promise<BrowserCookieImportResult>
  importCookiesToProfile: (profileId: string) => Promise<BrowserCookieImportResult>
  clearDefaultSessionCookies: () => Promise<boolean>
  loadSettings: () => Promise<void>
  updateSettings: (patch: Partial<BrowserPluginSettings>) => Promise<void>
  loadIdentity: () => Promise<void>
  setIdentityMode: (mode: BrowserUserAgentMode) => Promise<BrowserIdentityModeSetResult | null>
}

function errorReason(error: unknown): string {
  return String((error as Error)?.message ?? error)
}

export const useBrowserSessionStore = create<BrowserSessionStoreState>()((set, get) => {
  // Runs one import, recording progress in the store and refreshing profiles after a success.
  const runImport = async (
    profileId: string,
    run: () => Promise<BrowserCookieImportResult>,
    options: { canceledIsSilent: boolean }
  ): Promise<BrowserCookieImportResult> => {
    set({ browserSessionImportState: { profileId, status: 'importing' } })
    try {
      const result = await run()
      if (result.ok) {
        set({
          browserSessionImportState: { profileId, status: 'success', summary: result.summary }
        })
        await get()
          .fetchBrowserSessionProfiles()
          .catch(() => {})
      } else if (options.canceledIsSilent && result.reason === 'canceled') {
        set({ browserSessionImportState: null })
      } else {
        set({
          browserSessionImportState: { profileId, status: 'error', error: result.reason }
        })
      }
      return result
    } catch (error) {
      const reason = errorReason(error)
      set({ browserSessionImportState: { profileId, status: 'error', error: reason } })
      return { ok: false, reason }
    }
  }

  return {
    browserSessionProfiles: [],
    detectedBrowsers: [],
    detectedBrowsersLoaded: false,
    browserSessionImportState: null,
    settings: { ...DEFAULT_BROWSER_PLUGIN_SETTINGS },
    settingsLoaded: false,
    identity: null,

    fetchBrowserSessionProfiles: async () => {
      try {
        const profiles = await window.browserAPI!.session.listProfiles()
        set({ browserSessionProfiles: profiles })
      } catch {
        /* best-effort: a stale profile list is preferable to a crash */
      }
    },

    createBrowserSessionProfile: async (scope, label) => {
      try {
        const profile = await window.browserAPI!.session.createProfile({ scope, label })
        if (profile) {
          set((state) => ({ browserSessionProfiles: [...state.browserSessionProfiles, profile] }))
        }
        return profile
      } catch {
        return null
      }
    },

    deleteBrowserSessionProfile: async (profileId) => {
      try {
        const deleted = await window.browserAPI!.session.deleteProfile({ profileId })
        if (deleted) {
          set((state) => ({
            browserSessionProfiles: state.browserSessionProfiles.filter(
              (profile) => profile.id !== profileId
            )
          }))
        }
        return deleted
      } catch {
        return false
      }
    },

    fetchDetectedBrowsers: async () => {
      if (get().detectedBrowsersLoaded) {
        return
      }
      try {
        const browsers = await window.browserAPI!.session.detectBrowsers()
        set({ detectedBrowsers: browsers, detectedBrowsersLoaded: true })
      } catch {
        set({ detectedBrowsers: [], detectedBrowsersLoaded: true })
      }
    },

    importCookiesFromBrowser: (profileId, browserFamily, browserProfile) =>
      runImport(
        profileId,
        () =>
          window.browserAPI!.session.importFromBrowser({
            profileId,
            browserFamily,
            browserProfile
          }),
        { canceledIsSilent: false }
      ),

    importCookiesToProfile: (profileId) =>
      runImport(profileId, () => window.browserAPI!.session.importCookies({ profileId }), {
        canceledIsSilent: true
      }),

    clearDefaultSessionCookies: async () => {
      try {
        const cleared = await window.browserAPI!.session.clearDefaultCookies()
        if (cleared) {
          await get().fetchBrowserSessionProfiles()
        }
        return cleared
      } catch {
        return false
      }
    },

    loadSettings: async () => {
      try {
        const settings = await window.browserAPI!.settings.get()
        set({ settings, settingsLoaded: true })
      } catch {
        /* best-effort: the defaults stay and the import hint stays hidden */
      }
    },

    updateSettings: async (patch) => {
      const previous = get().settings
      set({ settings: { ...previous, ...patch } })
      try {
        const next = await window.browserAPI!.settings.set(patch)
        set({ settings: next ?? previous })
      } catch {
        set({ settings: previous })
      }
    },

    loadIdentity: async () => {
      try {
        const identity = await window.browserAPI!.identity.get()
        set({ identity })
      } catch {
        /* best-effort: the identity row keeps showing its loading state */
      }
    },

    setIdentityMode: async (mode) => {
      const result = await window.browserAPI!.identity.set(mode)
      if (result?.ok) {
        set({ identity: { identity: result.identity, migrationNotice: null } })
      }
      return result
    }
  }
})
