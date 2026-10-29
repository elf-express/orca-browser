import { ipcRenderer } from 'electron'
import type { BrowserApi } from '../../shared/browser-api-types'
import type { GrabIntent } from '../../shared/browser-grab-types'

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
  writeClipboardText: (text) => ipcRenderer.invoke('browser:writeClipboardText', text),
  setGrabMode: (args) => ipcRenderer.invoke('browser:setGrabMode', args),
  awaitGrabSelection: (args) => ipcRenderer.invoke('browser:awaitGrabSelection', args),
  cancelGrab: (args) => ipcRenderer.invoke('browser:cancelGrab', args),
  captureSelectionScreenshot: (args) =>
    ipcRenderer.invoke('browser:captureSelectionScreenshot', args),
  extractHoverPayload: (args) => ipcRenderer.invoke('browser:extractHoverPayload', args),
  onGrabModeToggle: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      browserPageId: string,
      intent: GrabIntent
    ): void => callback(browserPageId, intent)
    ipcRenderer.on('browser:grabModeToggle', listener)
    return () => ipcRenderer.removeListener('browser:grabModeToggle', listener)
  },
  onGrabActionShortcut: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: Parameters<typeof callback>[0]
    ): void => callback(data)
    ipcRenderer.on('browser:grabActionShortcut', listener)
    return () => ipcRenderer.removeListener('browser:grabActionShortcut', listener)
  }
} satisfies Partial<BrowserApi>
