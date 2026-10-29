import { ipcMain } from 'electron'
import type { BrowserMcpEndpoint, BrowserMcpStatus } from '../../shared/browser-api-types'
import { BROWSER_MCP_INVOKE_CHANNELS } from '../../shared/browser-ipc-channels'
import { getMcpEndpoint, getMcpStatus, rotateMcpToken } from '../mcp/browser-mcp-runtime'
import { isTrustedBrowserRenderer } from './browser-renderer-trust'

function assertTrusted(sender: Electron.WebContents): void {
  if (!isTrustedBrowserRenderer(sender)) {
    throw new Error('Untrusted renderer')
  }
}

export function registerBrowserMcpHandlers(): void {
  unregisterBrowserMcpHandlers()

  // The endpoint carries the bearer token; only the trusted main renderer may read it.
  ipcMain.handle('browser:mcpGetEndpoint', (event): BrowserMcpEndpoint | null =>
    isTrustedBrowserRenderer(event.sender) ? getMcpEndpoint() : null
  )

  ipcMain.handle('browser:mcpGetStatus', (event): BrowserMcpStatus => {
    assertTrusted(event.sender)
    return getMcpStatus()
  })

  ipcMain.handle('browser:mcpRotateToken', (event): Promise<string> => {
    assertTrusted(event.sender)
    return rotateMcpToken()
  })
}

export function unregisterBrowserMcpHandlers(): void {
  for (const channel of BROWSER_MCP_INVOKE_CHANNELS) {
    ipcMain.removeHandler(channel)
  }
}
