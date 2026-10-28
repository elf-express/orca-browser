import { DEFAULT_MCP_PORT, type BrowserHost, type BrowserPluginOptions } from '../shared'

export type ResolvedBrowserPluginOptions = { host: BrowserHost; mcpPort: number }

export function resolveBrowserPluginOptions(
  opts: BrowserPluginOptions
): ResolvedBrowserPluginOptions {
  const mcpPort = opts.mcp?.port ?? DEFAULT_MCP_PORT
  if (!Number.isInteger(mcpPort) || mcpPort < 1024 || mcpPort > 65535) {
    throw new RangeError('orca-browser: mcp.port must be an integer between 1024 and 65535')
  }
  return { host: opts.host, mcpPort }
}
