import { createServer, type Server } from 'node:net'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Runtime = typeof import('./browser-mcp-runtime')

let runtime: Runtime
let userDataDir: string
const blockers: Server[] = []

const logger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
const tools = () => ({
  bridge: new Proxy({}, { get: () => vi.fn() }) as never,
  getScopeIdForTab: () => undefined,
  binary: { found: true as const, path: '/bin/agent-browser' }
})

const initializeBody = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' }
  }
})

function post(url: string, token: string) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`
    },
    body: initializeBody
  })
}

async function occupyPort(): Promise<number> {
  const blocker = createServer()
  blockers.push(blocker)
  await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve))
  return (blocker.address() as { port: number }).port
}

beforeEach(async () => {
  vi.resetModules()
  runtime = await import('./browser-mcp-runtime')
  userDataDir = await mkdtemp(join(tmpdir(), 'orca-browser-runtime-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await runtime.stopBrowserMcpRuntime()
  await Promise.all(blockers.splice(0).map((b) => new Promise((r) => b.close(r))))
  await rm(userDataDir, { recursive: true, force: true })
})

describe('browser MCP runtime', () => {
  it('getMcpEndpoint returns null before start', () => {
    expect(runtime.getMcpEndpoint()).toBeNull()
  })

  it('getMcpStatus reports starting before start', () => {
    expect(runtime.getMcpStatus()).toEqual({ state: 'starting', port: 47821 })
  })

  it('getMcpEndpoint returns url and token once listening', async () => {
    await runtime.startBrowserMcpRuntime({
      userDataDir,
      port: 0,
      logger: logger(),
      tools: tools()
    })
    const endpoint = runtime.getMcpEndpoint()
    const status = runtime.getMcpStatus()
    expect(status.state).toBe('listening')
    expect(endpoint).not.toBeNull()
    expect(endpoint!.url).toBe(`http://127.0.0.1:${status.port}/mcp`)
    expect(status).toEqual({ state: 'listening', port: status.port })
    const onDisk = await readFile(join(userDataDir, 'orca-browser', 'mcp-token'), 'utf8')
    expect(endpoint!.token).toBe(onDisk)
  })

  it('reports port_in_use and logs when the port is in use', async () => {
    const port = await occupyPort()
    const log = logger()
    await runtime.startBrowserMcpRuntime({ userDataDir, port, logger: log, tools: tools() })
    expect(runtime.getMcpEndpoint()).toBeNull()
    expect(runtime.getMcpStatus()).toEqual({ state: 'port_in_use', port })
    expect(log.error).toHaveBeenCalledWith('orca-browser MCP server failed to start', {
      port,
      code: 'EADDRINUSE'
    })
  })

  it('reports error with the message for other listen failures', async () => {
    const { BrowserMcpHttpServer } = await import('./mcp-http-server')
    vi.spyOn(BrowserMcpHttpServer.prototype, 'start').mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'EACCES' })
    )
    const log = logger()
    await runtime.startBrowserMcpRuntime({ userDataDir, port: 5, logger: log, tools: tools() })
    expect(runtime.getMcpEndpoint()).toBeNull()
    expect(runtime.getMcpStatus()).toEqual({ state: 'error', port: 5, message: 'boom' })
    expect(log.error).toHaveBeenCalledWith('orca-browser MCP server failed to start', {
      port: 5,
      code: 'EACCES'
    })
  })

  it('rotateMcpToken persists a new token and the old token gets 401', async () => {
    await runtime.startBrowserMcpRuntime({
      userDataDir,
      port: 0,
      logger: logger(),
      tools: tools()
    })
    const { url, token: oldToken } = runtime.getMcpEndpoint()!
    expect((await post(url, oldToken)).status).toBe(200)
    const next = await runtime.rotateMcpToken()
    expect(next).not.toBe(oldToken)
    expect(await readFile(join(userDataDir, 'orca-browser', 'mcp-token'), 'utf8')).toBe(next)
    expect(runtime.getMcpEndpoint()!.token).toBe(next)
    expect((await post(url, oldToken)).status).toBe(401)
    expect((await post(url, next)).status).toBe(200)
  })

  it('rotateMcpToken still rotates the file when the port is in use', async () => {
    const port = await occupyPort()
    await runtime.startBrowserMcpRuntime({ userDataDir, port, logger: logger(), tools: tools() })
    const next = await runtime.rotateMcpToken()
    expect(await readFile(join(userDataDir, 'orca-browser', 'mcp-token'), 'utf8')).toBe(next)
  })

  it('stop clears the endpoint', async () => {
    await runtime.startBrowserMcpRuntime({
      userDataDir,
      port: 0,
      logger: logger(),
      tools: tools()
    })
    await runtime.stopBrowserMcpRuntime()
    expect(runtime.getMcpEndpoint()).toBeNull()
    expect(runtime.getMcpStatus().state).toBe('starting')
  })

  it('rotateMcpToken rejects when the runtime was never started', async () => {
    await expect(runtime.rotateMcpToken()).rejects.toThrow(
      'orca-browser MCP runtime is not started'
    )
  })
})
