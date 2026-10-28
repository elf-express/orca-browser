import { ipcRenderer } from 'electron'
import type { BrowserApi } from '../../shared/browser-api-types'
import type { BrowserViewportOverride } from '../../shared/browser-workspace-types'

export const browserGuestRegistrationApi = {
  registerGuest: (args) => ipcRenderer.invoke('browser:registerGuest', args),
  isGuestRegistered: (args) => ipcRenderer.invoke('browser:isGuestRegistered', args),
  repairGuestRegistration: (args) => ipcRenderer.invoke('browser:repairGuestRegistration', args),
  unregisterGuest: (args) => ipcRenderer.invoke('browser:unregisterGuest', args),
  openDevTools: (args) => ipcRenderer.invoke('browser:openDevTools', args),
  reportViewportScrollState: (args): void =>
    ipcRenderer.send('browser:reportViewportScrollState', args),
  setViewportOverride: (args: {
    browserPageId: string
    override: BrowserViewportOverride | null
  }): Promise<boolean> => ipcRenderer.invoke('browser:setViewportOverride', args),
  onGuestLoadFailed: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: Parameters<typeof callback>[0]
    ): void => callback(data)
    ipcRenderer.on('browser:guest-load-failed', listener)
    return () => ipcRenderer.removeListener('browser:guest-load-failed', listener)
  },
  onPermissionDenied: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: Parameters<typeof callback>[0]
    ): void => callback(data)
    ipcRenderer.on('browser:permission-denied', listener)
    return () => ipcRenderer.removeListener('browser:permission-denied', listener)
  },
  onPopup: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: Parameters<typeof callback>[0]
    ): void => callback(data)
    ipcRenderer.on('browser:popup', listener)
    return () => ipcRenderer.removeListener('browser:popup', listener)
  }
} satisfies Partial<BrowserApi>
