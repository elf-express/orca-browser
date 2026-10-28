import { ipcRenderer } from 'electron'
import type { BrowserApi } from '../../shared/browser-api-types'

export const browserSessionApi = {
  session: {
    listProfiles: () => ipcRenderer.invoke('browser:session:listProfiles'),
    createProfile: (args) => ipcRenderer.invoke('browser:session:createProfile', args),
    deleteProfile: (args) => ipcRenderer.invoke('browser:session:deleteProfile', args),
    importCookies: (args) => ipcRenderer.invoke('browser:session:importCookies', args),
    importFromBrowser: (args) => ipcRenderer.invoke('browser:session:importFromBrowser', args),
    detectBrowsers: () => ipcRenderer.invoke('browser:session:detectBrowsers'),
    resolvePartition: (args) => ipcRenderer.invoke('browser:session:resolvePartition', args),
    clearDefaultCookies: () => ipcRenderer.invoke('browser:session:clearDefaultCookies')
  },
  identity: {
    get: () => ipcRenderer.invoke('browser:identity:get'),
    set: (mode) => ipcRenderer.invoke('browser:identity:set', mode)
  },
  settings: {
    get: () => ipcRenderer.invoke('browser:settings:get'),
    set: (patch) => ipcRenderer.invoke('browser:settings:set', patch)
  }
} satisfies Pick<BrowserApi, 'session' | 'identity' | 'settings'>
