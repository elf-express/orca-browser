import { createContext, useContext } from 'react'
import type { BrowserAgentPayload } from '../shared'

export interface BrowserRendererHost {
  t(key: string, fallback: string, vars?: Record<string, string | number>): string
  /**
   * The package awaits the result. A rejection keeps the pending content and shows an error,
   * except `error.name === 'AbortError'`, which counts as a user cancel and shows nothing.
   */
  onSendToAgent?(payload: BrowserAgentPayload): void | Promise<void>
}

export const BrowserRendererHostContext = createContext<BrowserRendererHost | null>(null)

export function useBrowserRendererHost(): BrowserRendererHost {
  const host = useContext(BrowserRendererHostContext)
  if (!host) {
    throw new Error('orca-browser: BrowserPane must be rendered inside BrowserPluginProvider')
  }
  return host
}
