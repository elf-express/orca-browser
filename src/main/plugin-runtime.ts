import type { BrowserHost } from '../shared'
import type { ResolvedBrowserPluginOptions } from './plugin-options'

let current: ResolvedBrowserPluginOptions | null = null

export function setResolvedBrowserPluginOptions(
  options: ResolvedBrowserPluginOptions | null
): void {
  current = options
}

export function isBrowserPluginInstalled(): boolean {
  return current !== null
}

export function getResolvedBrowserPluginOptions(): ResolvedBrowserPluginOptions {
  if (!current) {
    throw new Error('orca-browser: plugin is not installed')
  }
  return current
}

export function getBrowserHost(): BrowserHost {
  return getResolvedBrowserPluginOptions().host
}
