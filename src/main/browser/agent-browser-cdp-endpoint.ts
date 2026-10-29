import type { AgentBrowserExecOptions } from './agent-browser-bridge-types'

const LOOPBACK_CDP_PATH_SECRET = /(wss?:\/\/(?:127\.0\.0\.1|localhost):\d+\/)[\da-f]{64}(?=\/|\b)/gi

/**
 * Hands agent-browser the proxy endpoint through `AGENT_BROWSER_CDP` instead of `--cdp`, so the
 * endpoint's path secret stays out of the helper's argv.
 */
export function withAgentBrowserCdpEndpoint(
  execOptions: AgentBrowserExecOptions | undefined,
  cdpEndpoint: string
): AgentBrowserExecOptions {
  return {
    ...execOptions,
    envOverrides: { ...execOptions?.envOverrides, AGENT_BROWSER_CDP: cdpEndpoint }
  }
}

/** Replaces the path secret of any loopback CDP proxy URL in `text` with `<redacted>`. */
export function redactCdpPathSecrets(text: string): string {
  return text.replace(LOOPBACK_CDP_PATH_SECRET, '$1<redacted>')
}
