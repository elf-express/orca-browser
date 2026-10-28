export type BrowserAgentPayload = {
  kind: 'grab' | 'annotation' | 'markup'
  pageUrl: string
  pageTitle: string
  text: string
  images: Array<{ name: string; mimeType: 'image/png'; dataBase64: string }>
}

export const BROWSER_AGENT_IMAGE_NAMES = {
  grab: 'browser-grab.png',
  markup: 'browser-markup.png'
} as const

const SAFE_AGENT_URL_PROTOCOLS = new Set(['http:', 'https:', 'file:'])
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

/** Drops query and hash and keeps only http(s), file and about:blank URLs; anything else becomes ''. */
export function sanitizeAgentPageUrl(rawUrl: string): string {
  if (!rawUrl) {
    return ''
  }
  try {
    const url = new URL(rawUrl)
    if (url.protocol === 'about:') {
      return url.toString() === 'about:blank' ? 'about:blank' : ''
    }
    if (!SAFE_AGENT_URL_PROTOCOLS.has(url.protocol)) {
      return ''
    }
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

/** Converts a PNG data URL into a payload image; any other input yields null. */
export function pngDataUrlToAgentImage(
  name: string,
  dataUrl: string | null | undefined
): BrowserAgentPayload['images'][number] | null {
  if (!dataUrl || !dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    return null
  }
  return { name, mimeType: 'image/png', dataBase64: dataUrl.slice(PNG_DATA_URL_PREFIX.length) }
}
