import { ipcRenderer } from 'electron'
import type { BrowserMcpApi } from '../../shared/browser-api-types'

export const browserMcpApi: BrowserMcpApi = {
  getEndpoint: () => ipcRenderer.invoke('browser:mcpGetEndpoint'),
  getStatus: () => ipcRenderer.invoke('browser:mcpGetStatus'),
  rotateToken: () => ipcRenderer.invoke('browser:mcpRotateToken')
}
