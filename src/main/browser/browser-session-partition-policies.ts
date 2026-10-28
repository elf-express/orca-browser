import { session } from 'electron'
import type { Session } from 'electron'
import type { BrowserSessionProfile } from '../../shared/browser-workspace-types'
import { browserManager } from './browser-manager'
import { getBrowserIdentityModeSnapshot } from './browser-identity-mode-store'
import { cleanElectronUserAgent } from './browser-process-user-agent'
import { hasSystemMediaAccess, requestSystemMediaAccess } from './browser-media-access'
import { isAutoGrantedBrowserSessionPermission } from './browser-session-permission-policy'
import { installBrowserSessionUserAgentPolicy } from './browser-session-ua'

// Why: one shared installer keeps every partition's session policies from drifting apart.
const configuredPartitions = new Set<string>()
const userAgentPolicyDisposerBySession = new WeakMap<Session, () => void>()

export function retireBrowserSessionUserAgentPolicy(sess: Session): void {
  const dispose = userAgentPolicyDisposerBySession.get(sess)
  if (!dispose) {
    return
  }
  userAgentPolicyDisposerBySession.delete(sess)
  dispose()
}

// Why: only the session is changed; app.userAgentFallback and the host window keep their own identity.
function configureBrowserSessionUserAgentPolicy(sess: Session, installExceptions: boolean): void {
  const mode = getBrowserIdentityModeSnapshot().appliedMode
  sess.setUserAgent(
    mode === 'clean' ? cleanElectronUserAgent(sess.getUserAgent()) : sess.getUserAgent()
  )
  if (!installExceptions) {
    retireBrowserSessionUserAgentPolicy(sess)
    return
  }
  if (userAgentPolicyDisposerBySession.has(sess)) {
    return
  }
  userAgentPolicyDisposerBySession.set(
    sess,
    installBrowserSessionUserAgentPolicy(sess, (request) =>
      browserManager.resolveBrowserGuestRequestUserAgent(request)
    )
  )
}

/** Drop only the installer memo; retired-session guards remain fail-closed. */
export function forgetBrowserSessionPartitionConfiguration(partition: string): void {
  configuredPartitions.delete(partition)
}

function resolvePermissionNoticeUrl(
  webContents: Electron.WebContents,
  details: Electron.PermissionRequest | undefined
): string {
  const requestingUrl = details?.requestingUrl
  if (!requestingUrl) {
    return webContents.getURL()
  }
  try {
    return new URL(requestingUrl).origin === 'null' ? '' : requestingUrl
  } catch {
    return ''
  }
}

// Why async despite no await: callers report failure through the promise
// (`void install(...).catch(...)`), so a synchronous throw from the identity lookup would escape
// every one of them and gate browser-session startup on bookkeeping that is allowed to fail.
export async function installBrowserSessionPartitionPolicies(
  profile: BrowserSessionProfile,
  options: { userAgentExceptions?: boolean } = {}
): Promise<void> {
  const { partition } = profile
  const sess = session.fromPartition(partition)
  configureBrowserSessionUserAgentPolicy(sess, options.userAgentExceptions !== false)
  if (configuredPartitions.has(partition)) {
    return
  }

  sess.setPermissionRequestHandler((webContents, permission, callback, details) => {
    // Why: defer media to macOS TCC; denying at the session layer throws NotAllowedError even after the user granted Camera/Mic to the OS.
    if (permission === 'media') {
      // Capture before async handling; opaque frames cannot be attributed to a named site.
      const rawUrl = resolvePermissionNoticeUrl(webContents, details)
      void requestSystemMediaAccess(
        details as Electron.MediaAccessPermissionRequest | undefined
      ).then(
        (granted) => {
          if (!granted) {
            browserManager.notifyPermissionDenied({
              guestWebContentsId: webContents.id,
              permission,
              rawUrl
            })
          }
          callback(granted)
        },
        (error: unknown) => {
          console.error('[permissions] Browser media access failed:', error)
          browserManager.notifyPermissionDenied({
            guestWebContentsId: webContents.id,
            permission,
            rawUrl
          })
          callback(false)
        }
      )
      return
    }
    const allowed = isAutoGrantedBrowserSessionPermission(permission)
    if (!allowed) {
      const rawUrl = resolvePermissionNoticeUrl(webContents, details)
      browserManager.notifyPermissionDenied({
        guestWebContentsId: webContents.id,
        permission,
        rawUrl
      })
    }
    callback(allowed)
  })
  sess.setPermissionCheckHandler((_webContents, permission, _origin, details) => {
    if (permission === 'media') {
      return hasSystemMediaAccess(details?.mediaType)
    }
    return isAutoGrantedBrowserSessionPermission(permission)
  })
  sess.setDisplayMediaRequestHandler((_request, callback) => {
    callback({ video: undefined, audio: undefined })
  })
  configuredPartitions.add(partition)
}

export function clearBrowserSessionPartitionPolicies(partition: string, sess: Session): void {
  // Why: the Electron Session survives partition deletion; clear callbacks so removed profiles don't retain closures.
  retireBrowserSessionUserAgentPolicy(sess)
  configuredPartitions.delete(partition)
  sess.setPermissionRequestHandler(null)
  sess.setPermissionCheckHandler(null)
  sess.setDisplayMediaRequestHandler(null)
}
