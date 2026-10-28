import type { BrowserApi } from '../shared'

export function createBrowserApi(): BrowserApi {
  return { apiVersion: 1 }
}
