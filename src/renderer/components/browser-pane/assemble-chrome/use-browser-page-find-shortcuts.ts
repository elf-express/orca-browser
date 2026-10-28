import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { browserChromeShortcutOwnsEvent } from '../describe-page/browser-overlay-shortcut-target'
import type { BrowserChromeShortcutScope } from '../describe-page/browser-page-types'
import { matchBrowserShortcutEvent } from '../host-guest/browser-keyboard'

export function useBrowserPageFindShortcuts({
  browserTabId,
  workspaceId,
  isActive,
  chromeShortcutScope,
  setFindOpen
}: {
  browserTabId: string
  workspaceId: string
  isActive: boolean
  chromeShortcutScope: BrowserChromeShortcutScope
  setFindOpen: Dispatch<SetStateAction<boolean>>
}): void {
  // Cmd/Ctrl+F — find in page (renderer path: focus on browser chrome)
  // Why: unlike bare C/S grab shortcuts, Cmd+F should always open find even from the address bar (matches Chrome/Safari).
  useEffect(() => {
    if (chromeShortcutScope === 'inactive') {
      return
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (matchBrowserShortcutEvent(e) !== 'browser.find') {
        return
      }
      if (!browserChromeShortcutOwnsEvent(chromeShortcutScope, e, workspaceId)) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      setFindOpen(true)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [chromeShortcutScope, setFindOpen, workspaceId])

  // Cmd/Ctrl+F — find in page (IPC path: focus inside webview guest)
  // Why: a focused guest is a separate Chromium process, so main forwards the chord back here.
  useEffect(() => {
    if (!isActive) {
      return
    }
    return window.browserAPI!.onFindInPage(
      { browserPageId: browserTabId, browserWorkspaceId: workspaceId },
      () => {
        setFindOpen(true)
      }
    )
  }, [browserTabId, isActive, setFindOpen, workspaceId])

  // Close find bar when tab is deactivated
  useEffect(() => {
    if (!isActive) {
      setFindOpen(false)
    }
  }, [isActive, setFindOpen])
}
