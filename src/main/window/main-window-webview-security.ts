import { app, webContents } from 'electron'
import { ORCA_BROWSER_GUEST_WEB_PREFERENCES } from '../../shared/browser-guest-web-preferences'
import { isFileUrl, normalizeBrowserNavigationUrl } from '../../shared/browser-url'
import { isAllowedBrowserPartition } from '../browser/browser-partition-allowlist'
import { browserManager } from '../browser/browser-manager'

/**
 * Guards `<webview>` attachment for the host main window. Windows other than the host's main
 * window may never attach a webview; the main window may attach only an allowed partition with a
 * browsable src. Returns a function that removes every listener installed here.
 */
export function installWebviewSecurity(
  getMainWindow: () => Electron.BrowserWindow | null
): () => void {
  const isMainWindowContents = (contents: Electron.WebContents): boolean => {
    const mainWindow = getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed?.()) {
      return false
    }
    return mainWindow.webContents.id === contents.id
  }

  const disposers = new Map<number, () => void>()

  const guard = (contents: Electron.WebContents): void => {
    if (contents.getType() !== 'window' || disposers.has(contents.id)) {
      return
    }

    const onWillAttach = (
      event: Electron.Event,
      webPreferences: Electron.WebPreferences,
      params: Record<string, string>
    ): void => {
      const src = typeof params.src === 'string' ? params.src : ''
      const partition = typeof webPreferences.partition === 'string' ? webPreferences.partition : ''
      // Why: fail closed — deny any src or partition not in the allowlist so a renderer bug can't smuggle preload/Node into an unprivileged guest.
      const normalizedSrc = normalizeBrowserNavigationUrl(src)
      if (
        !isMainWindowContents(contents) ||
        !normalizedSrc ||
        isFileUrl(normalizedSrc) ||
        !isAllowedBrowserPartition(partition)
      ) {
        event.preventDefault()
        return
      }

      delete params.preload
      delete webPreferences.preload
      // Why: older Electron builds expose preloadURL alongside preload; delete both so the guest can't inherit the main preload bridge.
      delete (webPreferences as Record<string, unknown>).preloadURL
      // Why delete something Electron may not set: if a future Electron passes the embedder's
      // additionalArguments down to a guest, the guest would read this app's launch arguments.
      delete webPreferences.additionalArguments
      webPreferences.nodeIntegration = false
      webPreferences.nodeIntegrationInSubFrames = false
      webPreferences.enableBlinkFeatures = ''
      webPreferences.disableBlinkFeatures = ''
      webPreferences.webSecurity = true
      webPreferences.allowRunningInsecureContent = false
      webPreferences.contextIsolation = true
      webPreferences.sandbox = true
      // Why: a guest must not be able to create nested <webview> tags of its own.
      webPreferences.webviewTag = false
      // Why: force the browser guest policy even if host markup omits or misspells a preference.
      Object.assign(webPreferences, ORCA_BROWSER_GUEST_WEB_PREFERENCES)
      // Why: keep the validated partition so isolated session profiles use their own storage while other hardening stays intact.
      webPreferences.partition = partition
    }

    const onDidAttach = (_event: Electron.Event, guest: Electron.WebContents): void => {
      if (!isMainWindowContents(contents)) {
        return
      }
      // Why: attach guest popup/nav policy at creation; waiting for renderer registration races target=_blank/early redirects past it.
      browserManager.attachGuestPolicies(guest)
    }

    contents.on('will-attach-webview', onWillAttach)
    contents.on('did-attach-webview', onDidAttach)
    disposers.set(contents.id, () => {
      try {
        contents.off('will-attach-webview', onWillAttach)
        contents.off('did-attach-webview', onDidAttach)
      } catch {
        // Why: best-effort — the contents may already be destroyed.
      }
    })
  }

  const onWebContentsCreated = (_event: Electron.Event, contents: Electron.WebContents): void => {
    guard(contents)
  }

  for (const contents of webContents.getAllWebContents()) {
    guard(contents)
  }
  app.on('web-contents-created', onWebContentsCreated)

  return () => {
    app.off('web-contents-created', onWebContentsCreated)
    for (const dispose of disposers.values()) {
      dispose()
    }
    disposers.clear()
  }
}
