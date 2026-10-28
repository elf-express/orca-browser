import { powerMonitor } from 'electron'

/** Tells the main window's renderer when the machine wakes, so panes can refresh stale pages. */
export function installSystemResumeForwarding(
  getMainWindow: () => Electron.BrowserWindow | null
): () => void {
  const onResume = (): void => {
    const mainWindow = getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }
    mainWindow.webContents.send('browser:systemResumed')
  }
  powerMonitor.on('resume', onResume)
  return () => {
    powerMonitor.removeListener('resume', onResume)
  }
}
