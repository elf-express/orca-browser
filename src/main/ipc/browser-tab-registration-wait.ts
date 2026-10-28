import { webContents } from 'electron'
import { browserManager } from '../browser/browser-manager'

// Why: CLI-driven tab creation must wait until the renderer mounts the webview
// and calls registerGuest, so the tab has a webContentsId and is operable by
// subsequent commands. Multiple commands can wait for the same page during
// startup, so keep all one-shot resolvers keyed by browserPageId.
const pendingTabRegistrations = new Map<string, Set<() => void>>()
const pendingScopeTabRegistrations = new Map<string, Set<() => void>>()
const pendingAnyTabRegistrations = new Set<() => void>()

function waitForRegistrationSet(
  registrationResolvers: Set<() => void>,
  timeoutMs: number,
  onEmpty: () => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const resolveRegistration = (): void => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      registrationResolvers.delete(resolveRegistration)
      if (registrationResolvers.size === 0) {
        onEmpty()
      }
      reject(new Error('Tab registration timed out'))
    }, timeoutMs)
    registrationResolvers.add(resolveRegistration)
  })
}

function resolvePendingRegistrations(registrationResolvers: Set<() => void> | undefined): void {
  if (!registrationResolvers) {
    return
  }
  for (const pendingResolve of registrationResolvers) {
    pendingResolve()
  }
}

export function isLiveBrowserWebContentsId(webContentsId: number | null | undefined): boolean {
  if (webContentsId == null) {
    return false
  }
  const guest = webContents.fromId(webContentsId)
  return Boolean(guest && !guest.isDestroyed())
}

function hasRegisteredTabForScope(scopeId: string): boolean {
  for (const [browserPageId, webContentsId] of browserManager.getWebContentsIdByTabId()) {
    if (
      browserManager.getScopeIdForTab(browserPageId) === scopeId &&
      isLiveBrowserWebContentsId(webContentsId)
    ) {
      return true
    }
  }
  return false
}

export function waitForTabRegistration(browserPageId: string, timeoutMs = 8_000): Promise<void> {
  if (isLiveBrowserWebContentsId(browserManager.getGuestWebContentsId(browserPageId))) {
    return Promise.resolve()
  }
  return waitForNextTabRegistration(browserPageId, timeoutMs)
}

export function waitForNextTabRegistration(
  browserPageId: string,
  timeoutMs: number
): Promise<void> {
  let registrationResolvers = pendingTabRegistrations.get(browserPageId)
  if (!registrationResolvers) {
    registrationResolvers = new Set()
    pendingTabRegistrations.set(browserPageId, registrationResolvers)
  }
  return waitForRegistrationSet(registrationResolvers, timeoutMs, () => {
    pendingTabRegistrations.delete(browserPageId)
  })
}

export function waitForScopeTabRegistration(
  scopeId: string | undefined,
  timeoutMs = 8_000
): Promise<void> {
  if (!scopeId) {
    return waitForAnyTabRegistration(timeoutMs)
  }
  if (hasRegisteredTabForScope(scopeId)) {
    return Promise.resolve()
  }
  let registrationResolvers = pendingScopeTabRegistrations.get(scopeId)
  if (!registrationResolvers) {
    registrationResolvers = new Set()
    pendingScopeTabRegistrations.set(scopeId, registrationResolvers)
  }
  return waitForRegistrationSet(registrationResolvers, timeoutMs, () => {
    pendingScopeTabRegistrations.delete(scopeId)
  })
}

export function waitForAnyTabRegistration(timeoutMs = 8_000): Promise<void> {
  for (const webContentsId of browserManager.getWebContentsIdByTabId().values()) {
    if (isLiveBrowserWebContentsId(webContentsId)) {
      return Promise.resolve()
    }
  }
  return waitForRegistrationSet(pendingAnyTabRegistrations, timeoutMs, () => {})
}

export function resolveTabRegistrationWaiters(browserPageId: string, scopeId: string): void {
  const pendingResolves = pendingTabRegistrations.get(browserPageId)
  pendingTabRegistrations.delete(browserPageId)
  resolvePendingRegistrations(pendingResolves)
  const pendingScopeResolves = pendingScopeTabRegistrations.get(scopeId)
  pendingScopeTabRegistrations.delete(scopeId)
  resolvePendingRegistrations(pendingScopeResolves)
  const pendingAnyResolves = new Set(pendingAnyTabRegistrations)
  pendingAnyTabRegistrations.clear()
  resolvePendingRegistrations(pendingAnyResolves)
}
