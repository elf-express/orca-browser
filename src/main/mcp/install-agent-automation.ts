import { join } from 'node:path'
import type { BrowserHost } from '../../shared/host'
import { AgentBrowserBridge } from '../browser/agent-browser-bridge'
import {
  agentBrowserNativeName,
  resolveAgentBrowserBinary,
  type AgentBrowserBinaryResolution
} from '../browser/agent-browser-bridge-process'
import { browserManager, type BrowserManager } from '../browser/browser-manager'
import { registerBrowserMcpHandlers, unregisterBrowserMcpHandlers } from '../ipc/browser-mcp-ipc'
import { setAgentBrowserBridgeRef } from '../ipc/browser'
import type { BrowserPluginInstaller } from '../plugin-installers'
import { startBrowserMcpRuntime, stopBrowserMcpRuntime } from './browser-mcp-runtime'

const SESSION_CLOSE_TIMEOUT_MS = 5000

function resolveBinary(host: BrowserHost): AgentBrowserBinaryResolution {
  try {
    return resolveAgentBrowserBinary({ resourcesPath: host.resourcesPath })
  } catch (error) {
    // A binary that cannot be prepared (for example a non-executable file we cannot chmod) must not fail the install.
    host.logger.warn('agent-browser binary resolution failed', { error: String(error) })
    return {
      found: false,
      expectedPaths: [join(host.resourcesPath, agentBrowserNativeName())]
    }
  }
}

export function installAgentAutomation(deps: {
  host: BrowserHost
  browserManager: BrowserManager
  mcpPort: number
}): { bridge: AgentBrowserBridge; dispose(): Promise<void> } {
  const { host, mcpPort } = deps
  const binary = resolveBinary(host)
  const bridge = new AgentBrowserBridge(deps.browserManager, {
    agentBrowserBin: binary.found ? binary.path : binary.expectedPaths[0],
    userDataPath: host.userDataDir
  })
  setAgentBrowserBridgeRef(bridge)

  if (binary.found) {
    void bridge.sweepOrphanedSessions()
  } else {
    host.logger.warn('agent-browser binary not found', { expectedPaths: binary.expectedPaths })
  }

  void startBrowserMcpRuntime({
    userDataDir: host.userDataDir,
    port: mcpPort,
    logger: host.logger,
    tools: {
      bridge,
      getScopeIdForTab: (id) => deps.browserManager.getScopeIdForTab(id),
      binary
    }
  })

  return {
    bridge,
    async dispose() {
      await stopBrowserMcpRuntime()
      setAgentBrowserBridgeRef(null)
      await bridge.destroyAllSessions({ closeTimeoutMs: SESSION_CLOSE_TIMEOUT_MS })
    }
  }
}

export const installBrowserAgentAutomation: BrowserPluginInstaller = (options) => {
  const automation = installAgentAutomation({
    host: options.host,
    browserManager,
    mcpPort: options.mcpPort
  })
  try {
    registerBrowserMcpHandlers()
  } catch (error) {
    // Do not leak the runtime and bridge when installation fails half way.
    unregisterBrowserMcpHandlers()
    void automation.dispose().catch((disposeError) =>
      options.host.logger.warn('orca-browser MCP cleanup after a failed install failed', {
        error: String(disposeError)
      })
    )
    throw error
  }

  return async () => {
    unregisterBrowserMcpHandlers()
    await automation.dispose()
  }
}
