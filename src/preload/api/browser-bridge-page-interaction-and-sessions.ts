import { ipcRenderer } from 'electron'
import type { BrowserApi } from '../../shared/browser-api-types'

export const browserPageInteractionApi = {
  onContextMenuRequested: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: Parameters<typeof callback>[0]
    ): void => callback(data)
    ipcRenderer.on('browser:context-menu-requested', listener)
    return () => ipcRenderer.removeListener('browser:context-menu-requested', listener)
  },
  onContextMenuDismissed: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: Parameters<typeof callback>[0]
    ): void => callback(data)
    ipcRenderer.on('browser:context-menu-dismissed', listener)
    return () => ipcRenderer.removeListener('browser:context-menu-dismissed', listener)
  },
  onOpenLinkInOrcaTab: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: Parameters<typeof callback>[0]
    ): void => callback(data)
    ipcRenderer.on('browser:open-link-in-orca-tab', listener)
    return () => ipcRenderer.removeListener('browser:open-link-in-orca-tab', listener)
  },
  notifyActiveTabChanged: (args) => ipcRenderer.invoke('browser:activeTabChanged', args),
  openExternal: (args) => ipcRenderer.invoke('browser:openExternal', args),
  writeClipboardText: (text) => ipcRenderer.invoke('browser:writeClipboardText', text)
} satisfies Partial<BrowserApi>
