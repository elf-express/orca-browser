import type { BrowserRendererHost } from './host-context'

let currentHost: BrowserRendererHost | null = null

export function setBrowserRendererHost(host: BrowserRendererHost | null): void {
  currentHost = host
}

export function clearBrowserRendererHost(host: BrowserRendererHost): void {
  if (currentHost === host) {
    currentHost = null
  }
}

export function translate(
  key: string,
  fallback: string,
  vars?: Record<string, string | number>
): string {
  if (currentHost) {
    return currentHost.t(key, fallback, vars)
  }
  if (!vars) {
    return fallback
  }
  return fallback.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match
  )
}
