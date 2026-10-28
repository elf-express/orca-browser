import { useCallback, useLayoutEffect, useRef } from 'react'
import type { Dispatch, DragEvent, SetStateAction } from 'react'
import { cn } from '../../../lib/utils'
import type { BrowserPage as BrowserPageState } from '../../../../shared/browser-workspace-types'
import { DEFAULT_BROWSER_PAGE_ZOOM_LEVEL } from '../host-guest/browser-page-zoom'
import {
  applyBrowserPageViewportLayout,
  ensureBrowserPageViewport
} from '../host-guest/browser-page-viewport'
import { isBrowserPagePanePaintable } from '../host-guest/browser-page-paintability'
import { useBrowserPageSlotViewport } from '../host-guest/use-browser-page-slot-viewport'
import { useBrowserPageWebviewLifecycle } from '../host-guest/use-browser-page-webview-lifecycle'
import { useBrowserPageWebviewPartition } from '../host-guest/use-browser-page-webview-partition'
import { toDisplayUrl } from '../describe-page/browser-page-url-display'
import type {
  BrowserChromeShortcutScope,
  BrowserPageRecoveryNavigationValidation,
  BrowserPageUrlSetter,
  BrowserTabPageState
} from '../describe-page/browser-page-types'

export function BrowserPagePane({
  browserTab,
  workspaceId,
  scopeId,
  sessionProfileId,
  sessionPartition,
  isActive,
  inputLocked,
  onUpdatePageState,
  onSetUrl
}: {
  browserTab: BrowserPageState
  workspaceId: string
  scopeId: string
  sessionProfileId: string | null
  sessionPartition: string | null
  isActive: boolean
  chromeShortcutScope: BrowserChromeShortcutScope
  inputLocked: boolean
  onUpdatePageState: (tabId: string, updates: BrowserTabPageState) => void
  onSetUrl: BrowserPageUrlSetter
}): React.JSX.Element {
  const isPaintable = isBrowserPagePanePaintable({ isActive })
  const slotViewport = useBrowserPageSlotViewport(workspaceId)
  // Creating the viewport during render makes it exist before the lifecycle effect attaches the guest.
  ensureBrowserPageViewport(browserTab.id, workspaceId)

  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const addressBarInputRef = useRef<HTMLInputElement | null>(null)
  const dismissAddressBarSuggestionsRef = useRef<(() => void) | null>(null)
  const addressBarValueRef = useRef(toDisplayUrl(browserTab.url))
  const browserTabUrlRef = useRef(browserTab.url)
  // Most-recent observed webview URL; URL sync checks it to avoid force-navigating to an intermediate redirect.
  const lastKnownWebviewUrlRef = useRef<string | null>(null)
  const trackNextLoadingEventRef = useRef(false)
  const recoveryNavigationValidationRef = useRef<BrowserPageRecoveryNavigationValidation | null>(
    null
  )
  const activeLoadFailureRef = useRef(browserTab.loadError)
  const retryGuestRecoveryRef = useRef<() => void>(() => {})
  const onUpdatePageStateRef = useRef(onUpdatePageState)
  const onSetUrlRef = useRef(onSetUrl)
  const keepAddressBarFocusRef = useRef(false)
  const paneZoomLevelRef = useRef(DEFAULT_BROWSER_PAGE_ZOOM_LEVEL)
  const handleInternalFileDragOverRef = useRef<(event: DragEvent<HTMLDivElement>) => void>(() => {})
  const handleInternalFileDropRef = useRef<(event: DragEvent<HTMLDivElement>) => void>(() => {})

  // The address bar and find bar are not mounted yet; these keep the lifecycle contract intact.
  const setAddressBarValue = useCallback<Dispatch<SetStateAction<string>>>((value) => {
    addressBarValueRef.current =
      typeof value === 'function' ? value(addressBarValueRef.current) : value
  }, [])
  const setFindOpen = useCallback<Dispatch<SetStateAction<boolean>>>(() => {}, [])
  const setBrowserZoomPercent = useCallback<Dispatch<SetStateAction<number>>>(() => {}, [])
  const focusAddressBarNow = useCallback((): boolean => false, [])
  const focusWebviewNow = useCallback((): boolean => {
    const webview = webviewRef.current
    if (!webview) {
      return false
    }
    try {
      webview.focus()
      return true
    } catch {
      return false
    }
  }, [])

  const webviewPartition = useBrowserPageWebviewPartition({ sessionProfileId, sessionPartition })

  useLayoutEffect(() => {
    applyBrowserPageViewportLayout(browserTab.id, { paintable: isPaintable, active: isActive })
    // Why: a replacement slot root needs visibility re-applied.
  }, [browserTab.id, isActive, isPaintable, slotViewport])

  useBrowserPageWebviewLifecycle({
    browserTabId: browserTab.id,
    browserTabUrl: browserTab.url,
    browserTabLoading: browserTab.loading,
    browserTabLoadError: browserTab.loadError,
    workspaceId,
    scopeId,
    sessionProfileId,
    webviewPartition,
    isActive,
    isPaintable,
    slotViewport,
    addressBarInputRef,
    addressBarValueRef,
    browserTabUrlRef,
    keepAddressBarFocusRef,
    handleInternalFileDragOverRef,
    handleInternalFileDropRef,
    dismissAddressBarSuggestionsRef,
    onUpdatePageState,
    onSetUrl,
    setAddressBarValue,
    setFindOpen,
    focusAddressBarNow,
    focusWebviewNow,
    paneZoomLevelRef,
    setBrowserZoomPercent,
    inputLocked,
    faviconUrl: browserTab.faviconUrl,
    webviewRef,
    lastKnownWebviewUrlRef,
    trackNextLoadingEventRef,
    recoveryNavigationValidationRef,
    activeLoadFailureRef,
    retryGuestRecoveryRef,
    onUpdatePageStateRef,
    onSetUrlRef
  })

  return (
    <div
      data-browser-page-pane-id={browserTab.id}
      className={cn(
        'absolute inset-0 flex min-h-0 flex-1 flex-col',
        isActive
          ? 'pointer-events-none z-10'
          : isPaintable
            ? 'pointer-events-none z-0 opacity-0'
            : 'pointer-events-none hidden'
      )}
      // Hidden panes stay paintable but must not stay keyboard-focusable.
      inert={!isActive}
      aria-hidden={!isActive}
    />
  )
}
