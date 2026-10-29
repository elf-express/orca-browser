import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CdpWsProxy } from './cdp-ws-proxy'
import {
  connect,
  createMockWebContents,
  httpGet,
  pathSecretOf,
  sendAndReceive,
  upgradeStatus,
  type MockWebContents
} from './cdp-ws-proxy-test-harness'

vi.mock('electron', () => ({
  webContents: { fromId: vi.fn() }
}))

function createProxy(mock: MockWebContents): CdpWsProxy {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the mock implements every WebContents member the proxy calls.
  return new CdpWsProxy(mock.webContents as never, () => () => {})
}

function sameLengthWrongSecret(secret: string): string {
  const last = secret.at(-1) === '0' ? '1' : '0'
  return `${secret.slice(0, -1)}${last}`
}

describe('CdpWsProxy path secret', () => {
  let mock: MockWebContents
  let proxy: CdpWsProxy
  let endpoint: string
  let port: number
  let secret: string

  beforeEach(async () => {
    mock = createMockWebContents()
    proxy = createProxy(mock)
    endpoint = await proxy.start()
    port = proxy.getPort()
    secret = pathSecretOf(endpoint)
  })

  afterEach(async () => {
    await proxy.stop()
  })

  it('embeds a 256-bit hex secret as the first path segment of the endpoint', () => {
    expect(endpoint).toBe(`ws://127.0.0.1:${port}/${secret}/`)
    expect(secret).toMatch(/^[\da-f]{64}$/)
  })

  it('serves discovery only under the secret path', async () => {
    for (const path of ['/json/version', '/json', '/json/list']) {
      await expect(httpGet(port, `/${secret}${path}`)).resolves.toMatchObject({ status: 200 })
    }
  })

  it('answers discovery without the secret with a bare 404', async () => {
    for (const path of ['/json/version', '/json', '/json/list', '/', '/json/version/']) {
      await expect(httpGet(port, path)).resolves.toEqual({ status: 404, body: '' })
    }
  })

  it('rejects discovery under a wrong secret of the same length', async () => {
    const wrong = sameLengthWrongSecret(secret)
    await expect(httpGet(port, `/${wrong}/json/version`)).resolves.toEqual({
      status: 404,
      body: ''
    })
  })

  it('rejects discovery when the secret is only a prefix of the first segment', async () => {
    await expect(httpGet(port, `/${secret}0/json/version`)).resolves.toMatchObject({
      status: 404
    })
    await expect(httpGet(port, `/${secret.slice(0, 32)}/json/version`)).resolves.toMatchObject({
      status: 404
    })
  })

  it('rejects a websocket handshake without the secret', async () => {
    await expect(upgradeStatus(`ws://127.0.0.1:${port}`)).resolves.toBe(404)
    await expect(upgradeStatus(`ws://127.0.0.1:${port}/devtools/browser`)).resolves.toBe(404)
  })

  it('rejects a websocket handshake under a wrong secret of the same length', async () => {
    const wrong = sameLengthWrongSecret(secret)
    await expect(upgradeStatus(`ws://127.0.0.1:${port}/${wrong}/`)).resolves.toBe(404)
  })

  it('accepts a websocket handshake on any path under the secret', async () => {
    await expect(upgradeStatus(endpoint)).resolves.toBe(101)
    await expect(
      upgradeStatus(`ws://127.0.0.1:${port}/${secret}/devtools/page/orca-proxy-target`)
    ).resolves.toBe(101)
  })

  it('keeps the agent client connected when an unauthenticated client tries to take over', async () => {
    const client = await connect(endpoint)
    await upgradeStatus(`ws://127.0.0.1:${port}/`)

    mock.webContents.debugger.sendCommand.mockResolvedValueOnce({ ok: true })
    const response = await sendAndReceive(client, { id: 3, method: 'DOM.getDocument' })

    expect(response.result).toEqual({ ok: true })
    client.close()
  })

  it('advertises secret-bearing websocket URLs from discovery', async () => {
    const version = JSON.parse((await httpGet(port, `/${secret}/json/version`)).body) as {
      webSocketDebuggerUrl: string
    }
    expect(version.webSocketDebuggerUrl).toBe(endpoint)

    const list = JSON.parse((await httpGet(port, `/${secret}/json/list`)).body) as {
      webSocketDebuggerUrl: string
    }[]
    expect(list).toHaveLength(1)
    expect(list[0]!.webSocketDebuggerUrl).toBe(endpoint)
    for (const target of list) {
      for (const value of Object.values(target)) {
        if (typeof value === 'string' && value.startsWith('ws://')) {
          expect(value).toContain(`/${secret}/`)
        }
      }
    }
  })

  it('lets a client that follows discovery connect', async () => {
    const version = JSON.parse((await httpGet(port, `/${secret}/json/version`)).body) as {
      webSocketDebuggerUrl: string
    }
    const client = await connect(version.webSocketDebuggerUrl)
    const response = await sendAndReceive(client, { id: 1, method: 'Target.getTargets' })
    expect(response.id).toBe(1)
    client.close()
  })

  it('gives two proxies different secrets', async () => {
    const other = createProxy(createMockWebContents())
    try {
      const otherEndpoint = await other.start()
      expect(pathSecretOf(otherEndpoint)).not.toBe(secret)
      await expect(upgradeStatus(`ws://127.0.0.1:${other.getPort()}/${secret}/`)).resolves.toBe(404)
    } finally {
      await other.stop()
    }
  })

  it('rotates the secret when the proxy restarts', async () => {
    await proxy.stop()
    const restarted = await proxy.start()
    const restartedSecret = pathSecretOf(restarted)

    expect(restartedSecret).toMatch(/^[\da-f]{64}$/)
    expect(restartedSecret).not.toBe(secret)
    await expect(httpGet(proxy.getPort(), `/${secret}/json/version`)).resolves.toMatchObject({
      status: 404
    })
  })

  it('never writes the secret to the console', async () => {
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const
    const spies = methods.map((method) => vi.spyOn(console, method).mockImplementation(() => {}))
    try {
      await proxy.stop()
      const restarted = await proxy.start()
      const freshSecret = pathSecretOf(restarted)
      const freshPort = proxy.getPort()
      await httpGet(freshPort, `/${freshSecret}/json/version`)
      await httpGet(freshPort, '/json/version')
      await upgradeStatus(`ws://127.0.0.1:${freshPort}/`)
      const client = await connect(restarted)
      await sendAndReceive(client, { id: 1, method: 'Browser.getVersion' })
      client.close()
      await proxy.stop()

      for (const spy of spies) {
        for (const call of spy.mock.calls) {
          expect(JSON.stringify(call)).not.toContain(freshSecret)
        }
      }
    } finally {
      for (const spy of spies) {
        spy.mockRestore()
      }
    }
  })
})
