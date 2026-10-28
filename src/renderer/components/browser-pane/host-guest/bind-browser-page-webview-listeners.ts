import { isFileUrl, normalizeBrowserNavigationUrl } from '../../../../shared/browser-url'
import { ORCA_BROWSER_BLANK_URL } from '../../../../shared/constants'
import { parkBrowserPageViewport } from './browser-page-viewport'
import { subscribeBrowserSystemResume } from './browser-system-resume'
import {
  isBrowserPageRendererRecoveryPending,
  moveFocusToRendererBeforeWebviewDetach
} from './webview-registry'
import type { AttachBrowserPageWebviewArgs } from './attach-browser-page-webview'
import { createBrowserPageWebviewGuestSession } from './browser-page-webview-guest-session'
import { createBrowserPageWebviewLoadingHandlers } from './browser-page-webview-loading-handlers'
import { createBrowserPageWebviewNavigationHandlers } from './browser-page-webview-navigation-handlers'

/** The first src a guest gets: the page URL, or the blank page when it is unusable or a file: URL. */
export function resolveInitialWebviewUrl(rawUrl: string): string {
  const normalized = normalizeBrowserNavigationUrl(rawUrl)
  return normalized && !isFileUrl(normalized) ? normalized : ORCA_BROWSER_BLANK_URL
}

