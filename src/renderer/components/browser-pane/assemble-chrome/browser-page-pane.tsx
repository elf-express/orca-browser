import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../../lib/utils'
import { ORCA_BROWSER_BLANK_URL } from '../../../../shared/constants'
import { normalizeExternalBrowserUrl } from '../../../../shared/browser-url'
import { getLiveBrowserUrl } from '../describe-page/live-browser-url-registry'
import { resolveBrowserAddressBarSubmission } from '../navigate/browser-address-bar-navigation'
import { browserChromeShortcutOwnsEvent } from '../describe-page/browser-overlay-shortcut-target'
import { navigateBrowserPageToUrl } from '../navigate/navigate-browser-page-url'
import { useBrowserPageReloadActions } from '../navigate/use-browser-page-reload-actions'
import { useBrowserPageWebviewUrlSync } from '../navigate/use-browser-page-webview-url-sync'
import { useBrowserPageKeyboardShortcuts } from '../host-guest/use-browser-page-keyboard-shortcuts'
import { BrowserPageChromeHeader } from './browser-page-chrome-header'
import { useBrowserPageChromeFocus } from './use-browser-page-chrome-focus'
import { useWebviewGuestFocus } from './browser-page-guest-focus'
import type { BrowserPage as BrowserPageState } from '../../../../shared/browser-workspace-types'
import { getBrowserPageZoomIndicatorState } from '../host-guest/browser-page-zoom'
import {
  ensureBrowserPageViewport,
  scrollBrowserPageViewport,
  setBrowserPageViewportPresetSize
} from '../host-guest/browser-page-viewport'
import { getBrowserViewportPreset } from '../../../../shared/browser-viewport-presets'
import { useBrowserPageViewportScrollReporting } from '../host-guest/use-browser-page-viewport-scroll-reporting'
import { isBrowserPagePanePaintable } from '../host-guest/browser-page-paintability'
import { useBrowserPageSlotViewport } from '../host-guest/use-browser-page-slot-viewport'
import { useBrowserPageWebviewLifecycle } from '../host-guest/use-browser-page-webview-lifecycle'
import { useBrowserPageWebviewPartition } from '../host-guest/use-browser-page-webview-partition'
import { toDisplayUrl } from '../describe-page/browser-page-url-display'
import { useBrowserPageZoomFeedback } from '../host-guest/use-browser-page-zoom-feedback'
import { useBrowserPageResourceNotices } from '../navigate/use-browser-page-resource-notices'
import { useBrowserPageAnnotationSend } from '../annotate/use-browser-page-annotation-send'
import { useBrowserPageGrabAnnotations } from '../annotate/use-browser-page-grab-annotations'
import { useGrabMode } from '../annotate/useGrabMode'
import type { BrowserOverlayViewport } from '../describe-page/browser-annotation-geometry'
import { getRendererPlatform } from '../../../lib/platform'
import { isAnnotateChord } from '../annotate/browser-annotate-chord'
import { BrowserPageContextMenu } from './browser-page-context-menu'
import { BrowserPageViewportOverlays } from './browser-page-viewport-overlays'
import { useBrowserPageFindShortcuts } from './use-browser-page-find-shortcuts'
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
  const pageViewport = ensureBrowserPageViewport(browserTab.id, workspaceId)
  const pageViewportScroller = pageViewport?.scroller ?? null
  const pageViewportContainer = pageViewport?.container ?? null
  const containerRef = useRef<HTMLDivElement | null>(pageViewportContainer)
  useLayoutEffect(() => {
    containerRef.current = pageViewportContainer
  }, [pageViewportContainer])
  useLayoutEffect(() => {
    const preset = getBrowserViewportPreset(browserTab.viewportPresetId ?? null)
    setBrowserPageViewportPresetSize(
      browserTab.id,
      preset ? { width: preset.width, height: preset.height } : null
    )
  }, [browserTab.id, browserTab.viewportPresetId])
  useBrowserPageViewportScrollReporting(
    browserTab.id,
    pageViewportScroller,
    browserTab.viewportPresetId ?? null
  )
  useEffect(() => {
    const subscribe = window.browserAPI?.onScrollPage
    if (!subscribe || !pageViewportScroller || !browserTab.viewportPresetId) {
      return
    }
    return subscribe((event) => {
      if (event.browserPageId !== browserTab.id) {
        return
      }
      scrollBrowserPageViewport(browserTab.id, event.deltaX, event.deltaY)
    })
  }, [browserTab.id, browserTab.viewportPresetId, pageViewportScroller])

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
  const handleInternalFileDragOverRef = useRef<(event: DragEvent<HTMLDivElement>) => void>(() => {})
  const handleInternalFileDropRef = useRef<(event: DragEvent<HTMLDivElement>) => void>(() => {})

  const [findOpen, setFindOpen] = useState(false)
  const [browserOverlayViewport, setBrowserOverlayViewport] = useState<BrowserOverlayViewport>({
    scrollX: 0,
    scrollY: 0,
    version: 0
  })
  const zoom = useBrowserPageZoomFeedback(browserTab.id)
  const { resourceNotice, setResourceNotice } = useBrowserPageResourceNotices(browserTab.id)

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

  const annotationSend = useBrowserPageAnnotationSend({ browserTabId: browserTab.id, scopeId })
  const grab = useGrabMode(browserTab.id)
  const grabAnnotations = useBrowserPageGrabAnnotations({
    browserTabId: browserTab.id,
    isActive,
    grab,
    containerRef,
    trackingContainer: pageViewportContainer,
    trackingScroller: pageViewportScroller,
    webviewRef,
    setBrowserOverlayViewport,
    browserAnnotationsLength: annotationSend.browserAnnotations.length,
    setBrowserAnnotationTrayOpen: annotationSend.setBrowserAnnotationTrayOpen
  })
  const startGrabIntentRef = useRef(grabAnnotations.startGrabIntent)
  const handleGrabActionShortcutRef = useRef(grabAnnotations.handleGrabActionShortcut)
  useLayoutEffect(() => {
    startGrabIntentRef.current = grabAnnotations.startGrabIntent
    handleGrabActionShortcutRef.current = grabAnnotations.handleGrabActionShortcut
  }, [grabAnnotations.handleGrabActionShortcut, grabAnnotations.startGrabIntent])
  // Seam for the markup tool: while its overlay is open the picker must not start behind it.
  const markupIsActive = false
  const grabIsInteractive = grab.state !== 'idle' && grab.state !== 'error'

  // A focused guest keeps its key events; main forwards the grab and annotate chords with their intent.
  useEffect(() => {
    return window.browserAPI!.onGrabModeToggle((pageId, intent) => {
      if (pageId === browserTab.id && !markupIsActive) {
        startGrabIntentRef.current(intent)
      }
    })
  }, [browserTab.id, markupIsActive])
  useEffect(() => {
    if (!grabIsInteractive) {
      return
    }
    return window.browserAPI!.onGrabActionShortcut(({ browserPageId, key }) => {
      if (browserPageId === browserTab.id) {
        handleGrabActionShortcutRef.current(key)
      }
    })
  }, [browserTab.id, grabIsInteractive])

  // Annotate chord while the pane itself holds focus; the listener lives on the pane element so
  // it never sees keys typed elsewhere in the host window.
  const handlePaneKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      !isActive ||
      chromeShortcutScope === 'inactive' ||
      markupIsActive ||
      !isAnnotateChord(event, getRendererPlatform()) ||
      !browserChromeShortcutOwnsEvent(chromeShortcutScope, event.nativeEvent, workspaceId)
    ) {
      return
    }
    event.preventDefault()
    startGrabIntentRef.current('annotate')
  }

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
    cancelPendingBrowserCapture: grabAnnotations.cancelPendingBrowserCapture,
    setBrowserOverlayViewport,
    setFindOpen,
    focusAddressBarNow,
    focusWebviewNow,
    paneZoomLevelRef: zoom.paneZoomLevelRef,
    viewportPresetId: browserTab.viewportPresetId ?? null,
    setBrowserZoomPercent: zoom.setBrowserZoomPercent,
    pendingAnnotationPayload: grabAnnotations.pendingAnnotationPayload,
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
  useBrowserPageFindShortcuts({
    browserTabId: browserTab.id,
    workspaceId,
    isActive,
    chromeShortcutScope,
    setFindOpen
  })
  useBrowserPageKeyboardShortcuts({
    browserTabId: browserTab.id,
    workspaceId,
    isActive,
    chromeShortcutScope,
    isActiveRef,
    webviewRef,
    paneZoomLevelRef: zoom.paneZoomLevelRef,
    setBrowserDefaultZoomLevel: zoom.setBrowserDefaultZoomLevel,
    showBrowserZoomFeedback: zoom.showBrowserZoomFeedback,
    reloadWebviewOrRecoverGuest: reload.reloadWebviewOrRecoverGuest
  })

  // The live URL is cached by the navigation handlers before their store writes re-render the pane.
  const liveBrowserUrl = getLiveBrowserUrl(browserTab.id) ?? browserTab.url
  // A blank tab reads as 'about:blank' or the resolved data: URL, so match both.
  const isBlankTab = browserTab.url === 'about:blank' || browserTab.url === ORCA_BROWSER_BLANK_URL
  const currentBrowserUrl = toDisplayUrl(liveBrowserUrl)
  const failedNavigationUrl = browserTab.loadError?.validatedUrl ?? currentBrowserUrl
  const failureExternalUrl = normalizeExternalBrowserUrl(failedNavigationUrl)
  const showFailureOverlay = Boolean(browserTab.loadError) && !isBlankTab
  const browserZoomIndicatorState = getBrowserPageZoomIndicatorState({
    feedbackVisible: zoom.browserZoomFeedbackVisible,
    isDefaultZoom: zoom.browserZoomPercent === zoom.browserDefaultZoomPercent
  })

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) {
      return
    }
    // Electron webviews keep receiving native input under a React overlay unless their own hit testing is disabled.
    webview.style.pointerEvents = inputLocked ? 'none' : 'auto'
  }, [inputLocked])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) {
      return
    }
    // Some Electron builds keep painting a hidden guest layer, so drop it from layout (display:none) instead of just hiding it.
    webview.style.display = showFailureOverlay ? 'none' : 'flex'
  }, [showFailureOverlay])

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
      onKeyDown={handlePaneKeyDown}
    >
      {/* IPC-driven context menu in a Portal so position:fixed escapes ancestor transform/backdrop-filter containing blocks. */}
      <BrowserPageContextMenu
        browserPageId={browserTab.id}
        scopeId={scopeId}
        canGoBack={browserTab.canGoBack}
        canGoForward={browserTab.canGoForward}
        webviewRef={webviewRef}
        onReload={() => reload.reloadWebviewOrRecoverGuest(false)}
      />
      <BrowserPageChromeHeader
        chromeHeaderRef={chromeHeaderRef}
        browserTab={browserTab}
        isActive={isActive}
        webviewRef={webviewRef}
        addressBarInputRef={addressBarInputRef}
        dismissAddressBarSuggestionsRef={dismissAddressBarSuggestionsRef}
        reload={reload}
        addressBarValue={addressBarValue}
        setAddressBarValue={setAddressBarValue}
        submitAddressBar={submitAddressBar}
        navigateToUrl={navigateToUrl}
        currentUrl={liveBrowserUrl}
        grab={grab}
        grabAnnotations={grabAnnotations}
        annotationSend={annotationSend}
        isBlankTab={isBlankTab}
        resourceNotice={resourceNotice}
        setResourceNotice={setResourceNotice}
      />
      {pageViewport?.container
        ? createPortal(
            <BrowserPageViewportOverlays
              browserZoomIndicatorState={browserZoomIndicatorState}
              browserZoomPercent={zoom.browserZoomPercent}
              findOpen={findOpen}
              setFindOpen={setFindOpen}
              webviewRef={webviewRef}
              showFailureOverlay={showFailureOverlay}
              browserTab={browserTab}
              failureExternalUrl={failureExternalUrl}
              failedNavigationUrl={failedNavigationUrl}
              onUpdatePageStateRef={onUpdatePageStateRef}
              retryGuestRecoveryRef={retryGuestRecoveryRef}
              navigateToUrl={navigateToUrl}
              setResourceNotice={setResourceNotice}
              containerRef={containerRef}
              browserOverlayViewport={browserOverlayViewport}
              scopeId={scopeId}
              grab={grab}
              annotationSend={annotationSend}
              grabAnnotations={grabAnnotations}
            />,
            pageViewport.container
          )
        : null}
    </div>
  )
}
