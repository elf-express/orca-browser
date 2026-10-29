import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { AgentBrowserBridge } from '../browser/agent-browser-bridge'
import type { AgentBrowserBinaryResolution } from '../browser/agent-browser-bridge-process'
import { BrowserError } from '../browser/browser-error'
import { isFileUrl, normalizeBrowserNavigationUrl } from '../../shared/browser-url'

export const BROWSER_MCP_TOOL_NAMES = [
  'goto',
  'back',
  'forward',
  'reload',
  'snapshot',
  'click',
  'fill',
  'type',
  'press',
  'screenshot',
  'eval',
  'tabs_list',
  'tab_switch',
  'wait'
] as const

export type BrowserMcpBridge = Pick<
  AgentBrowserBridge,
  | 'goto'
  | 'back'
  | 'forward'
  | 'reload'
  | 'snapshot'
  | 'click'
  | 'fill'
  | 'type'
  | 'keypress'
  | 'screenshot'
  | 'evaluate'
  | 'tabList'
  | 'tabSwitch'
  | 'wait'
>

export type BrowserMcpToolDeps = {
  bridge: BrowserMcpBridge
  getScopeIdForTab(browserPageId: string): string | undefined
  binary: AgentBrowserBinaryResolution
}

const TAB_SELECTION_RULES =
  'Tab selection: (1) With browserPageId, only that page is used; if scopeId is also given the page must belong to that scope, otherwise browser_tab_not_found. ' +
  "(2) With only scopeId, that scope's active tab is used (the one the user last switched to, or the one picked with tab_switch), else its first live tab. " +
  '(3) With neither, the globally last active tab is used, else the first live tab; fill and type instead require exactly one scope with live tabs and return browser_target_ambiguous when several scopes have tabs (pass scopeId). ' +
  '(4) With no tabs at all the call fails with browser_no_tab; tools never open a new tab.'

const targetShape = {
  scopeId: z.string().min(1).optional().describe('Workspace scope that owns the tab'),
  browserPageId: z.string().min(1).optional().describe('Id of a specific tab (see tabs_list)')
}

type Target = { scopeId?: string; browserPageId?: string }

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

function jsonResult(value: unknown): CallToolResult {
  return textResult(JSON.stringify(value))
}

function errorResult(text: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text }] }
}

// Drop every "Command failed: <binary> <argv>" line (as produced by process failures) so process
// paths do not reach the agent; other message text is kept as is.
function sanitizeMessage(message: string): string {
  const cleaned = message.replace(/^Command failed:[^\n]*\n?/gm, '').trim()
  return cleaned === '' ? 'agent-browser command failed' : cleaned
}

function toErrorResult(error: unknown): CallToolResult {
  if (error instanceof BrowserError) {
    let message = sanitizeMessage(error.message)
    if (error.code === 'browser_target_ambiguous') {
      // The bridge speaks Orca CLI; MCP callers target a scope with scopeId.
      message = message.replace(/--worktree\b/g, 'scopeId')
    }
    const hint = error.code === 'browser_no_tab' ? ' Open a tab in the embedded browser first.' : ''
    return errorResult(`${error.code}: ${message}${hint}`)
  }
  const message = error instanceof Error ? error.message : String(error)
  return errorResult(`browser_error: ${sanitizeMessage(message)}`)
}

