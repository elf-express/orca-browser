import { useEffect, useState } from 'react'
import { useBrowserSessionStore } from '../../store/browser-session-store'
import { useBrowserStore } from '../../store/browser-store'
import { BrowserNewProfileDialog } from './BrowserNewProfileDialog'
import { BrowserSearchEngineSetting } from './BrowserSearchEngineSetting'
import { BrowserSessionCookiesSection } from './BrowserSessionCookiesSection'
import { BrowserUserAgentSetting } from './BrowserUserAgentSetting'

/** Browser preferences: default search engine, browser identity and session profiles. */
export function BrowserSettingsPanel(props: { scopeId?: string }): React.JSX.Element {
  const { scopeId } = props
  const searchEngine = useBrowserSessionStore((s) => s.settings.searchEngine)
  const updateSettings = useBrowserSessionStore((s) => s.updateSettings)
  const [newProfileDialogOpen, setNewProfileDialogOpen] = useState(false)

  const inUseProfileId = useBrowserStore((s) => {
    if (scopeId === undefined) {
      return undefined
    }
    const activePageId = s.activePageIdByScope[scopeId]
    const activePage = s.pagesByScope[scopeId]?.find((page) => page.id === activePageId)
    return activePage ? (activePage.sessionProfileId ?? 'default') : undefined
  })

  useEffect(() => {
    // Load only what the toolbar has not already loaded, so the panel also works standalone.
    const state = useBrowserSessionStore.getState()
    if (!state.settingsLoaded) {
      void state.loadSettings()
    }
    if (state.browserSessionProfiles.length === 0) {
      void state.fetchBrowserSessionProfiles()
    }
    if (state.identity === null) {
      void state.loadIdentity()
    }
  }, [])

  return (
    <div className="space-y-4">
      <BrowserSearchEngineSetting
        selectedSearchEngine={searchEngine}
        onSearchEngineChange={(engine) => void updateSettings({ searchEngine: engine })}
      />
      <BrowserUserAgentSetting />
      <BrowserSessionCookiesSection
        inUseProfileId={inUseProfileId}
        onAddProfile={() => setNewProfileDialogOpen(true)}
      />
      <BrowserNewProfileDialog open={newProfileDialogOpen} onOpenChange={setNewProfileDialogOpen} />
    </div>
  )
}
