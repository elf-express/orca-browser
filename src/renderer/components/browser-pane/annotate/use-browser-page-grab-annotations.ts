import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from 'react'
import { toast } from 'sonner'
import { translate } from '../../../i18n'
import { useMountedRef } from '../../../hooks/useMountedRef'
import { useBrowserAnnotationStore } from '../../../store/browser-annotation-store'
import type {
  BrowserAnnotationIntent,
  BrowserGrabPayload,
  BrowserGrabScreenshot
} from '../../../../shared/browser-grab-types'
import { formatGrabPayloadAsText } from './GrabConfirmationSheet'
import { sanitizeAgentPageUrl } from '../../../../shared/agent-payload'
import { buildGrabAgentPayload, isSendToAgentCanceled, useSendToAgent } from './browser-agent-send'
import {
  createBrowserAnnotationId,
  createBrowserAnnotationPayload,
  DEFAULT_BROWSER_ANNOTATION_PRIORITY
} from '../describe-page/browser-annotation-geometry'
import { useBrowserPageAnnotationViewportTracking } from './use-browser-page-annotation-viewport-tracking'
import {
  copyGrabScreenshotToClipboard,
  runBrowserGrabActionShortcut
} from './browser-page-grab-action'
import type {
  BrowserPageGrabAnnotationsOptions,
  BrowserPageGrabToastState,
  GrabIntent
} from '../describe-page/browser-page-types'

const copiedGrabToastMessage = (): string =>
  translate(
    'auto.components.browser.pane.annotate.use.browser.page.grab.annotations.0c7b9b2b7a',
    'Copied'
  )
const screenshottedGrabToastMessage = (): string =>
  translate(
    'auto.components.browser.pane.annotate.use.browser.page.grab.annotations.c937229f19',
    'Screenshotted'
  )
const annotationAddedGrabToastMessage = (): string =>
  translate(
    'auto.components.browser.pane.annotate.use.browser.page.grab.annotations.1f5cb19034',
    'Annotation added'
  )

