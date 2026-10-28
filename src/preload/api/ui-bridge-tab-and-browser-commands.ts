import { ipcRenderer } from 'electron'
import type { BrowserApi } from '../../shared/browser-api-types'

export const browserUiCommandApi = {
  onFocusAddressBar: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      target: Parameters<typeof callback>[0]
    ): void => callback(target)
    ipcRenderer.on('browser:focusAddressBar', listener)
    return () => ipcRenderer.removeListener('browser:focusAddressBar', listener)
  },
  onReloadPage: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      target: Parameters<typeof callback>[0]
    ): void => callback(target)
    ipcRenderer.on('browser:reloadPage', listener)
    return () => ipcRenderer.removeListener('browser:reloadPage', listener)
  },
  onHardReloadPage: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      target: Parameters<typeof callback>[0]
    ): void => callback(target)
    ipcRenderer.on('browser:hardReloadPage', listener)
    return () => ipcRenderer.removeListener('browser:hardReloadPage', listener)
  },
  onHistoryNavigate: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      command: Parameters<typeof callback>[0]
    ): void => callback(command)
    ipcRenderer.on('browser:historyNavigate', listener)
    return () => ipcRenderer.removeListener('browser:historyNavigate', listener)
  },
  onZoomPage: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      command: Parameters<typeof callback>[0]
    ): void => callback(command)
    ipcRenderer.on('browser:zoomPage', listener)
    return () => ipcRenderer.removeListener('browser:zoomPage', listener)
  },
  onSystemResumed: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('browser:systemResumed', listener)
    return () => ipcRenderer.removeListener('browser:systemResumed', listener)
  }
} satisfies Partial<BrowserApi>
