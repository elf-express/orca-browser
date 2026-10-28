import { contextBridge } from 'electron'
import { BROWSER_API_GLOBAL_KEY } from '../shared'
import { createBrowserApi } from './browser-api'

export function exposeBrowserApi(): void {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld(BROWSER_API_GLOBAL_KEY, createBrowserApi())
  } else {
    ;(globalThis as Record<string, unknown>)[BROWSER_API_GLOBAL_KEY] = createBrowserApi()
  }
}