export function useBrowserPageGrabAnnotations({
  browserTabId,
  toolTargetId = browserTabId,
  isActive,
  grab,
  containerRef,
  trackingContainer,
  trackingScroller,
  webviewRef,
  setBrowserOverlayViewport,
  browserAnnotationsLength,
  setBrowserAnnotationTrayOpen,
  currentUrl
}: BrowserPageGrabAnnotationsOptions): {
  grabIntent: GrabIntent
  startGrabIntent: (nextIntent: GrabIntent) => void
  pendingAnnotationPayload: BrowserGrabPayload | null
  setPendingAnnotationPayload: Dispatch<SetStateAction<BrowserGrabPayload | null>>
  grabToast: BrowserPageGrabToastState | null
  setGrabToast: Dispatch<SetStateAction<BrowserPageGrabToastState | null>>
  grabToastTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | undefined>
  dismissGrabToast: () => void
  handleGrabCopy: () => void
  handleGrabCopyScreenshot: () => void
  /** Null when the host does not provide onSendToAgent. Resolves true once the host accepted the payload. */
  /** The payload shown in the send-to-agent review sheet; cleared when the grab ends or the page navigates. */
  grabReviewPayload: BrowserGrabPayload | null
  grabReviewSending: boolean
  openGrabReview: (payload: BrowserGrabPayload) => void
  /** Closes the review and resumes the picker when it is waiting on a confirmation. */
  closeGrabReview: () => void
  /** Sends the open review; closes it once the host accepted the payload. */
  handleSendGrabReview: () => Promise<void>
  handleGrabSendToAgent:
    | ((
        payload: BrowserGrabPayload,
        options?: { isReviewOpen?: () => boolean }
      ) => Promise<boolean>)
    | null
  grabMenuActionTakenRef: MutableRefObject<boolean>
  handleAddBrowserAnnotation: (comment: string, intent: BrowserAnnotationIntent) => void
  handleCancelPendingBrowserAnnotation: () => void
  cancelPendingBrowserCapture: () => void
  handleGrabActionShortcut: (key: 'c' | 's') => void
} {
  const mountedRef = useMountedRef()
  const toolTargetIdRef = useRef(toolTargetId)
  const grabToastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [grabIntent, setGrabIntent] = useState<GrabIntent>('copy')
  const grabIntentRef = useRef(grabIntent)
  const [pendingAnnotationPayload, setPendingAnnotationPayload] =
    useState<BrowserGrabPayload | null>(null)
  const pendingAnnotationPayloadRef = useRef<BrowserGrabPayload | null>(null)
  // Inline toast near the grabbed element (below, or above near the viewport bottom) so it doesn't occlude the selection.
  const [grabToast, setGrabToast] = useState<BrowserPageGrabToastState | null>(null)
  const grabRef = useRef(grab)
  const grabPayloadRef = useRef(grab.payload)
  const sendToAgent = useSendToAgent()
  const sendToAgentRef = useRef(sendToAgent)
  const grabSendInFlightRef = useRef(false)
  const grabReviewPayloadRef = useRef<BrowserGrabPayload | null>(null)
  const currentUrlRef = useRef(currentUrl)
  const [grabReviewPayload, setGrabReviewPayload] = useState<BrowserGrabPayload | null>(null)
  const [grabReviewSending, setGrabReviewSending] = useState(false)
  const grabReviewOpenRef = useRef(false)

  useLayoutEffect(() => {
    toolTargetIdRef.current = toolTargetId
    grabIntentRef.current = grabIntent
    pendingAnnotationPayloadRef.current = pendingAnnotationPayload
    grabRef.current = grab
    grabPayloadRef.current = grab.payload
    sendToAgentRef.current = sendToAgent
    currentUrlRef.current = currentUrl
    grabReviewPayloadRef.current = grabReviewPayload
  }, [
    grab,
    grabIntent,
    pendingAnnotationPayload,
    sendToAgent,
    toolTargetId,
    currentUrl,
    grabReviewPayload
  ])
  // Why: Radix fires onOpenChange(false) before onSelect, so this flag lets onOpenChange skip the rearm that would clear the payload first.
  const grabMenuActionTakenRef = useRef(false)
  const addBrowserPageAnnotation = useBrowserAnnotationStore((s) => s.addBrowserPageAnnotation)

  useEffect(() => () => clearTimeout(grabToastTimerRef.current), [])

  const dismissGrabToast = useCallback(() => {
    clearTimeout(grabToastTimerRef.current)
    setGrabToast(null)
    // Why: only rearm while 'confirming'; if a C/S shortcut already rearmed (state 'armed'), skip to avoid a double-rearm race.
    if (
      grabRef.current.state === 'confirming' &&
      !(grabIntentRef.current === 'annotate' && pendingAnnotationPayloadRef.current)
    ) {
      grabRef.current.rearm()
    }
  }, [])

  const showGrabToast = useCallback(
    (message: string, type: 'success' | 'error', payload?: BrowserGrabPayload | null) => {
      if (!mountedRef.current) {
        return
      }
      let x = 0
      let y = 0
      let below = true
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (payload) {
        const rect = payload.target.rectViewport
        const webview = webviewRef.current
        const webviewRect = webview?.getBoundingClientRect()
        const offsetX = (webviewRect?.left ?? 0) - (containerRect?.left ?? 0)
        const offsetY = (webviewRect?.top ?? 0) - (containerRect?.top ?? 0)
        x = offsetX + rect.x + rect.width / 2
        const elementBottom = offsetY + rect.y + rect.height
        const elementTop = offsetY + rect.y
        const containerHeight = containerRect?.height ?? 0
        // Show below the element unless it's too close to the bottom edge
        below = elementBottom + 52 < containerHeight
        y = below ? elementBottom : elementTop
      } else if (containerRect) {
        x = containerRect.width / 2
        y = containerRect.height / 2
      }
      clearTimeout(grabToastTimerRef.current)
      setGrabToast({ message, type, x, y, below, payload: payload ?? null })
      grabToastTimerRef.current = setTimeout(() => dismissGrabToast(), 2000)
    },
    [containerRef, dismissGrabToast, mountedRef, webviewRef]
  )

  // The picker supports clipboard copying and independently dismissible annotation drafts.
  useEffect(() => {
    if (grab.state !== 'confirming' || !grab.payload) {
      return
    }
    if (grabIntent === 'annotate') {
      // Loading may cancel the selection before React accepts this pending snapshot.
      setPendingAnnotationPayload(() =>
        grabPayloadRef.current === grab.payload ? grab.payload : null
      )
      // The live box measured for the previous selection must not place this one's card.
      setBrowserOverlayViewport((current) =>
        current.target ? { ...current, target: undefined } : current
      )
      return
    }
    if (!grab.contextMenu) {
      const text = formatGrabPayloadAsText(grab.payload)
      void window.browserAPI!.writeClipboardText(text)
      showGrabToast(copiedGrabToastMessage(), 'success', grab.payload)
    }
  }, [
    grab.state,
    grab.payload,
    grab.contextMenu,
    grabIntent,
    setBrowserOverlayViewport,
    showGrabToast
  ])

  /* oxlint-disable react/refs -- Intentional: the pane container is a stable element that tracking only observes. */
  useBrowserPageAnnotationViewportTracking({
    isActive,
    pendingAnnotation: pendingAnnotationPayload,
    annotationCount: browserAnnotationsLength,
    container: trackingContainer ?? containerRef.current,
    scroller:
      trackingScroller ??
      containerRef.current?.querySelector<HTMLDivElement>('[data-browser-page-scroller]') ??
      null,
    setBrowserOverlayViewport
  })
  /* oxlint-enable react/refs */

  const startGrabIntent = useCallback(
    (nextIntent: GrabIntent): void => {
      setGrabIntent(nextIntent)
      if (nextIntent === 'copy') {
        setPendingAnnotationPayload(null)
      } else {
        setBrowserAnnotationTrayOpen(true)
      }
      if (grab.state === 'idle' || grab.state === 'error' || grabIntent === nextIntent) {
        grab.toggle()
      }
    },
    [grab, grabIntent, setBrowserAnnotationTrayOpen]
  )

  // C / S copy the hovered element without clicking: extract via IPC while armed/awaiting, else use the captured payload.
  const handleGrabActionShortcut = useCallback(
    (key: 'c' | 's'): void => {
      runBrowserGrabActionShortcut({
        key,
        grabIntent,
        grab,
        grabPayloadRef,
        toolTargetIdRef,
        showGrabToast
      })
    },
    [grab, grabIntent, showGrabToast]
  )

  const handleGrabCopy = useCallback(() => {
    grabMenuActionTakenRef.current = true
    const payload = grabPayloadRef.current
    if (!payload) {
      return
    }
    const text = formatGrabPayloadAsText(payload)
    void window.browserAPI!.writeClipboardText(text)
    showGrabToast(copiedGrabToastMessage(), 'success', payload)
    grab.rearm()
  }, [grab, showGrabToast])

  const handleGrabCopyScreenshot = useCallback(() => {
    grabMenuActionTakenRef.current = true
    const payload = grabPayloadRef.current
    if (!payload) {
      return
    }
    const dataUrl = payload.screenshot?.dataUrl
    if (!dataUrl?.startsWith('data:image/png;base64,')) {
      return
    }
    void copyGrabScreenshotToClipboard(dataUrl)
    showGrabToast(screenshottedGrabToastMessage(), 'success', payload)
    grab.rearm()
  }, [grab, showGrabToast])

  const handleGrabSendToAgent = useCallback(
    async (
      payload: BrowserGrabPayload,
      options?: { isReviewOpen?: () => boolean }
    ): Promise<boolean> => {
      const send = sendToAgentRef.current
      if (!send || grabSendInFlightRef.current) {
        return false
      }
      grabSendInFlightRef.current = true
      try {
        let screenshot: BrowserGrabScreenshot | null = payload.screenshot
        const liveUrl = currentUrlRef.current
        const pageStillMatches =
          liveUrl === undefined ||
          sanitizeAgentPageUrl(liveUrl) === sanitizeAgentPageUrl(payload.page.sanitizedUrl)
        if (!pageStillMatches) {
          // The rect and any earlier image belong to the page that was grabbed, not the current one.
          screenshot = null
        } else {
          try {
            const result = await window.browserAPI!.captureSelectionScreenshot({
              browserPageId: toolTargetIdRef.current,
              rect: payload.target.rectViewport
            })
            if (result.ok) {
              screenshot = result.screenshot
            }
          } catch {
            // A destroyed guest still allows a text-only send.
          }
        }
        await send(buildGrabAgentPayload({ ...payload, screenshot }))
        // A review closed while the send was on its way must not tear down a picker the user resumed.
        if (options?.isReviewOpen?.() ?? true) {
          grabRef.current.exit()
        }
        return true
      } catch (error) {
        if (!isSendToAgentCanceled(error)) {
          toast.error(
            translate('auto.components.browser.pane.sendToAgent.failed', 'Could not send to agent')
          )
        }
        return false
      } finally {
        grabSendInFlightRef.current = false
      }
    },
    []
  )

  const updateGrabReview = useCallback((next: BrowserGrabPayload | null): void => {
    grabReviewOpenRef.current = next !== null
    setGrabReviewPayload(next)
  }, [])
  const openGrabReview = useCallback(
    (payload: BrowserGrabPayload): void => updateGrabReview(payload),
    [updateGrabReview]
  )
  const closeGrabReview = useCallback((): void => {
    updateGrabReview(null)
    if (grabRef.current.state === 'confirming') {
      grabRef.current.rearm()
    }
  }, [updateGrabReview])
  const handleSendGrabReview = useCallback(async (): Promise<void> => {
    const payload = grabReviewPayloadRef.current
    if (!payload || grabSendInFlightRef.current) {
      return
    }
    setGrabReviewSending(true)
    try {
      const sent = await handleGrabSendToAgent(payload, {
        isReviewOpen: () => grabReviewOpenRef.current
      })
      if (sent) {
        updateGrabReview(null)
      }
    } finally {
      setGrabReviewSending(false)
    }
  }, [handleGrabSendToAgent, updateGrabReview])

  // The review belongs to one grab: once the picker is idle again it has nothing left to send.
  useEffect(() => {
    if (grab.state === 'idle') {
      // oxlint-disable-next-line react/set-state-in-effect -- Intentional: the review must end with the grab, whatever ended it.
      updateGrabReview(null)
    }
  }, [grab.state, updateGrabReview])

  const handleAddBrowserAnnotation = useCallback(
    (comment: string, intent: BrowserAnnotationIntent): void => {
      const payload = pendingAnnotationPayloadRef.current
      if (!payload) {
        return
      }
      addBrowserPageAnnotation({
        id: createBrowserAnnotationId(),
        browserPageId: browserTabId,
        comment,
        intent,
        priority: DEFAULT_BROWSER_ANNOTATION_PRIORITY,
        createdAt: new Date().toISOString(),
        payload: createBrowserAnnotationPayload(payload)
      })
      pendingAnnotationPayloadRef.current = null
      setPendingAnnotationPayload(null)
      setBrowserAnnotationTrayOpen(true)
      showGrabToast(annotationAddedGrabToastMessage(), 'success', payload)
      grab.rearm()
    },
    [addBrowserPageAnnotation, browserTabId, grab, setBrowserAnnotationTrayOpen, showGrabToast]
  )

  const handleCancelPendingBrowserAnnotation = useCallback((): void => {
    pendingAnnotationPayloadRef.current = null
    setPendingAnnotationPayload(null)
    if (grabIntent === 'annotate' && grab.state === 'confirming') {
      grab.rearm()
    }
  }, [grab, grabIntent])

  const cancelPendingBrowserCapture = useCallback((): void => {
    grabRef.current.cancel()
    pendingAnnotationPayloadRef.current = null
    grabPayloadRef.current = null
    setPendingAnnotationPayload(null)
    updateGrabReview(null)
    clearTimeout(grabToastTimerRef.current)
    setGrabToast(null)
  }, [updateGrabReview])

  return {
    grabIntent,
    startGrabIntent,
    pendingAnnotationPayload,
    setPendingAnnotationPayload,
    grabToast,
    setGrabToast,
    grabToastTimerRef,
    dismissGrabToast,
    handleGrabCopy,
    handleGrabCopyScreenshot,
    grabReviewPayload,
    grabReviewSending,
    openGrabReview,
    closeGrabReview,
    handleSendGrabReview,
    handleGrabSendToAgent: sendToAgent ? handleGrabSendToAgent : null,
    grabMenuActionTakenRef,
    handleAddBrowserAnnotation,
    handleCancelPendingBrowserAnnotation,
    cancelPendingBrowserCapture,
    handleGrabActionShortcut
  }
}