export function bindBrowserPageWebviewListeners({
  container,
  webview,
  needsInitialNavigation,
  onContainerDragOver,
  onContainerDrop,
  dismissAddressBarSuggestions,
  args
}: {
  container: HTMLDivElement
  webview: Electron.WebviewTag
  needsInitialNavigation: boolean
  onContainerDragOver: (event: globalThis.DragEvent) => void
  onContainerDrop: (event: globalThis.DragEvent) => void
  dismissAddressBarSuggestions: () => void
  args: AttachBrowserPageWebviewArgs
}): () => void {
  const {
    browserTabId,
    browserTabUrl,
    scopeId,
    sessionProfileId,
    webviewRef,
    isPaintableRef,
    guestRecoveryPendingRef,
    browserTabUrlRef,
    addressBarValueRef,
    activeLoadFailureRef,
    recoveryNavigationValidationRef,
    keepAddressBarFocusRef,
    paneZoomLevelRef,
    viewportPresetIdRef,
    onUpdatePageStateRef,
    setGuestRecoveryGeneration,
    setBrowserZoomPercent,
    focusAddressBarNow,
    syncNavigationState,
    faviconUrlRef,
    addressBarInputRef,
    lastKnownWebviewUrlRef,
    trackNextLoadingEventRef,
    onSetUrlRef,
    setAddressBarValue,
    addBrowserHistoryEntryRef,
    initialBrowserUrlRef,
    validateVisibleGuestRegistrationRef,
    retryGuestRecoveryRef,
    setFindOpen
  } = args

  const { guestRecovery, handleDidAttach, handleDomReady, handleGuestDestroyed } =
    createBrowserPageWebviewGuestSession({
      webview,
      browserTabId,
      scopeId,
      sessionProfileId,
      webviewRef,
      isPaintableRef,
      guestRecoveryPendingRef,
      browserTabUrlRef,
      addressBarValueRef,
      activeLoadFailureRef,
      recoveryNavigationValidationRef,
      keepAddressBarFocusRef,
      paneZoomLevelRef,
      viewportPresetIdRef,
      onUpdatePageStateRef,
      setGuestRecoveryGeneration,
      setBrowserZoomPercent,
      focusAddressBarNow,
      syncNavigationState
    })

  const { handleDidStartLoading, handleDidStopLoading, handleFailLoad } =
    createBrowserPageWebviewLoadingHandlers({
      webview,
      browserTabId,
      faviconUrlRef,
      browserTabUrlRef,
      addressBarValueRef,
      addressBarInputRef,
      activeLoadFailureRef,
      lastKnownWebviewUrlRef,
      trackNextLoadingEventRef,
      keepAddressBarFocusRef,
      recoveryNavigationValidationRef,
      onUpdatePageStateRef,
      onSetUrlRef,
      setAddressBarValue,
      focusAddressBarNow
    })

  const {
    handleDidStartNavigation,
    handleDidRedirectNavigation,
    handleFullDidNavigate,
    handleDidNavigateInPage,
    handleTitleUpdate,
    handleFaviconUpdate
  } = createBrowserPageWebviewNavigationHandlers({
    webview,
    browserTabId,
    browserTabUrl,
    recoveryNavigationValidationRef,
    activeLoadFailureRef,
    lastKnownWebviewUrlRef,
    addressBarInputRef,
    onSetUrlRef,
    onUpdatePageStateRef,
    addBrowserHistoryEntryRef,
    faviconUrlRef,
    setAddressBarValue
  })

  const unsubscribeSystemResumed = subscribeBrowserSystemResume(guestRecovery.validateAfterResume)
  validateVisibleGuestRegistrationRef.current = guestRecovery.validateAfterResume
  retryGuestRecoveryRef.current = guestRecovery.retryRecovery

  webview.addEventListener('did-attach', handleDidAttach)
  webview.addEventListener('dom-ready', handleDomReady)
  webview.addEventListener('render-process-gone', guestRecovery.recoverRenderer)
  webview.addEventListener('destroyed', handleGuestDestroyed)
  webview.addEventListener('focus', dismissAddressBarSuggestions)
  webview.addEventListener('did-start-loading', handleDidStartLoading)
  webview.addEventListener('did-start-navigation', handleDidStartNavigation)
  webview.addEventListener('did-redirect-navigation', handleDidRedirectNavigation)
  webview.addEventListener('did-stop-loading', handleDidStopLoading)
  // Why: close find only on full 'did-navigate', not the shared handler, which also fires on SPA in-page hash/pushState changes.
  const handleFindCloseOnNavigate = (): void => {
    setFindOpen(false)
  }

  webview.addEventListener('did-navigate', handleFullDidNavigate)
  webview.addEventListener('did-navigate', handleFindCloseOnNavigate)
  webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
  webview.addEventListener('page-title-updated', handleTitleUpdate)
  webview.addEventListener('page-favicon-updated', handleFaviconUpdate)
  webview.addEventListener('did-fail-load', handleFailLoad)

  if (needsInitialNavigation) {
    // Why: set src only after listeners attach so a fast localhost failure isn't missed; only non-blank tabs show the loading indicator.
    const initialUrl = resolveInitialWebviewUrl(initialBrowserUrlRef.current)
    trackNextLoadingEventRef.current = initialUrl !== ORCA_BROWSER_BLANK_URL
    lastKnownWebviewUrlRef.current = initialUrl
    webview.src = initialUrl
  } else if (isPaintableRef.current) {
    if (isBrowserPageRendererRecoveryPending(browserTabId)) {
      guestRecovery.recoverRenderer()
    } else {
      guestRecovery.validateAfterResume()
    }
  }

  return () => {
    webview.removeEventListener('did-attach', handleDidAttach)
    webview.removeEventListener('dom-ready', handleDomReady)
    webview.removeEventListener('render-process-gone', guestRecovery.recoverRenderer)
    webview.removeEventListener('destroyed', handleGuestDestroyed)
    webview.removeEventListener('focus', dismissAddressBarSuggestions)
    webview.removeEventListener('did-start-loading', handleDidStartLoading)
    webview.removeEventListener('did-start-navigation', handleDidStartNavigation)
    webview.removeEventListener('did-redirect-navigation', handleDidRedirectNavigation)
    webview.removeEventListener('did-stop-loading', handleDidStopLoading)
    webview.removeEventListener('did-navigate', handleFullDidNavigate)
    webview.removeEventListener('did-navigate', handleFindCloseOnNavigate)
    webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
    webview.removeEventListener('page-title-updated', handleTitleUpdate)
    webview.removeEventListener('page-favicon-updated', handleFaviconUpdate)
    webview.removeEventListener('did-fail-load', handleFailLoad)
    container.removeEventListener('dragover', onContainerDragOver)
    container.removeEventListener('drop', onContainerDrop)
    unsubscribeSystemResumed()
    guestRecovery.dispose()
    if (validateVisibleGuestRegistrationRef.current === guestRecovery.validateAfterResume) {
      validateVisibleGuestRegistrationRef.current = () => {}
    }
    if (retryGuestRecoveryRef.current === guestRecovery.retryRecovery) {
      retryGuestRecoveryRef.current = () => {}
    }

    if (webviewRef.current === webview) {
      webviewRef.current = null
    }

    // Why: park the viewport on chrome unmount (scope switch) to keep the guest alive; destroy only on explicit close.
    moveFocusToRendererBeforeWebviewDetach(webview)
    parkBrowserPageViewport(browserTabId)
  }
}
