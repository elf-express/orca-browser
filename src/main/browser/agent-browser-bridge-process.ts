import { existsSync, accessSync, chmodSync, constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import type { WebContents } from 'electron'
import { BrowserError } from './cdp-bridge'
import { ORCA_TAB_SESSION_PREFIX } from './agent-browser-orphan-sweep'
import { EMBEDDED_NAVIGATION_TIMEOUT_MS } from './agent-browser-bridge-types'

export type AgentBrowserBinaryResolution =
  | { found: true; path: string }
  | { found: false; expectedPaths: string[] }

// Must match the electron-builder extraResources file name in the host.
export function agentBrowserNativeName(): string {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return `agent-browser-${process.platform}-${process.arch}${ext}`
}

// Directories of the agent-browser npm package that ship the native binaries.
export function defaultAgentBrowserPackageBinDirs(): string[] {
  const dirs: string[] = []
  const add = (resolveManifest: () => string): void => {
    try {
      const dir = join(dirname(resolveManifest()), 'bin')
      if (!dirs.includes(dir)) {
        dirs.push(dir)
      }
    } catch {
      // The package is not resolvable from this location; try the next one.
    }
  }
  const localRequire = createRequire(import.meta.url)
  add(() => localRequire.resolve('agent-browser/package.json'))
  // Why: when the host bundles this package into its main process, agent-browser is only resolvable from the package's own location.
  add(() => {
    const pluginManifest = localRequire.resolve('@elf-express/orca-browser/package.json')
    return createRequire(pluginManifest).resolve('agent-browser/package.json')
  })
  return dirs
}

export function resolveAgentBrowserBinary(options: {
  resourcesPath: string
  packageBinDirs?: string[]
}): AgentBrowserBinaryResolution {
  const name = agentBrowserNativeName()
  const bundled = join(options.resourcesPath, name)
  const packageCandidates = (options.packageBinDirs ?? defaultAgentBrowserPackageBinDirs()).map(
    (dir) => join(dir, name)
  )
  const expectedPaths = [...new Set([bundled, ...packageCandidates])]
  if (existsSync(bundled)) {
    return { found: true, path: bundled }
  }
  for (const candidate of packageCandidates) {
    if (!existsSync(candidate)) {
      continue
    }
    if (process.platform !== 'win32') {
      try {
        accessSync(candidate, constants.X_OK)
      } catch {
        chmodSync(candidate, 0o755)
      }
    }
    return { found: true, path: candidate }
  }
  return { found: false, expectedPaths }
}

// Why: exec commands arrive as one string; split on whitespace but respect quotes so quoted args stay intact.
export function parseShellArgs(input: string): string[] {
  const args: string[] = []
  let current = ''
  let inDouble = false
  let inSingle = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === ' ' && !inDouble && !inSingle) {
      if (current) {
        args.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) {
    args.push(current)
  }
  return args
}

export function stripAgentBrowserTargetArgs(args: string[]): string[] {
  const stripped: string[] = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--cdp' || arg === '--session') {
      index++
      continue
    }
    if (arg.startsWith('--cdp=') || arg.startsWith('--session=')) {
      continue
    }
    stripped.push(arg)
  }
  return stripped
}

// Why: agent-browser returns generic errors for stale/unknown refs; map to a specific code so agents can detect and re-snapshot.
export function classifyErrorCode(message: string): string {
  if (/unknown ref|ref not found|element not found: @e/i.test(message)) {
    return 'browser_stale_ref'
  }
  return 'browser_error'
}

export function isAbortedNavigationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const { code, errno } = error as { code?: unknown; errno?: unknown }
  return code === 'ERR_ABORTED' || errno === -3
}

export function isWebContentsLoading(wc: WebContents): boolean {
  try {
    return wc.isLoading()
  } catch {
    // Why: destruction races are resolved against the authoritative page registration after the wait.
    return false
  }
}

export function waitForAbortedNavigationReplacement(
  wc: WebContents,
  browserPageId: string,
  timeoutMs: number
): Promise<void> {
  if (!isWebContentsLoading(wc)) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    const finish = (error?: BrowserError): void => {
      if (settled) {
        return
      }
      settled = true
      wc.removeListener('did-stop-loading', onDidStopLoading)
      wc.removeListener('destroyed', onDestroyed)
      if (timeout) {
        clearTimeout(timeout)
      }
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }
    const onDidStopLoading = (): void => finish()
    const onDestroyed = (): void => finish()

    wc.on('did-stop-loading', onDidStopLoading)
    wc.on('destroyed', onDestroyed)
    timeout = setTimeout(
      () =>
        finish(
          new BrowserError(
            'browser_error',
            `Failed to navigate browser page ${browserPageId}: Browser navigation timed out after ${EMBEDDED_NAVIGATION_TIMEOUT_MS}ms`
          )
        ),
      timeoutMs
    )
    timeout.unref?.()

    // Why: the replacement can finish between loadURL rejecting and listener attachment.
    if (!isWebContentsLoading(wc)) {
      finish()
    }
  })
}

export function isTabClosedTransportError(message: string): boolean {
  return /session destroyed while command|session destroyed while commands|connection refused|cdp discovery methods failed|websocket connect failed/i.test(
    message
  )
}

export function pageUnavailableMessageForSession(sessionName: string): string {
  const prefix = ORCA_TAB_SESSION_PREFIX
  const browserPageId = sessionName.startsWith(prefix) ? sessionName.slice(prefix.length) : null
  return browserPageId
    ? `Browser page ${browserPageId} is no longer available`
    : 'Browser tab is no longer available'
}
