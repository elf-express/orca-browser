import { DEFAULT_MCP_PORT } from '../../shared/constants'
import type { BrowserMcpEndpoint, BrowserMcpStatus } from '../../shared/browser-api-types'
import type { BrowserHostLogger } from '../../shared/host'
import { createBrowserMcpServer, type BrowserMcpToolDeps } from './browser-mcp-tools'
import { BrowserMcpHttpServer, MCP_HOST, MCP_PATH } from './mcp-http-server'
import { loadOrCreateMcpToken, writeNewMcpToken } from './mcp-token-store'

type RuntimeState = {
  server: BrowserMcpHttpServer
  userDataDir: string
  token: string
  endpoint: BrowserMcpEndpoint | null
}

let current: RuntimeState | null = null
let status: BrowserMcpStatus = { state: 'starting', port: DEFAULT_MCP_PORT }

export async function startBrowserMcpRuntime(opts: {
  userDataDir: string
  port: number
  logger: BrowserHostLogger
  tools: BrowserMcpToolDeps
}): Promise<void> {
  const { userDataDir, port, logger, tools } = opts
  await stopBrowserMcpRuntime()
  status = { state: 'starting', port }
  try {
    const state: RuntimeState = {
      userDataDir,
      token: await loadOrCreateMcpToken(userDataDir),
      endpoint: null,
      server: new BrowserMcpHttpServer({
        port,
        // Read through the state object so a rotation applies to the very next request.
        getToken: () => state.token,
        createMcpServer: () => createBrowserMcpServer(tools)
      })
    }
    current = state
    try {
      const actualPort = await state.server.start()
      state.endpoint = { url: `http://${MCP_HOST}:${actualPort}${MCP_PATH}`, token: state.token }
      status = { state: 'listening', port: actualPort }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      logger.error('orca-browser MCP server failed to start', { port, code })
      status =
        code === 'EADDRINUSE'
          ? { state: 'port_in_use', port }
          : {
              state: 'error',
              port,
              message: error instanceof Error ? error.message : String(error)
            }
    }
  } catch (error) {
    logger.error('orca-browser MCP server failed to start', {
      port,
      code: (error as NodeJS.ErrnoException).code
    })
    status = {
      state: 'error',
      port,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function stopBrowserMcpRuntime(): Promise<void> {
  const state = current
  current = null
  status = { state: 'starting', port: status.port }
  if (state) {
    await state.server.stop()
  }
}

export function getMcpEndpoint(): BrowserMcpEndpoint | null {
  // The endpoint token always reflects the latest rotation.
  return current?.endpoint ? { url: current.endpoint.url, token: current.token } : null
}

export function getMcpStatus(): BrowserMcpStatus {
  return { ...status }
}

export async function rotateMcpToken(): Promise<string> {
  const state = current
  if (!state) {
    throw new Error('orca-browser MCP runtime is not started')
  }
  const token = await writeNewMcpToken(state.userDataDir)
  state.token = token
  return token
}
