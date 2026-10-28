import type { BrowserPageZoomDirection } from '../../shared/browser-page-zoom'
import type { ResolveRenderer } from './browser-guest-renderer-target'
import { consumeRecentGuestWheelZoom } from './browser-guest-wheel-zoom'
import {
  forwardGuestShortcutInput,
  type GuestShortcutForwardContext
} from './browser-guest-shortcut-dispatch'

// Why: a focused webview guest is its own Chromium process whose key events never reach the renderer; forward shortcuts from here.
export function setupGuestShortcutForwarding(args: {
  browserTabId: string
  guest: Electron.WebContents
  resolveRenderer: ResolveRenderer
}): () => void {
  const { browserTabId, guest, resolveRenderer } = args

  const forwardBrowserPageZoom = (
    event: Electron.Event,
    direction: BrowserPageZoomDirection
  ): void => {
    event.preventDefault()
    const renderer = resolveRenderer(browserTabId)
    renderer?.send('browser:zoomPage', { browserPageId: browserTabId, direction })
  }

  const forwardContext: GuestShortcutForwardContext = {
    browserTabId,
    resolveRenderer,
    forwardBrowserPageZoom
  }

  const handler = (event: Electron.Event, input: Electron.Input): void => {
    if (input.type !== 'keyDown') {
      return
    }
    forwardGuestShortcutInput(forwardContext, event, input)
  }

  const zoomCommandHandler = (
    event: Electron.Event,
    zoomDirection: 'in' | 'out' | 'reset'
  ): void => {
    if (zoomDirection !== 'in' && zoomDirection !== 'out') {
      return
    }
    // Why: some layouts/platforms turn Ctrl/Cmd +/- into Electron's native zoom before before-input-event reaches the guest.
    if (consumeRecentGuestWheelZoom(guest, zoomDirection)) {
      event.preventDefault()
      return
    }
    forwardBrowserPageZoom(event, zoomDirection)
  }

  guest.on('before-input-event', handler)
  guest.on('zoom-changed', zoomCommandHandler)
  return () => {
    try {
      guest.off('before-input-event', handler)
      guest.off('zoom-changed', zoomCommandHandler)
    } catch {
      // Why: best-effort — guest may already be destroyed during teardown.
    }
  }
}
