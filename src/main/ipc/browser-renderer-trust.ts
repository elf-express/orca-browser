import { getBrowserHost } from '../plugin-runtime'

export function isTrustedBrowserRenderer(sender: Electron.WebContents): boolean {
  return (
    !sender.isDestroyed() &&
    sender.getType() === 'window' &&
    sender.id === getBrowserHost().getMainWindow()?.webContents.id
  )
}
