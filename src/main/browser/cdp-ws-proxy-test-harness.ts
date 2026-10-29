import { vi, type Mock } from 'vitest'
import { request as httpRequest } from 'node:http'
import WebSocket from 'ws'

type DebuggerListener = (...args: unknown[]) => void

type MockDebugger = {
  isAttached: Mock<() => boolean>
  attach: Mock<() => void>
  detach: Mock<() => void>
  sendCommand: Mock<
    (
      method?: string,
      params?: Record<string, unknown>,
      sessionId?: string
    ) => Promise<Record<string, unknown>>
  >
  on: Mock<(event: string, handler: DebuggerListener) => void>
  removeListener: Mock<(event: string, handler: DebuggerListener) => void>
}

// Why: annotate the return explicitly so the exported inferred type stays nameable under
// composite declaration emit — otherwise the vi.fn() mocks leak @vitest/spy's Procedure
// and tsgo reports TS2883.
export type MockWebContents = {
  webContents: {
    debugger: MockDebugger
    isDestroyed: () => boolean
    isCrashed: () => boolean
    focus: Mock<() => void>
    printToPDF: Mock<() => Promise<Buffer>>
    reload: Mock<() => void>
    reloadIgnoringCache: Mock<() => void>
    getTitle: Mock<() => string>
    getURL: Mock<() => string>
  }
  listeners: Map<string, DebuggerListener[]>
  destroy: () => void
  emit: (event: string, ...args: unknown[]) => void
}

export function createMockWebContents(): MockWebContents {
  const listeners = new Map<string, DebuggerListener[]>()
  let debuggerAttached = false
  let destroyed = false

  const debuggerObj = {
    isAttached: vi.fn(() => debuggerAttached),
    attach: vi.fn(() => {
      debuggerAttached = true
    }),
    detach: vi.fn(() => {
      debuggerAttached = false
    }),
    sendCommand: vi.fn(
      async (method?: string, _params?: Record<string, unknown>, _sessionId?: string) =>
        method === 'Page.captureScreenshot' ? { data: 'png' } : {}
    ),
    on: vi.fn((event: string, handler: DebuggerListener) => {
      const arr = listeners.get(event) ?? []
      arr.push(handler)
      listeners.set(event, arr)
    }),
    removeListener: vi.fn((event: string, handler: DebuggerListener) => {
      const arr = listeners.get(event) ?? []
      listeners.set(
        event,
        arr.filter((h) => h !== handler)
      )
    })
  }

  return {
    webContents: {
      debugger: debuggerObj,
      isDestroyed: () => destroyed,
      isCrashed: () => false,
      focus: vi.fn(),
      printToPDF: vi.fn(async () => Buffer.from('%PDF-test')),
      reload: vi.fn(),
      reloadIgnoringCache: vi.fn(),
      getTitle: vi.fn(() => 'Example'),
      getURL: vi.fn(() => 'https://example.com')
    },
    listeners,
    destroy() {
      destroyed = true
    },
    emit(event: string, ...args: unknown[]) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args)
      }
    }
  }
}

export type SendCommandCall = [string, Record<string, unknown>?, string?]

export function connect(endpoint: string): Promise<WebSocket> {
  return new Promise((resolve) => {
    const ws = new WebSocket(endpoint)
    ws.on('open', () => resolve(ws))
  })
}

export function sendAndReceive(
  ws: WebSocket,
  msg: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(JSON.parse(data.toString())))
    ws.send(JSON.stringify(msg))
  })
}

export function getSendCommandCalls(mock: MockWebContents): SendCommandCall[] {
  return mock.webContents.debugger.sendCommand.mock.calls as unknown as SendCommandCall[]
}

export function getSendCommandMethods(mock: MockWebContents): string[] {
  return getSendCommandCalls(mock).map((call) => call[0])
}

/** Extracts the per-start path secret from a proxy endpoint such as `ws://127.0.0.1:1234/<secret>/`. */
export function pathSecretOf(endpoint: string): string {
  return new URL(endpoint).pathname.split('/')[1] ?? ''
}

/** Sends a plain loopback HTTP GET to the proxy and returns its status and body. */
export function httpGet(
  port: number,
  path: string,
  host = `127.0.0.1:${port}`
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, headers: { Host: host } }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        body += chunk
      })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

/** Attempts a websocket handshake and resolves with the HTTP status, or 101 when it was accepted. */
export function upgradeStatus(url: string): Promise<number> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url)
    ws.on('open', () => {
      ws.close()
      resolve(101)
    })
    ws.on('unexpected-response', (_req, res) => {
      resolve(res.statusCode ?? 0)
      ws.terminate()
    })
    ws.on('error', () => {})
  })
}
