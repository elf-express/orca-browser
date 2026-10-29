import { describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { BrowserError } from '../browser/browser-error'
import { createBrowserMcpServer, type BrowserMcpToolDeps } from './browser-mcp-tools'

function makeBridge() {
  return {
    goto: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    reload: vi.fn(),
    snapshot: vi.fn(),
    click: vi.fn(),
    fill: vi.fn(),
    type: vi.fn(),
    keypress: vi.fn(),
    screenshot: vi.fn(),
    evaluate: vi.fn(),
    tabList: vi.fn(),
    tabSwitch: vi.fn(),
    wait: vi.fn()
  }
}

async function connect(overrides: Partial<Omit<BrowserMcpToolDeps, 'bridge'>> = {}) {
  const bridge = makeBridge()
  const server = createBrowserMcpServer({
    bridge: bridge as never,
    getScopeIdForTab: () => undefined,
    binary: { found: true, path: '/bin/agent-browser' },
    ...overrides
  })
  const client = new Client({ name: 'test', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, bridge }
}

type ToolResult = {
  isError?: boolean
  content: { type: string; text?: string; data?: string; mimeType?: string }[]
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  return (await client.callTool({ name, arguments: args })) as ToolResult
}

describe('browser MCP tools', () => {
  it('goto passes url, scopeId and browserPageId to bridge.goto', async () => {
    const { client, bridge } = await connect()
    bridge.goto.mockResolvedValue({ url: 'https://example.com/', title: 'Example' })
    const result = await call(client, 'goto', {
      url: 'https://example.com',
      scopeId: 'ws-a',
      browserPageId: 'page-1'
    })
    expect(bridge.goto).toHaveBeenCalledWith('https://example.com', 'ws-a', 'page-1')
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ url: 'https://example.com/', title: 'Example' }) }
    ])
  })

  it('snapshot returns page meta line then the snapshot text', async () => {
    const { client, bridge } = await connect()
    bridge.snapshot.mockResolvedValue({
      browserPageId: 'page-1',
      snapshot: '- button "Go" [ref=e1]',
      refs: [],
      url: 'https://example.com/',
      title: 'Example'
    })
    const result = await call(client, 'snapshot', { scopeId: 'ws-a' })
    expect(bridge.snapshot).toHaveBeenCalledWith('ws-a', undefined)
    expect(result.content[0].text).toBe(
      `${JSON.stringify({ browserPageId: 'page-1', url: 'https://example.com/', title: 'Example' })}\n\n- button "Go" [ref=e1]`
    )
  })

  it('screenshot returns an image content block', async () => {
    const { client, bridge } = await connect()
    bridge.screenshot.mockResolvedValueOnce({ data: 'AAAA', format: 'png' })
    const png = await call(client, 'screenshot')
    expect(png.content).toEqual([{ type: 'image', data: 'AAAA', mimeType: 'image/png' }])
    bridge.screenshot.mockResolvedValueOnce({ data: 'BBBB', format: 'jpeg' })
    const jpeg = await call(client, 'screenshot', { format: 'jpeg' })
    expect(bridge.screenshot).toHaveBeenLastCalledWith('jpeg', undefined, undefined)
    expect(jpeg.content).toEqual([{ type: 'image', data: 'BBBB', mimeType: 'image/jpeg' }])
  })

  it('press maps to bridge.keypress', async () => {
    const { client, bridge } = await connect()
    bridge.keypress.mockResolvedValue({ pressed: 'Enter' })
    const result = await call(client, 'press', { key: 'Enter', scopeId: 'ws-a' })
    expect(bridge.keypress).toHaveBeenCalledWith('Enter', 'ws-a', undefined)
    expect(result.content[0].text).toBe(JSON.stringify({ pressed: 'Enter' }))
  })

  it('eval maps to bridge.evaluate', async () => {
    const { client, bridge } = await connect()
    bridge.evaluate.mockResolvedValue({ result: '2', origin: 'https://example.com' })
    const result = await call(client, 'eval', { expression: '1+1', browserPageId: 'page-1' })
    expect(bridge.evaluate).toHaveBeenCalledWith('1+1', undefined, 'page-1')
    expect(result.content[0].text).toBe(
      JSON.stringify({ result: '2', origin: 'https://example.com' })
    )
  })

  it('type maps text to bridge.type', async () => {
    const { client, bridge } = await connect()
    bridge.type.mockResolvedValue({ typed: true })
    await call(client, 'type', { text: 'hello', scopeId: 'ws-a' })
    expect(bridge.type).toHaveBeenCalledWith('hello', 'ws-a', undefined)
  })

  it('fill allows an empty value', async () => {
    const { client, bridge } = await connect()
    bridge.fill.mockResolvedValue({ filled: '#q' })
    const result = await call(client, 'fill', { element: '#q', value: '' })
    expect(result.isError).toBeFalsy()
    expect(bridge.fill).toHaveBeenCalledWith('#q', '', undefined, undefined)
  })

  it('click, back, forward and reload forward their targets', async () => {
    const { client, bridge } = await connect()
    bridge.click.mockResolvedValue({ clicked: '@e1' })
    bridge.back.mockResolvedValue({ url: 'u', title: 't' })
    bridge.forward.mockResolvedValue({ url: 'u', title: 't' })
    bridge.reload.mockResolvedValue({ url: 'u', title: 't' })
    await call(client, 'click', { element: '@e1', scopeId: 's' })
    await call(client, 'back', { browserPageId: 'p' })
    await call(client, 'forward', { scopeId: 's', browserPageId: 'p' })
    await call(client, 'reload')
    expect(bridge.click).toHaveBeenCalledWith('@e1', 's', undefined)
    expect(bridge.back).toHaveBeenCalledWith(undefined, 'p')
    expect(bridge.forward).toHaveBeenCalledWith('s', 'p')
    expect(bridge.reload).toHaveBeenCalledWith(undefined, undefined)
  })

  it('wait forwards the condition options', async () => {
    const { client, bridge } = await connect()
    bridge.wait.mockResolvedValue({ waited: true })
    await call(client, 'wait', {
      selector: '#a',
      timeout: 500,
      text: 'hi',
      url: '**/x',
      load: 'networkidle',
      fn: 'true',
      state: 'visible',
      scopeId: 's'
    })
    expect(bridge.wait).toHaveBeenCalledWith(
      {
        selector: '#a',
        timeout: 500,
        text: 'hi',
        url: '**/x',
        load: 'networkidle',
        fn: 'true',
        state: 'visible'
      },
      's',
      undefined
    )
  })

  it('tabs_list adds scopeId to every tab', async () => {
    const { client, bridge } = await connect({
      getScopeIdForTab: (id) => (id === 'page-1' ? 'ws-a' : 'ws-b')
    })
    bridge.tabList.mockReturnValue({
      tabs: [
        { browserPageId: 'page-1', index: 0, url: 'u1', title: 't1', active: true },
        { browserPageId: 'page-2', index: 1, url: 'u2', title: 't2', active: false }
      ]
    })
    const result = await call(client, 'tabs_list', { scopeId: 'ws-a' })
    expect(bridge.tabList).toHaveBeenCalledWith('ws-a')
    expect(JSON.parse(result.content[0].text ?? '')).toEqual({
      tabs: [
        {
          browserPageId: 'page-1',
          scopeId: 'ws-a',
          index: 0,
          url: 'u1',
          title: 't1',
          active: true
        },
        {
          browserPageId: 'page-2',
          scopeId: 'ws-b',
          index: 1,
          url: 'u2',
          title: 't2',
          active: false
        }
      ]
    })
  })

  it('tab_switch requires exactly one of index or browserPageId', async () => {
    const { client, bridge } = await connect()
    const none = await call(client, 'tab_switch', {})
    expect(none.isError).toBe(true)
    expect(none.content[0].text).toBe(
      'invalid_arguments: tab_switch requires index or browserPageId'
    )
    const both = await call(client, 'tab_switch', { index: 0, browserPageId: 'p' })
    expect(both.isError).toBe(true)
    expect(both.content[0].text).toBe(
      'invalid_arguments: pass either index or browserPageId, not both'
    )
    expect(bridge.tabSwitch).not.toHaveBeenCalled()
    bridge.tabSwitch.mockResolvedValue({ switched: 1, browserPageId: 'p2' })
    const ok = await call(client, 'tab_switch', { index: 1, scopeId: 's' })
    expect(bridge.tabSwitch).toHaveBeenCalledWith(1, 's', undefined)
    expect(ok.content[0].text).toBe(JSON.stringify({ switched: 1, browserPageId: 'p2' }))
  })

  it('maps BrowserError to an isError result with its code', async () => {
    const { client, bridge } = await connect()
    bridge.click.mockRejectedValue(new BrowserError('browser_target_ambiguous', 'x'))
    const result = await call(client, 'click', { element: '#a' })
    expect(result.isError).toBe(true)
    expect(result.content).toHaveLength(1)
    expect(result.content[0].text).toBe('browser_target_ambiguous: x')
  })

  it('rewrites the Orca CLI --worktree hint to scopeId for ambiguous targets', async () => {
    const { client, bridge } = await connect()
    bridge.type.mockRejectedValue(
      new BrowserError(
        'browser_target_ambiguous',
        'Multiple worktrees have browser tabs open; pass --worktree to target text insertion safely'
      )
    )
    const result = await call(client, 'type', { text: 'a' })
    expect(result.content[0].text).toBe(
      'browser_target_ambiguous: Multiple worktrees have browser tabs open; pass scopeId to target text insertion safely'
    )
  })

  it('browser_no_tab adds the open-a-tab hint', async () => {
    const { client, bridge } = await connect()
    bridge.snapshot.mockRejectedValue(new BrowserError('browser_no_tab', 'No tab'))
    const result = await call(client, 'snapshot')
    expect(result.content[0].text).toBe(
      'browser_no_tab: No tab Open a tab in the embedded browser first.'
    )
  })

  it('maps other exceptions to browser_error and strips the failed command line', async () => {
    const { client, bridge } = await connect()
    bridge.evaluate.mockRejectedValue(
      new Error('Command failed: /secret/path/agent-browser --session s eval\nboom')
    )
    const result = await call(client, 'eval', { expression: '1' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('browser_error: boom')
    bridge.evaluate.mockRejectedValue(new Error('plain failure'))
    const plain = await call(client, 'eval', { expression: '1' })
    expect(plain.content[0].text).toBe('browser_error: plain failure')
  })

  it('returns agent_browser_missing with expected paths when the binary is absent', async () => {
    const { client, bridge } = await connect({
      binary: { found: false, expectedPaths: ['/r/a', '/p/a'] }
    })
    const result = await call(client, 'snapshot')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe(
      'agent_browser_missing: agent-browser binary not found. Expected one of: /r/a, /p/a'
    )
    expect(bridge.snapshot).not.toHaveBeenCalled()
    bridge.tabList.mockReturnValue({ tabs: [] })
    const tabs = await call(client, 'tabs_list')
    expect(tabs.isError).toBeFalsy()
  })

  it('falls back to a generic message when only the failed command line remains', async () => {
    const { client, bridge } = await connect()
    bridge.evaluate.mockRejectedValue(new Error('Command failed: /secret/agent-browser eval'))
    const result = await call(client, 'eval', { expression: '1' })
    expect(result.content[0].text).toBe('browser_error: agent-browser command failed')
  })

  it('strips a Command failed line in the middle of a message', async () => {
    const { client, bridge } = await connect()
    bridge.click.mockRejectedValue(
      new BrowserError(
        'browser_error',
        'before\nCommand failed: /secret/agent-browser click\nafter'
      )
    )
    const result = await call(client, 'click', { element: '#a' })
    expect(result.content[0].text).toBe('browser_error: before\nafter')
  })

  it.each([
    'file:///C:/',
    'C:\\Users\\x\\.ssh\\id_rsa',
    '/etc/passwd',
    '\\\\attacker.example\\share\\x.html'
  ])('goto rejects local file target %s without calling the bridge', async (url) => {
    const { client, bridge } = await connect()
    const result = await call(client, 'goto', { url })
    expect(bridge.goto).not.toHaveBeenCalled()
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toMatch(
      /^invalid_argument: (local files cannot be opened in the embedded browser|unsupported URL)$/
    )
  })

  it('goto reports local files with the dedicated message', async () => {
    const { client } = await connect()
    const result = await call(client, 'goto', { url: 'file:///C:/' })
    expect(result.content[0].text).toBe(
      'invalid_argument: local files cannot be opened in the embedded browser'
    )
  })

  it('goto passes an https URL through unchanged', async () => {
    const { client, bridge } = await connect()
    bridge.goto.mockResolvedValue({ url: 'https://example.com/', title: 'Example' })
    await call(client, 'goto', { url: 'https://example.com' })
    expect(bridge.goto).toHaveBeenCalledWith('https://example.com', undefined, undefined)
  })
})
