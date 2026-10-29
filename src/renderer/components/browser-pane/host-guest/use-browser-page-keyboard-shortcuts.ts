import { useEffect, type MutableRefObject } from 'react'
import type { BrowserChromeShortcutScope } from '../describe-page/browser-page-types'
import { isEditableKeyboardTarget } from './browser-keyboard'
import { useBrowserPageWebviewShortcuts } from './use-browser-page-webview-shortcuts'

export function useBrowserPageKeyboardShortcuts({
  browserTabId,
  workspaceId,
  isActive,
  chromeShortcutScope,
  isActiveRef,
  webviewRef,
  paneZoomLevelRef,
  setBrowserDefaultZoomLevel,
  showBrowserZoomFeedback,
  reloadWebviewOrRecoverGuest,
  grabIsInteractive = false,
  handleGrabActionShortcut
}: {
  browserTabId: string
  workspaceId: string
  isActive: boolean
  chromeShortcutScope: BrowserChromeShortcutScope
  isActiveRef: MutableRefObject<boolean>
  webviewRef: MutableRefObject<Electron.WebviewTag | null>
  paneZoomLevelRef: MutableRefObject<number>
  setBrowserDefaultZoomLevel: (level: number) => void
  showBrowserZoomFeedback: (level: number) => void
  reloadWebviewOrRecoverGuest: (ignoreCache: boolean) => void
  /** True while the picker is armed or holds a selection; the C and S keys only exist then. */
  grabIsInteractive?: boolean
  handleGrabActionShortcut?: (key: 'c' | 's') => void
}): void {
  useBrowserPageWebviewShortcuts({
    browserTabId,
    workspaceId,
    isActive,
    chromeShortcutScope,
    isActiveRef,
    webviewRef,
    paneZoomLevelRef,
    setBrowserDefaultZoomLevel,
    showBrowserZoomFeedback,
    reloadWebviewOrRecoverGuest
  })

  // C copies and S screenshots the hovered element while the picker is interactive. The listener
  // exists only then, so an idle pane holds no extra key listener.
  useEffect(() => {
    if (!isActive || !grabIsInteractive || !handleGrabActionShortcut) {
      return
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (isEditableKeyboardTarget(e.target)) {
        return
      }
      // Modified chords belong to copy, paste and the like.
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return
      }
      const key = e.key.toLowerCase()
      if (key !== 'c' && key !== 's') {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      handleGrabActionShortcut(key)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [grabIsInteractive, handleGrabActionShortcut, isActive])

  // A focused guest keeps its key events; main forwards the action keys back.
  useEffect(() => {
    if (!isActive || !grabIsInteractive || !handleGrabActionShortcut) {
      return
    }
    return window.browserAPI!.onGrabActionShortcut(({ browserPageId, key }) => {
      if (browserPageId === browserTabId) {
        handleGrabActionShortcut(key)
      }
    })
  }, [browserTabId, grabIsInteractive, handleGrabActionShortcut, isActive])
}
