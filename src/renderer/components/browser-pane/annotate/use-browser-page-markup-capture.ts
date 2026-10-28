import { useCallback, useLayoutEffect, useRef, type MutableRefObject } from 'react'
import { toast } from 'sonner'
import { translate } from '../../../i18n'
import type { MarkupComposeResult } from './markup-screenshot-compose'
import {
  buildMarkupAgentPayload,
  isSendToAgentCanceled,
  useSendToAgent
} from './browser-agent-send'
import { deliverMarkupToClipboard } from './markup-clipboard-delivery'
import {
  useMarkupMode,
  type MarkupCaptureContext,
  type MarkupModeController
} from './useMarkupMode'

export function useBrowserPageMarkupCapture(
  webviewRef: MutableRefObject<Electron.WebviewTag | null>,
  page: { url: string; title: string }
): MarkupModeController {
  const sendToAgent = useSendToAgent()
  // Delivery runs long after the render that started markup, so read the latest values.
  const sendRef = useRef(sendToAgent)
  const pageRef = useRef(page)
  useLayoutEffect(() => {
    sendRef.current = sendToAgent
    pageRef.current = page
  })

  const onDeliver = useCallback(async (result: MarkupComposeResult): Promise<void> => {
    const send = sendRef.current
    if (!send) {
      await deliverMarkupToClipboard(result)
      return
    }
    try {
      await send(
        buildMarkupAgentPayload({
          pageUrl: pageRef.current.url,
          pageTitle: pageRef.current.title,
          result
        })
      )
    } catch (error) {
      if (!isSendToAgentCanceled(error)) {
        toast.error(
          translate('auto.components.browser.pane.sendToAgent.failed', 'Could not send to agent')
        )
      }
      return
    }
    toast.success(
      translate('auto.components.browser.pane.sendToAgent.markupSent', 'Markup sent to agent')
    )
  }, [])

  return useMarkupMode({
    getCaptureContext: useCallback((): MarkupCaptureContext | null => {
      const webview = webviewRef.current
      if (!webview) {
        return null
      }
      const rect = webview.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return null
      }
      return {
        source: { kind: 'webview', webview },
        cssWidth: rect.width,
        cssHeight: rect.height,
        outputScale: window.devicePixelRatio || 1
      }
    }, [webviewRef]),
    onDeliver
  })
}
