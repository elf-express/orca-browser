import { createServer, type Server } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { BrowserMcpHttpServer, MCP_MAX_BODY_BYTES } from './mcp-http-server'
import { BROWSER_MCP_TOOL_NAMES, createBrowserMcpServer } from './browser-mcp-tools'

const TOKEN = 'a'.repeat(64)

function fakeMcpServer() {
  const bridge = new Proxy({}, { get: () => vi.fn() }) as never
  return createBrowserMcpServer({
    bridge,
    getScopeIdForTab: () => undefined,
    binary: { found: true, path: '/bin/agent-browser' }
  })
}

const started: BrowserMcpHttpServer[] = []
const blockers: Server[] = []

async function startServer(getToken: () => string = () => TOKEN) {
  const server = new BrowserMcpHttpServer({ port: 0, getToken, createMcpServer: fakeMcpServer })
  started.push(server)
  const port = await server.start()
  return { server, port, url: `http://127.0.0.1:${port}/mcp` }
}

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

function post(url: string, headers: Record<string, string>, body: string) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers
    },
    body
  })
}

afterEach(async () => {
  await Promise.all(started.splice(0).map((s) => s.stop()))
  await Promise.all(blockers.splice(0).map((b) => new Promise((r) => b.close(r))))
})

describe('BrowserMcpHttpServer', () => {
  it('rejects requests without Authorization with 401', async () => {
    const { url } = await startServer()
    const res = await post(url, {}, initializeBody)
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe('Bearer realm="orca-browser"')
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: null
    })
  })

  it('rejects a wrong bearer token with 401', async () => {
    const { url } = await startServer()
    const same = await post(url, { Authorization: `Bearer ${'b'.repeat(64)}` }, initializeBody)
    expect(same.status).toBe(401)
    const short = await post(url, { Authorization: 'Bearer short' }, initializeBody)
    expect(short.status).toBe(401)
    const scheme = await post(url, { Authorization: `Basic ${TOKEN}` }, initializeBody)
    expect(scheme.status).toBe(401)
  })

  it('returns 404 for paths other than /mcp', async () => {
    const { port } = await startServer()
    const res = await fetch(`http://127.0.0.1:${port}/other`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: '{}'
    })
    expect(res.status).toBe(404)
  })

  it('returns 405 for GET /mcp with a valid token', async () => {
    const { url } = await startServer()
    const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } })
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST')
  })

  it('returns 413 when the body exceeds 1 MiB', async () => {
    const { url } = await startServer()
    const big = 'x'.repeat(MCP_MAX_BODY_BYTES + 1)
    const res = await post(url, { Authorization: `Bearer ${TOKEN}` }, big)
    expect(res.status).toBe(413)
  })

  it('returns 400 with -32700 for malformed JSON', async () => {
    const { url } = await startServer()
    const res = await post(url, { Authorization: `Bearer ${TOKEN}` }, '{not json')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: number } }
    expect(body.error.code).toBe(-32700)
  })

  it('binds only to 127.0.0.1', async () => {
    const { server } = await startServer()
    expect(server.getPort()).not.toBeNull()
    expect(server.getAddress()).toBe('127.0.0.1')
  })

  it('start rejects with EADDRINUSE when the port is taken', async () => {
    const blocker = createServer()
    blockers.push(blocker)
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve))
    const port = (blocker.address() as { port: number }).port
    const server = new BrowserMcpHttpServer({
      port,
      getToken: () => TOKEN,
      createMcpServer: fakeMcpServer
    })
    await expect(server.start()).rejects.toMatchObject({ code: 'EADDRINUSE' })
  })

  it('lists exactly the 14 browser tools through the SDK client', async () => {
    const { url } = await startServer()
    const client = new Client({ name: 'test', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } }
    })
    await client.connect(transport)
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([...BROWSER_MCP_TOOL_NAMES].sort())
    await client.close()
  })

  it('picks up a new token on the next request', async () => {
    let current = TOKEN
    const { url } = await startServer(() => current)
    const before = await post(url, { Authorization: `Bearer ${TOKEN}` }, initializeBody)
    expect(before.status).toBe(200)
    current = 'c'.repeat(64)
    const old = await post(url, { Authorization: `Bearer ${TOKEN}` }, initializeBody)
    expect(old.status).toBe(401)
    const fresh = await post(url, { Authorization: `Bearer ${current}` }, initializeBody)
    expect(fresh.status).toBe(200)
  })
})
