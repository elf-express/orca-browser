import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import { toast } from 'sonner'
import { translate } from '../../../i18n'
import { useBrowserAnnotationStore } from '../../../store/browser-annotation-store'
import type {
  BrowserAnnotationIntent,
  BrowserPageAnnotation
} from '../../../../shared/browser-grab-types'
import { formatBrowserAnnotationsAsMarkdown } from './browser-annotation-output'
import {
  buildAnnotationAgentPayload,
  isSendToAgentCanceled,
  useSendToAgent
} from './browser-agent-send'
import { EMPTY_BROWSER_ANNOTATIONS } from '../describe-page/browser-annotation-geometry'

export function useBrowserPageAnnotationSend({
  browserTabId
}: {
  browserTabId: string
  scopeId: string
}): {
  browserAnnotations: BrowserPageAnnotation[]
  browserAnnotationTrayOpen: boolean
  setBrowserAnnotationTrayOpen: Dispatch<SetStateAction<boolean>>
  browserAnnotationsCopied: boolean
  browserAnnotationsSending: boolean
  /** Null when the host does not provide onSendToAgent. */
  handleSendBrowserAnnotationsToAgent: (() => Promise<void>) | null
  handleCopyBrowserAnnotations: () => void
  handleClearBrowserAnnotations: () => void
  handleDeleteBrowserAnnotation: (annotationId: string) => void
  handleUpdateBrowserAnnotation: (
    annotationId: string,
    comment: string,
    intent: BrowserAnnotationIntent
  ) => void
} {
  const browserAnnotations = useBrowserAnnotationStore(
    (s) => s.browserAnnotationsByPageId[browserTabId] ?? EMPTY_BROWSER_ANNOTATIONS
  )
  const browserAnnotationsRef = useRef(browserAnnotations)
  const [browserAnnotationTrayOpen, setBrowserAnnotationTrayOpen] = useState(true)
  const [browserAnnotationsCopied, setBrowserAnnotationsCopied] = useState(false)
  const [browserAnnotationsSending, setBrowserAnnotationsSending] = useState(false)
  const sendInFlightRef = useRef(false)
  const annotationCopyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const copyPrompt = useMemo(
    () => formatBrowserAnnotationsAsMarkdown(browserAnnotations),
    [browserAnnotations]
  )
  const sendToAgent = useSendToAgent()
  const sendToAgentRef = useRef(sendToAgent)
  const deleteBrowserPageAnnotation = useBrowserAnnotationStore(
    (s) => s.deleteBrowserPageAnnotation
  )
  const updateBrowserPageAnnotation = useBrowserAnnotationStore(
    (s) => s.updateBrowserPageAnnotation
  )
  const clearBrowserPageAnnotations = useBrowserAnnotationStore(
    (s) => s.clearBrowserPageAnnotations
  )
  const removeDeliveredBrowserPageAnnotations = useBrowserAnnotationStore(
    (s) => s.removeDeliveredBrowserPageAnnotations
  )

  useLayoutEffect(() => {
    browserAnnotationsRef.current = browserAnnotations
    sendToAgentRef.current = sendToAgent
  }, [browserAnnotations, sendToAgent])

  useEffect(() => {
    return () => {
      clearTimeout(annotationCopyTimerRef.current)
    }
  }, [])

  const handleCopyBrowserAnnotations = useCallback((): void => {
    if (!copyPrompt) {
      return
    }
    void window.browserAPI!.writeClipboardText(copyPrompt)
    clearTimeout(annotationCopyTimerRef.current)
    setBrowserAnnotationsCopied(true)
    annotationCopyTimerRef.current = setTimeout(() => setBrowserAnnotationsCopied(false), 1400)
  }, [copyPrompt])

  const handleSendBrowserAnnotationsToAgent = useCallback(async (): Promise<void> => {
    const send = sendToAgentRef.current
    // Only this batch is removed once the host accepts it; later edits and additions stay.
    const delivered = browserAnnotationsRef.current
    const payload = buildAnnotationAgentPayload(delivered)
    if (!send || !payload || sendInFlightRef.current) {
      return
    }
    sendInFlightRef.current = true
    setBrowserAnnotationsSending(true)
    try {
      await send(payload)
      removeDeliveredBrowserPageAnnotations(browserTabId, delivered)
    } catch (error) {
      if (!isSendToAgentCanceled(error)) {
        toast.error(
          translate('auto.components.browser.pane.sendToAgent.failed', 'Could not send to agent')
        )
      }
    } finally {
      sendInFlightRef.current = false
      setBrowserAnnotationsSending(false)
    }
  }, [browserTabId, removeDeliveredBrowserPageAnnotations])

  const handleClearBrowserAnnotations = useCallback((): void => {
    if (browserAnnotationsRef.current.length === 0) {
      return
    }
    clearTimeout(annotationCopyTimerRef.current)
    setBrowserAnnotationsCopied(false)
    clearBrowserPageAnnotations(browserTabId)
  }, [browserTabId, clearBrowserPageAnnotations])

  const handleDeleteBrowserAnnotation = useCallback(
    (annotationId: string): void => {
      if (browserAnnotationsRef.current.length === 1) {
        clearTimeout(annotationCopyTimerRef.current)
        setBrowserAnnotationsCopied(false)
        setBrowserAnnotationTrayOpen(true)
      }
      deleteBrowserPageAnnotation(browserTabId, annotationId)
    },
    [browserTabId, deleteBrowserPageAnnotation, setBrowserAnnotationTrayOpen]
  )

  const handleUpdateBrowserAnnotation = useCallback(
    (annotationId: string, comment: string, intent: BrowserAnnotationIntent): void => {
      updateBrowserPageAnnotation(browserTabId, annotationId, { comment, intent })
    },
    [browserTabId, updateBrowserPageAnnotation]
  )

  return {
    browserAnnotations,
    browserAnnotationTrayOpen,
    setBrowserAnnotationTrayOpen,
    browserAnnotationsCopied,
    browserAnnotationsSending,
    handleSendBrowserAnnotationsToAgent: sendToAgent ? handleSendBrowserAnnotationsToAgent : null,
    handleCopyBrowserAnnotations,
    handleClearBrowserAnnotations,
    handleDeleteBrowserAnnotation,
    handleUpdateBrowserAnnotation
  }
}
