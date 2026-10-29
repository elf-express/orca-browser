import { timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

export const MCP_HOST = '127.0.0.1'
export const MCP_PATH = '/mcp'
export const MCP_MAX_BODY_BYTES = 1_048_576

type BrowserMcpHttpServerOptions = {
  port: number
  getToken(): string
  createMcpServer(): McpServer
}

class BodyTooLargeError extends Error {}

function writeJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): void {
  if (res.headersSent) {
    return
  }
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

function jsonRpcError(code: number, message: string): unknown {
  return { jsonrpc: '2.0', error: { code, message }, id: null }
}

function isAuthorized(header: string | undefined, expected: string): boolean {
  if (!header) {
    return false
  }
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) {
    return false
  }
  const provided = Buffer.from(match[1])
  const wanted = Buffer.from(expected)
  // timingSafeEqual throws on unequal lengths, and a length mismatch is already a mismatch.
  return provided.length === wanted.length && timingSafeEqual(provided, wanted)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk: Buffer) => {
      if (tooLarge) {
        return
      }
      size += chunk.length
      if (size > MCP_MAX_BODY_BYTES) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) {
        reject(new BodyTooLargeError())
        return
      }
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

export class BrowserMcpHttpServer {
  private httpServer: Server | null = null
  private port: number | null = null

  constructor(private readonly opts: BrowserMcpHttpServerOptions) {}

  async start(): Promise<number> {
    const server = createServer((req, res) => {
      void this.handle(req, res)
    })
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => reject(error)
      server.once('error', onError)
      server.listen(this.opts.port, MCP_HOST, () => {
        server.off('error', onError)
        resolve()
      })
    })
    this.httpServer = server
    this.port = (server.address() as AddressInfo).port
    return this.port
  }

  async stop(): Promise<void> {
    const server = this.httpServer
    this.httpServer = null
    this.port = null
    if (!server) {
      return
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  }

  getPort(): number | null {
    return this.port
  }

  getAddress(): string | null {
    const address = this.httpServer?.address()
    return address && typeof address === 'object' ? address.address : null
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const pathname = new URL(req.url ?? '/', `http://${MCP_HOST}`).pathname
      if (pathname !== MCP_PATH) {
        writeJson(res, 404, jsonRpcError(-32000, 'Not found'))
        return
      }
      // The token is read on every request so a rotation takes effect immediately.
      if (!isAuthorized(req.headers.authorization, this.opts.getToken())) {
        writeJson(res, 401, jsonRpcError(-32001, 'Unauthorized'), {
          'WWW-Authenticate': 'Bearer realm="orca-browser"'
        })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, jsonRpcError(-32000, 'Method not allowed'), { Allow: 'POST' })
        return
      }

      let raw: string
      try {
        raw = await readBody(req)
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          writeJson(res, 413, jsonRpcError(-32000, 'Payload too large'), { Connection: 'close' })
          return
        }
        throw error
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        writeJson(res, 400, jsonRpcError(-32700, 'Parse error'))
        return
      }

      // Stateless mode: a fresh server and transport per request, closed with the response.
      const mcpServer = this.opts.createMcpServer()
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      })
      res.on('close', () => {
        void transport.close()
        void mcpServer.close()
      })
      await mcpServer.connect(transport)
      await transport.handleRequest(req, res, parsed)
    } catch {
      writeJson(res, 500, jsonRpcError(-32603, 'Internal server error'))
    }
  }
}
