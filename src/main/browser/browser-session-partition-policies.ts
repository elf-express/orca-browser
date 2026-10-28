import { session } from 'electron'
import type { Session } from 'electron'
import type { BrowserSessionProfile } from '../../shared/browser-workspace-types'
import { browserManager } from './browser-manager'
import { getBrowserIdentityModeSnapshot } from './browser-identity-mode-store'
import { cleanElectronUserAgent } from './browser-process-user-agent'
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
  configuredPartitions.add(partition)
}

export function clearBrowserSessionPartitionPolicies(partition: string, sess: Session): void {
  // Why: the Electron Session survives partition deletion; drop the request hook so removed profiles don't retain closures.
  retireBrowserSessionUserAgentPolicy(sess)
  configuredPartitions.delete(partition)
}
