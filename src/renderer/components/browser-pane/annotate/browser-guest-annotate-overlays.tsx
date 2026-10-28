import { useState, type MutableRefObject, type RefObject } from 'react'
import { Copy, Image, MessageSquarePlus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '../../../ui/dropdown-menu'
import { translate } from '../../../i18n'
import type { BrowserGrabPayload } from '../../../../shared/browser-grab-types'
import GrabConfirmationSheet, { formatGrabPayloadAsText } from './GrabConfirmationSheet'
import { copyGrabScreenshotToClipboard } from './browser-page-grab-action'
import type { GrabModeHook } from './useGrabMode'
import {
  getBrowserOverlayAnchor,
  type BrowserOverlayViewport
} from '../describe-page/browser-annotation-geometry'
import { BrowserPageAnnotationTray } from './browser-page-annotation-tray'
import { BrowserPageGrabToast } from './browser-page-grab-toast'
import { PendingBrowserAnnotationCard } from './pending-browser-annotation-card'
import type { useBrowserPageAnnotationSend } from './use-browser-page-annotation-send'
import type { useBrowserPageGrabAnnotations } from './use-browser-page-grab-annotations'

/**
 * Everything the annotate tools paint over a guest: the pending comment card, the annotation
 * tray, the right-click grab menu, the inline confirmation toast and the send-to-agent review.
 *
 * These overlays are the other half of the toolbar's tool cluster: a surface that offers the
 * tools but not these would arm a picker whose result the reader could never see.
 */
export function BrowserGuestAnnotateOverlays({
  grab,
  annotationSend,
  grabAnnotations,
  containerRef,
  webviewRef,
  browserOverlayViewport,
  currentUrl
}: {
  grab: GrabModeHook
  annotationSend: ReturnType<typeof useBrowserPageAnnotationSend>
  grabAnnotations: ReturnType<typeof useBrowserPageGrabAnnotations>
  containerRef: RefObject<HTMLDivElement | null>
  webviewRef: MutableRefObject<Electron.WebviewTag | null>
  browserOverlayViewport: BrowserOverlayViewport
  scopeId: string
  currentUrl?: string
}): React.JSX.Element {
  const {
    pendingAnnotationPayload,
    handleAddBrowserAnnotation,
    handleCancelPendingBrowserAnnotation,
    grabIntent,
    grabMenuActionTakenRef,
    handleGrabCopy,
    handleGrabCopyScreenshot,
    handleGrabSendToAgent,
    grabToast,
    grabToastTimerRef,
    dismissGrabToast,
    setGrabToast
  } = grabAnnotations
  const [grabReviewPayload, setGrabReviewPayload] = useState<BrowserGrabPayload | null>(null)
  const {
    browserAnnotations,
    browserAnnotationTrayOpen,
    browserAnnotationsSending,
    handleSendBrowserAnnotationsToAgent,
    handleCopyBrowserAnnotations,
    browserAnnotationsCopied,
    handleClearBrowserAnnotations,
    handleDeleteBrowserAnnotation,
    handleUpdateBrowserAnnotation
  } = annotationSend

  // Closing the review resumes the picker the way dismissing a confirmation does.
  const closeGrabReview = (): void => {
    setGrabReviewPayload(null)
    if (grab.state === 'confirming') {
      grab.rearm()
    }
  }

  return (
    <>
      {pendingAnnotationPayload ? (
        <PendingBrowserAnnotationCard
          payload={pendingAnnotationPayload}
          resolveAnchor={(cardHeight) =>
            getBrowserOverlayAnchor(
              pendingAnnotationPayload,
              containerRef.current,
              webviewRef.current,
              browserOverlayViewport,
              cardHeight
            )
          }
          // oxlint-disable-next-line react/refs -- Intentional: the card portals into the viewport container, which only changes with the pane.
          portalContainer={containerRef.current}
          onAdd={handleAddBrowserAnnotation}
          onCancel={handleCancelPendingBrowserAnnotation}
        />
      ) : null}
      {browserAnnotations.length > 0 && browserAnnotationTrayOpen ? (
        <BrowserPageAnnotationTray
          browserAnnotations={browserAnnotations}
          currentUrl={currentUrl}
          handleSendBrowserAnnotationsToAgent={handleSendBrowserAnnotationsToAgent}
          browserAnnotationsSending={browserAnnotationsSending}
          handleCopyBrowserAnnotations={handleCopyBrowserAnnotations}
          browserAnnotationsCopied={browserAnnotationsCopied}
          handleClearBrowserAnnotations={handleClearBrowserAnnotations}
          handleDeleteBrowserAnnotation={handleDeleteBrowserAnnotation}
          handleUpdateBrowserAnnotation={handleUpdateBrowserAnnotation}
        />
      ) : null}
      {/* Right-click context dropdown, positioned at the grabbed element's center. */}
      <DropdownMenu
        open={
          grab.state === 'confirming' &&
          grab.contextMenu &&
          grabIntent === 'copy' &&
          grabReviewPayload === null
        }
        onOpenChange={(open) => {
          if (!open && grab.state === 'confirming') {
            // Why: skip rearm if a menu action already handled it — see grabMenuActionTakenRef.
            if (grabMenuActionTakenRef.current) {
              grabMenuActionTakenRef.current = false
              return
            }
            grab.rearm()
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none absolute size-px opacity-0"
            /* oxlint-disable react/refs -- Intentional: the invisible anchor is positioned from live element rects on every render. */
            style={(() => {
              if (!grab.payload) {
                return { left: 0, top: 0 }
              }
              const rect = grab.payload.target.rectViewport
              const webview = webviewRef.current
              const webviewRect = webview?.getBoundingClientRect()
              const cRect = containerRef.current?.getBoundingClientRect()
              const offsetX = (webviewRect?.left ?? 0) - (cRect?.left ?? 0)
              const offsetY = (webviewRect?.top ?? 0) - (cRect?.top ?? 0)
              return {
                left: offsetX + rect.x + rect.width / 2,
                top: offsetY + rect.y + rect.height / 2
              }
            })()}
            /* oxlint-enable react/refs */
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4}>
          <DropdownMenuItem onSelect={handleGrabCopy}>
            <Copy className="size-3.5" />
            {translate('auto.components.browser.pane.BrowserPane.c2ef0359b9', 'Copy Contents')}
            <DropdownMenuShortcut>C</DropdownMenuShortcut>
          </DropdownMenuItem>
          {grab.payload?.screenshot?.dataUrl?.startsWith('data:image/png;base64,') ? (
            <DropdownMenuItem onSelect={handleGrabCopyScreenshot}>
              <Image className="size-3.5" />
              {translate('auto.components.browser.pane.BrowserPane.1ded0d3168', 'Copy Screenshot')}
              <DropdownMenuShortcut>S</DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : null}
          {handleGrabSendToAgent && grab.payload ? (
            <DropdownMenuItem
              onSelect={() => {
                grabMenuActionTakenRef.current = true
                setGrabReviewPayload(grab.payload)
              }}
            >
              <MessageSquarePlus className="size-3.5" />
              {translate('auto.components.browser.pane.sendToAgent.grab', 'Send to agent…')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              grabMenuActionTakenRef.current = true
              grab.cancel()
            }}
          >
            {translate('auto.components.browser.pane.BrowserPane.fa6ea61de3', 'Cancel')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inline toast bubble; flips above the element when near the viewport bottom so it doesn't occlude it. */}
      {grabToast ? (
        <BrowserPageGrabToast
          grabToast={grabToast}
          grabToastTimerRef={grabToastTimerRef}
          dismissGrabToast={dismissGrabToast}
          setGrabToast={setGrabToast}
          onReviewForAgent={handleGrabSendToAgent ? setGrabReviewPayload : null}
        />
      ) : null}
      {grabReviewPayload && handleGrabSendToAgent ? (
        <GrabConfirmationSheet
          payload={grabReviewPayload}
          onCopy={() => {
            void window.browserAPI!.writeClipboardText(formatGrabPayloadAsText(grabReviewPayload))
            closeGrabReview()
          }}
          onCopyScreenshot={
            grabReviewPayload.screenshot?.dataUrl?.startsWith('data:image/png;base64,')
              ? () => {
                  void copyGrabScreenshotToClipboard(grabReviewPayload.screenshot!.dataUrl)
                  closeGrabReview()
                }
              : null
          }
          onAttach={() => {
            void handleGrabSendToAgent(grabReviewPayload).then((sent) => {
              if (sent) {
                setGrabReviewPayload(null)
              }
            })
          }}
          onCancel={closeGrabReview}
        />
      ) : null}
    </>
  )
}
