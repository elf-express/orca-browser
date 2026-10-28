import { useState } from 'react'
import { toast } from 'sonner'
import { emitBrowserCookieImportToast } from '../../../lib/browser-cookie-import-toast'
import { useBrowserSessionStore } from '../../../store/browser-session-store'
import { useBrowserStore } from '../../../store/browser-store'
import { BrowserSettingsDialog } from '../../settings/BrowserSettingsDialog'
import { useMountedRef } from '../../../hooks/useMountedRef'
import type { BrowserViewportPresetId } from '../../../../shared/browser-workspace-types'
import {
  browserViewportPresetToOverride,
  getBrowserViewportPreset
} from '../../../../shared/browser-viewport-presets'
import { BrowserToolbarMenuDropdown } from './browser-toolbar-menu-dropdown'
import { BrowserToolbarProfileDialogs } from './browser-toolbar-profile-dialogs'
import { translate } from '../../../i18n'
import type { BrowserChromeOverflowMenuProps } from './browser-chrome-folded-tools'

type BrowserToolbarMenuProps = {
  currentProfileId: string | null
  scopeId: string
  browserPageId: string
  viewportPresetId: BrowserViewportPresetId | null
  onDestroyWebview: () => void
  isActive: boolean
  overflow: BrowserChromeOverflowMenuProps
}