export function createBrowserMcpServer(deps: BrowserMcpToolDeps): McpServer {
  const { bridge, binary } = deps
  const server = new McpServer({ name: 'orca-browser', version: '1.0.0' })

  const missingBinary = (): CallToolResult | null =>
    binary.found
      ? null
      : errorResult(
          `agent_browser_missing: agent-browser binary not found. Expected one of: ${binary.expectedPaths.join(', ')}`
        )

  // Wraps a tool body with the binary check and uniform error mapping.
  const guarded =
    <A>(run: (args: A) => CallToolResult | Promise<CallToolResult>, needsBinary = true) =>
    async (args: A): Promise<CallToolResult> => {
      if (needsBinary) {
        const missing = missingBinary()
        if (missing) {
          return missing
        }
      }
      try {
        return await run(args)
      } catch (error) {
        return toErrorResult(error)
      }
    }

  const describeTool = (summary: string): string => `${summary} ${TAB_SELECTION_RULES}`

  server.registerTool(
    'goto',
    {
      description: describeTool('Navigate a tab of the embedded browser to a URL.'),
      inputSchema: { url: z.string().min(1), ...targetShape }
    },
    guarded(async ({ url, scopeId, browserPageId }: { url: string } & Target) => {
      // The bridge loads the URL straight into the page without the will-navigate guard, so local
      // files (including UNC paths) must be refused here.
      const normalized = normalizeBrowserNavigationUrl(url)
      if (normalized === null) {
        return errorResult('invalid_argument: unsupported URL')
      }
      if (isFileUrl(normalized)) {
        return errorResult('invalid_argument: local files cannot be opened in the embedded browser')
      }
      return jsonResult(await bridge.goto(url, scopeId, browserPageId))
    })
  )

  server.registerTool(
    'back',
    {
      description: describeTool('Go back in the tab history.'),
      inputSchema: targetShape
    },
    guarded(async ({ scopeId, browserPageId }: Target) =>
      jsonResult(await bridge.back(scopeId, browserPageId))
    )
  )

  server.registerTool(
    'forward',
    {
      description: describeTool('Go forward in the tab history.'),
      inputSchema: targetShape
    },
    guarded(async ({ scopeId, browserPageId }: Target) =>
      jsonResult(await bridge.forward(scopeId, browserPageId))
    )
  )

  server.registerTool(
    'reload',
    {
      description: describeTool('Reload the tab.'),
      inputSchema: targetShape
    },
    guarded(async ({ scopeId, browserPageId }: Target) =>
      jsonResult(await bridge.reload(scopeId, browserPageId))
    )
  )

  server.registerTool(
    'snapshot',
    {
      description: describeTool(
        'Capture an accessibility snapshot of the page. Element refs such as @e1 can be used by click and fill.'
      ),
      inputSchema: targetShape
    },
    guarded(async ({ scopeId, browserPageId }: Target) => {
      const result = await bridge.snapshot(scopeId, browserPageId)
      const meta = JSON.stringify({
        browserPageId: result.browserPageId,
        url: result.url,
        title: result.title
      })
      return textResult(`${meta}\n\n${result.snapshot}`)
    })
  )

  server.registerTool(
    'click',
    {
      description: describeTool('Click an element given by an @eN snapshot ref or a CSS selector.'),
      inputSchema: { element: z.string().min(1), ...targetShape }
    },
    guarded(async ({ element, scopeId, browserPageId }: { element: string } & Target) =>
      jsonResult(await bridge.click(element, scopeId, browserPageId))
    )
  )

  server.registerTool(
    'fill',
    {
      description: describeTool(
        'Replace the value of an input element given by an @eN ref or CSS selector. An empty value clears it.'
      ),
      inputSchema: { element: z.string().min(1), value: z.string(), ...targetShape }
    },
    guarded(
      async ({
        element,
        value,
        scopeId,
        browserPageId
      }: { element: string; value: string } & Target) =>
        jsonResult(await bridge.fill(element, value, scopeId, browserPageId))
    )
  )

  server.registerTool(
    'type',
    {
      description: describeTool('Type text into the currently focused element.'),
      inputSchema: { text: z.string().min(1), ...targetShape }
    },
    guarded(async ({ text, scopeId, browserPageId }: { text: string } & Target) =>
      jsonResult(await bridge.type(text, scopeId, browserPageId))
    )
  )

  server.registerTool(
    'press',
    {
      description: describeTool('Press a key or key combination such as Enter or Control+a.'),
      inputSchema: { key: z.string().min(1), ...targetShape }
    },
    guarded(async ({ key, scopeId, browserPageId }: { key: string } & Target) =>
      jsonResult(await bridge.keypress(key, scopeId, browserPageId))
    )
  )

  server.registerTool(
    'screenshot',
    {
      description: describeTool('Take a screenshot of the page as an image.'),
      inputSchema: { format: z.enum(['png', 'jpeg']).optional(), ...targetShape }
    },
    guarded(async ({ format, scopeId, browserPageId }: { format?: 'png' | 'jpeg' } & Target) => {
      const result = await bridge.screenshot(format, scopeId, browserPageId)
      return {
        content: [{ type: 'image', data: result.data, mimeType: `image/${result.format}` }]
      }
    })
  )

  server.registerTool(
    'eval',
    {
      description: describeTool(
        'Evaluate a JavaScript expression in the page and return the result.'
      ),
      inputSchema: { expression: z.string().min(1), ...targetShape }
    },
    guarded(async ({ expression, scopeId, browserPageId }: { expression: string } & Target) =>
      jsonResult(await bridge.evaluate(expression, scopeId, browserPageId))
    )
  )

  server.registerTool(
    'tabs_list',
    {
      description:
        'List the open tabs of the embedded browser, optionally limited to one scope. ' +
        'Each tab reports browserPageId, scopeId, index, url, title and whether it is active. ' +
        TAB_SELECTION_RULES,
      inputSchema: { scopeId: targetShape.scopeId }
    },
    guarded(({ scopeId }: { scopeId?: string }) => {
      const { tabs } = bridge.tabList(scopeId)
      return jsonResult({
        tabs: tabs.map((tab) => ({
          browserPageId: tab.browserPageId,
          scopeId: deps.getScopeIdForTab(tab.browserPageId),
          index: tab.index,
          url: tab.url,
          title: tab.title,
          active: tab.active
        }))
      })
    }, false)
  )

  server.registerTool(
    'tab_switch',
    {
      description: describeTool(
        "Set the agent's active tab by index or browserPageId (exactly one). This does not change what the user sees."
      ),
      inputSchema: { index: z.number().int().min(0).optional(), ...targetShape }
    },
    guarded(async ({ index, scopeId, browserPageId }: { index?: number } & Target) => {
      if (index === undefined && browserPageId === undefined) {
        return errorResult('invalid_arguments: tab_switch requires index or browserPageId')
      }
      if (index !== undefined && browserPageId !== undefined) {
        return errorResult('invalid_arguments: pass either index or browserPageId, not both')
      }
      return jsonResult(await bridge.tabSwitch(index, scopeId, browserPageId))
    }, false)
  )

  server.registerTool(
    'wait',
    {
      description: describeTool(
        'Wait for a selector, text, URL pattern, load state, JS function or a timeout in milliseconds.'
      ),
      inputSchema: {
        selector: z.string().optional(),
        text: z.string().optional(),
        url: z.string().optional(),
        load: z.string().optional(),
        fn: z.string().optional(),
        state: z.string().optional(),
        timeout: z.number().int().positive().optional(),
        ...targetShape
      }
    },
    guarded(
      async ({
        selector,
        timeout,
        text,
        url,
        load,
        fn,
        state,
        scopeId,
        browserPageId
      }: {
        selector?: string
        timeout?: number
        text?: string
        url?: string
        load?: string
        fn?: string
        state?: string
      } & Target) =>
        jsonResult(
          await bridge.wait(
            { selector, timeout, text, url, load, fn, state },
            scopeId,
            browserPageId
          )
        )
    )
  )

  return server
}
