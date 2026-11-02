import { join, resolve } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { getMcpEndpoint, installBrowserPlugin } from '../../src/main'
import type { BrowserPluginHandle } from '../../src/main'

// Keep playground profiles, cookies and the MCP token out of the real Electron userData.
app.setPath('userData', resolve(__dirname, '../../.playground-data'))

let mainWindow: BrowserWindow | null = null
let browser: BrowserPluginHandle | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'orca-browser playground',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      webviewTag: true
    }
  })
  mainWindow.removeMenu()
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function logMcpEndpoint(attempt = 0): void {
  const endpoint = getMcpEndpoint()
  if (endpoint) {
    console.info(`[playground] MCP endpoint: ${endpoint.url}`)
    console.info(`[playground] MCP token:    ${endpoint.token}`)
    console.info(
      `[playground] claude mcp add --transport http orca-browser-dev ${endpoint.url} --header "Authorization: Bearer ${endpoint.token}"`
    )
    return
  }
  if (attempt < 20) {
    setTimeout(() => logMcpEndpoint(attempt + 1), 250)
  } else {
    console.warn('[playground] MCP server is not listening; see the orca-browser error log above')
  }
}

void app.whenReady().then(() => {
  browser = installBrowserPlugin({
    host: {
      getMainWindow: () => mainWindow,
      userDataDir: app.getPath('userData'),
      resourcesPath: process.resourcesPath,
      logger: console,
      openExternal: (url) => shell.openExternal(url)
    }
  })
  createWindow()
  logMcpEndpoint()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => void browser?.dispose())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