export function BrowserToolbarMenu({
  currentProfileId,
  scopeId,
  browserPageId,
  viewportPresetId,
  onDestroyWebview,
  overflow
}: BrowserToolbarMenuProps): React.JSX.Element {
  const browserSessionProfiles = useBrowserSessionStore((s) => s.browserSessionProfiles)
  const detectedBrowsers = useBrowserSessionStore((s) => s.detectedBrowsers)
  const createBrowserSessionProfile = useBrowserSessionStore((s) => s.createBrowserSessionProfile)
  const importCookiesFromBrowser = useBrowserSessionStore((s) => s.importCookiesFromBrowser)
  const importCookiesToProfile = useBrowserSessionStore((s) => s.importCookiesToProfile)
  const fetchDetectedBrowsers = useBrowserSessionStore((s) => s.fetchDetectedBrowsers)
  const browserSessionImportState = useBrowserSessionStore((s) => s.browserSessionImportState)
  const switchBrowserTabProfile = useBrowserStore((s) => s.switchBrowserTabProfile)
  const setBrowserPageViewportPreset = useBrowserStore((s) => s.setBrowserPageViewportPreset)

  const applyViewportPreset = (nextId: BrowserViewportPresetId | null): void => {
    setBrowserPageViewportPreset(browserPageId, nextId)
    const preset = getBrowserViewportPreset(nextId)
    const override = preset ? browserViewportPresetToOverride(preset) : null
    void window.browserAPI!.setViewportOverride({ browserPageId, override })
  }

  const [newProfileDialogOpen, setNewProfileDialogOpen] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [isCreatingProfile, setIsCreatingProfile] = useState(false)
  const [pendingSwitchProfileId, setPendingSwitchProfileId] = useState<string | null | undefined>(
    undefined
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const mountedRef = useMountedRef()

  const handleNewProfileDialogOpenChange = (open: boolean): void => {
    setNewProfileDialogOpen(open)
    if (!open) {
      setNewProfileName('')
    }
  }

  const effectiveProfileId = currentProfileId ?? 'default'

  const defaultProfile = browserSessionProfiles.find((p) => p.id === 'default')
  // Why: Default profile always appears first in the list and cannot be deleted.
  // Non-default profiles follow in their natural order.
  const allProfiles = defaultProfile
    ? [defaultProfile, ...browserSessionProfiles.filter((p) => p.id !== 'default')]
    : browserSessionProfiles

  const handleSwitchProfile = (profileId: string | null): void => {
    const targetId = profileId ?? 'default'
    if (targetId === effectiveProfileId) {
      return
    }
    setPendingSwitchProfileId(profileId)
  }

  const confirmSwitchProfile = (): void => {
    if (pendingSwitchProfileId === undefined) {
      return
    }
    const targetId = pendingSwitchProfileId ?? 'default'
    const profile = browserSessionProfiles.find((p) => p.id === targetId)
    // Why: Must destroy before store update. The webviewRegistry is keyed by
    // workspace ID (stable across switches). Without explicit destroy, the mount
    // effect would reclaim the old webview with the stale partition.
    onDestroyWebview()
    // Why: persist the resolved partition alongside the profile so the tab stays
    // isolated even if the renderer profile mirror is later stale (issue #6923).
    switchBrowserTabProfile(browserPageId, pendingSwitchProfileId, profile?.partition ?? null)
    toast.success(
      translate(
        'auto.components.browser.pane.BrowserToolbarMenu.3ccd29d771',
        'Switched to {{value0}} profile',
        { value0: profile?.label ?? 'Default' }
      )
    )
    setPendingSwitchProfileId(undefined)
  }

  const handleCreateProfile = async (): Promise<void> => {
    const trimmed = newProfileName.trim()
    if (!trimmed) {
      return
    }

    setIsCreatingProfile(true)
    try {
      const profile = await createBrowserSessionProfile('isolated', trimmed)
      if (!profile) {
        if (mountedRef.current) {
          toast.error(
            translate(
              'auto.components.browser.pane.BrowserToolbarMenu.4d2f9f13a7',
              'Failed to create profile.'
            )
          )
        }
        return
      }

      if (!mountedRef.current) {
        return
      }

      setNewProfileDialogOpen(false)
      setNewProfileName('')

      onDestroyWebview()
      switchBrowserTabProfile(browserPageId, profile.id, profile.partition)
      toast.success(
        translate(
          'auto.components.browser.pane.BrowserToolbarMenu.a7a86702b3',
          'Created and switched to {{value0}} profile',
          { value0: profile.label }
        )
      )
    } finally {
      if (mountedRef.current) {
        setIsCreatingProfile(false)
      }
    }
  }

  const handleImportFromBrowser = async (
    browserFamily: string,
    browserProfile?: string
  ): Promise<void> => {
    const result = await importCookiesFromBrowser(effectiveProfileId, browserFamily, browserProfile)
    if (result.ok) {
      const browser = detectedBrowsers.find((b) => b.family === browserFamily)
      emitBrowserCookieImportToast(
        result.summary,
        browserProfile
          ? translate(
              'auto.components.browser.pane.BrowserToolbarMenu.c5f0e4d3b2a1',
              'Imported {{value0}} cookies from {{value1}} ({{value2}}).',
              {
                value0: result.summary.importedCookies,
                value1: browser?.label ?? browserFamily,
                value2: browserProfile
              }
            )
          : translate(
              'auto.components.browser.pane.BrowserToolbarMenu.d6a1f5e4c3b2',
              'Imported {{value0}} cookies from {{value1}}.',
              {
                value0: result.summary.importedCookies,
                value1: browser?.label ?? browserFamily
              }
            )
      )
    } else {
      toast.error(result.reason)
    }
  }

  const handleImportFromFile = async (): Promise<void> => {
    const result = await importCookiesToProfile(effectiveProfileId)
    if (result.ok) {
      emitBrowserCookieImportToast(
        result.summary,
        translate(
          'auto.components.browser.pane.BrowserToolbarMenu.53bbe3dab4',
          'Imported {{value0}} cookies from file.',
          { value0: result.summary.importedCookies }
        )
      )
    } else if (result.reason !== 'canceled') {
      toast.error(result.reason)
    }
  }

  return (
    <>
      <BrowserToolbarMenuDropdown
        onOpenSettings={() => setSettingsOpen(true)}
        allProfiles={allProfiles}
        effectiveProfileId={effectiveProfileId}
        onSwitchProfile={handleSwitchProfile}
        onNewProfile={() => setNewProfileDialogOpen(true)}
        detectedBrowsers={detectedBrowsers}
        onFetchDetectedBrowsers={() => void fetchDetectedBrowsers()}
        browserSessionImportState={browserSessionImportState}
        onImportFromBrowser={(browserFamily, browserProfile) =>
          void handleImportFromBrowser(browserFamily, browserProfile)
        }
        onImportFromFile={() => void handleImportFromFile()}
        viewportPresetId={viewportPresetId}
        onApplyViewportPreset={applyViewportPreset}
        overflow={overflow}
      />

      <BrowserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} scopeId={scopeId} />

      <BrowserToolbarProfileDialogs
        pendingSwitchProfileId={pendingSwitchProfileId}
        onPendingSwitchChange={() => setPendingSwitchProfileId(undefined)}
        onConfirmSwitch={confirmSwitchProfile}
        newProfileDialogOpen={newProfileDialogOpen}
        onNewProfileDialogOpenChange={handleNewProfileDialogOpenChange}
        newProfileName={newProfileName}
        onNewProfileNameChange={setNewProfileName}
        isCreatingProfile={isCreatingProfile}
        onCreateProfile={() => void handleCreateProfile()}
        onCancelNewProfile={() => {
          setNewProfileDialogOpen(false)
          setNewProfileName('')
        }}
      />
    </>
  )
}
