import { redactKagiSessionToken } from './browser-url'

export const MAX_BROWSER_HISTORY_ENTRIES = 200

export function normalizeBrowserHistoryUrl(url: string): string {
  try {
    const parsed = new URL(redactKagiSessionToken(url))
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.protocol = parsed.protocol.toLowerCase()
    let normalized = parsed.toString()
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    return normalized
  } catch {
    return redactKagiSessionToken(url).toLowerCase()
  }
}
