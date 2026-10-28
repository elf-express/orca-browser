import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, DragEvent, SetStateAction } from 'react'
import { cn } from '../../../lib/utils'
import { getLiveBrowserUrl } from '../describe-page/live-browser-url-registry'
import { resolveBrowserAddressBarSubmission } from '../navigate/browser-address-bar-navigation'
import { navigateBrowserPageToUrl } from '../navigate/navigate-browser-page-url'
import { useBrowserPageReloadActions } from '../navigate/use-browser-page-reload-actions'
import { useBrowserPageWebviewUrlSync } from '../navigate/use-browser-page-webview-url-sync'
import { useBrowserPageKeyboardShortcuts } from '../host-guest/use-browser-page-keyboard-shortcuts'
import { BrowserPageChromeHeader } from './browser-page-chrome-header'
import { useBrowserPageChromeFocus } from './use-browser-page-chrome-focus'
import { useWebviewGuestFocus } from './browser-page-guest-focus'
import type { BrowserPage as BrowserPageState } from '../../../../shared/browser-workspace-types'
import { DEFAULT_BROWSER_PAGE_ZOOM_LEVEL } from '../host-guest/browser-page-zoom'
import { ensureBrowserPageViewport } from '../host-guest/browser-page-viewport'
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
  chromeShortcutScope,
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

  const chromeHeaderRef = useRef<HTMLDivElement | null>(null)
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
  const isActiveRef = useRef(isActive)
  useLayoutEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])
  const paneZoomLevelRef = useRef(DEFAULT_BROWSER_PAGE_ZOOM_LEVEL)
  const handleInternalFileDragOverRef = useRef<(event: DragEvent<HTMLDivElement>) => void>(() => {})
  const handleInternalFileDropRef = useRef<(event: DragEvent<HTMLDivElement>) => void>(() => {})

  // The find bar and zoom indicator are not mounted yet; these keep the lifecycle contract intact.
  const setFindOpen = useCallback<Dispatch<SetStateAction<boolean>>>(() => {}, [])
  const setBrowserZoomPercent = useCallback<Dispatch<SetStateAction<number>>>(() => {}, [])
  const setBrowserDefaultZoomLevel = useCallback((): void => {}, [])
  const showBrowserZoomFeedback = useCallback((): void => {}, [])
  const setResourceNotice = useCallback((): void => {}, [])

  const [addressBarValue, setAddressBarValue] = useState(() => toDisplayUrl(browserTab.url))
  useEffect(() => {
    // An async URL update must not clobber a query the user is still typing; syncing resumes on blur.
    if (document.activeElement === addressBarInputRef.current) {
      return
    }
    setAddressBarValue(toDisplayUrl(browserTab.url))
  }, [browserTab.url])
  useEffect(() => {
    addressBarValueRef.current = addressBarValue
  }, [addressBarValue])

  const guestFocus = useWebviewGuestFocus(webviewRef)
  const {
    focusAddressBarNow,
    focusGuestNow: focusWebviewNow,
    keepAddressBarFocusRef
  } = useBrowserPageChromeFocus({
    browserTabId: browserTab.id,
    workspaceId,
    isActive,
    chromeShortcutScope,
    addressBarInputRef,
    guestFocus
  })

  const navigateToUrl = useCallback(
    (url: string): void => {
      navigateBrowserPageToUrl({
        url,
        browserTabId: browserTab.id,
        activeLoadFailureRef,
        lastKnownWebviewUrlRef,
        trackNextLoadingEventRef,
        recoveryNavigationValidationRef,
        webviewRef,
        onSetUrlRef,
        onUpdatePageStateRef,
        setAddressBarValue,
        setResourceNotice,
        focusWebviewNow
      })
    },
    [browserTab.id, focusWebviewNow, setResourceNotice]
  )
  const submitAddressBar = (): void => {
    keepAddressBarFocusRef.current = false
    const submission = resolveBrowserAddressBarSubmission(addressBarValue)
    if (submission.status === 'invalid') {
      onUpdatePageStateRef.current(browserTab.id, { loadError: submission.loadError })
      return
    }
    navigateToUrl(submission.url)
  }

  const webviewPartition = useBrowserPageWebviewPartition({ sessionProfileId, sessionPartition })

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
  useBrowserPageWebviewUrlSync({
    browserTabId: browserTab.id,
    browserTabUrl: browserTab.url,
    browserTabLoading: browserTab.loading,
    isActive,
    isPaintable,
    slotViewport,
    webviewRef,
    chromeHeaderRef,
    lastKnownWebviewUrlRef,
    trackNextLoadingEventRef,
    keepAddressBarFocusRef,
    addressBarInputRef,
    browserTabUrlRef,
    addressBarValueRef,
    onUpdatePageStateRef,
    focusWebviewNow
  })
  const reload = useBrowserPageReloadActions({
    browserTab,
    webviewRef,
    trackNextLoadingEventRef,
    retryGuestRecoveryRef,
    onUpdatePageStateRef
  })
  useBrowserPageKeyboardShortcuts({
    browserTabId: browserTab.id,
    workspaceId,
    isActive,
    chromeShortcutScope,
    isActiveRef,
    webviewRef,
    paneZoomLevelRef,
    setBrowserDefaultZoomLevel,
    showBrowserZoomFeedback,
    reloadWebviewOrRecoverGuest: reload.reloadWebviewOrRecoverGuest
  })

  // The live URL is cached by the navigation handlers before their store writes re-render the pane.
  const liveBrowserUrl = getLiveBrowserUrl(browserTab.id) ?? browserTab.url

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
    >
      <BrowserPageChromeHeader
        chromeHeaderRef={chromeHeaderRef}
        browserTab={browserTab}
        webviewRef={webviewRef}
        addressBarInputRef={addressBarInputRef}
        dismissAddressBarSuggestionsRef={dismissAddressBarSuggestionsRef}
        reload={reload}
        addressBarValue={addressBarValue}
        setAddressBarValue={setAddressBarValue}
        submitAddressBar={submitAddressBar}
        navigateToUrl={navigateToUrl}
        currentUrl={liveBrowserUrl}
      />
    </div>
  )
}
