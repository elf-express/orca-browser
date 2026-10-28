import {
  BROWSER_AGENT_IMAGE_NAMES,
  pngDataUrlToAgentImage,
  sanitizeAgentPageUrl,
  type BrowserAgentPayload
} from '../../../../shared/agent-payload'
import type {
  BrowserGrabPayload,
  BrowserPageAnnotation
} from '../../../../shared/browser-grab-types'
import { useBrowserRendererHost } from '../../../host-context'
import { formatBrowserAnnotationsAsMarkdown } from './browser-annotation-output'
import { formatGrabPayloadAsText } from './GrabConfirmationSheet'
import type { MarkupComposeResult } from './markup-screenshot-compose'

function compactImages(
  images: (BrowserAgentPayload['images'][number] | null)[]
): BrowserAgentPayload['images'] {
  return images.filter((image): image is BrowserAgentPayload['images'][number] => image !== null)
}

export function buildGrabAgentPayload(payload: BrowserGrabPayload): BrowserAgentPayload {
  return {
    kind: 'grab',
    pageUrl: sanitizeAgentPageUrl(payload.page.sanitizedUrl),
    pageTitle: payload.page.title,
    text: formatGrabPayloadAsText(payload),
    images: compactImages([
      pngDataUrlToAgentImage(BROWSER_AGENT_IMAGE_NAMES.grab, payload.screenshot?.dataUrl)
    ])
  }
}

export function buildAnnotationAgentPayload(
  annotations: readonly BrowserPageAnnotation[]
): BrowserAgentPayload | null {
  if (annotations.length === 0) {
    return null
  }
  const { page } = annotations[0].payload
  return {
    kind: 'annotation',
    pageUrl: sanitizeAgentPageUrl(page.sanitizedUrl),
    pageTitle: page.title,
    text: formatBrowserAnnotationsAsMarkdown([...annotations]),
    images: []
  }
}

export function formatMarkupAsText(args: {
  pageUrl: string
  width: number
  height: number
}): string {
  const heading = args.pageUrl ? `Screenshot markup from ${args.pageUrl}` : 'Screenshot markup'
  return `${heading}\n\nImage: ${BROWSER_AGENT_IMAGE_NAMES.markup} (${args.width}x${args.height})`
}

export function buildMarkupAgentPayload(args: {
  pageUrl: string
  pageTitle: string
  result: MarkupComposeResult
}): BrowserAgentPayload {
  const pageUrl = sanitizeAgentPageUrl(args.pageUrl)
  return {
    kind: 'markup',
    pageUrl,
    pageTitle: args.pageTitle,
    text: formatMarkupAsText({ pageUrl, width: args.result.width, height: args.result.height }),
    images: compactImages([
      pngDataUrlToAgentImage(BROWSER_AGENT_IMAGE_NAMES.markup, args.result.dataUrl)
    ])
  }
}

/** A host signals a user-canceled send by rejecting with an error named AbortError. */
export function isSendToAgentCanceled(error: unknown): boolean {
  // Why: a jsdom DOMException is not an instance of the Node Error realm, so accept both.
  const isErrorLike =
    error instanceof Error || (typeof DOMException !== 'undefined' && error instanceof DOMException)
  return isErrorLike && error.name === 'AbortError'
}

/** Returns null when the host does not provide onSendToAgent. Rejections propagate to the caller. */
export function useSendToAgent(): ((payload: BrowserAgentPayload) => Promise<void>) | null {
  const host = useBrowserRendererHost()
  if (!host.onSendToAgent) {
    return null
  }
  return async (payload) => {
    await host.onSendToAgent!(payload)
  }
}
