import { matchBrowserShortcut, type BrowserShortcutInput } from '../../shared/browser-keybindings'
import type { BrowserPageZoomDirection } from '../../shared/browser-page-zoom'
import type { BrowserFindTarget } from '../../shared/browser-find-source'
import type { ResolveRenderer } from './browser-guest-renderer-target'

export type GuestShortcutInput = BrowserShortcutInput & { isAutoRepeat?: boolean }

export type GuestShortcutForwardContext = {
  browserTabId: string
  resolveRenderer: ResolveRenderer
  forwardBrowserPageZoom: (event: Electron.Event, direction: BrowserPageZoomDirection) => void
}

export function forwardGuestShortcutInput(
  ctx: GuestShortcutForwardContext,
  event: Electron.Event,
  input: GuestShortcutInput
): boolean {
  const { browserTabId, resolveRenderer, forwardBrowserPageZoom } = ctx
  const action = matchBrowserShortcut(input, process.platform)
  if (action === 'zoom.in' || action === 'zoom.out' || action === 'zoom.reset') {
    // Why: focused guest key events never reach the renderer-owned webview ref that applies page zoom.
    forwardBrowserPageZoom(
      event,
      action === 'zoom.in' ? 'in' : action === 'zoom.out' ? 'out' : 'reset'
    )
    return true
  }
  if (input.isAutoRepeat) {
    return false
  }
  const renderer = resolveRenderer(browserTabId)
  if (!renderer) {
    return false
  }
  if (action === 'browser.focusAddressBar') {
    // Why: the address bar lives in renderer chrome, not the guest page; forward so the pane owning it can focus its input.
    renderer.send('browser:focusAddressBar', { browserPageId: browserTabId })
  } else if (action === 'browser.hardReload') {
    // Why: forward hard reload so reloadIgnoringCache() runs on the renderer's parked-webview ref that owns the guest surface.
    renderer.send('browser:hardReloadPage', { browserPageId: browserTabId })
  } else if (action === 'browser.reload') {
    // Why: forward soft reload so the renderer's reload() hits the parked-webview eviction the guest's built-in shortcut skips.
    renderer.send('browser:reloadPage', { browserPageId: browserTabId })
  } else if (action === 'browser.find') {
    const target: BrowserFindTarget = { browserPageId: browserTabId }
    renderer.send('browser:findInPage', target)
  } else if (action === 'browser.annotateElement') {
    // Why: a focused guest never surfaces the annotate chord to the renderer, so forward it as a picker toggle.
    renderer.send('browser:grabModeToggle', browserTabId, 'annotate')
  } else if (action === 'browser.back') {
    // Why: macOS Logitech side-button remaps arrive as history keystrokes, not mouse events; forward so the renderer can goBack().
    renderer.send('browser:historyNavigate', { browserPageId: browserTabId, direction: 'back' })
  } else if (action === 'browser.forward') {
    // Why: same as browser.back; the focused guest cannot call the renderer-owned webview's goForward() directly.
    renderer.send('browser:historyNavigate', {
      browserPageId: browserTabId,
      direction: 'forward'
    })
  } else {
    return false
  }
  // Why: preventDefault stops the guest page from also processing the chord (e.g. Cmd+L focusing a browser-internal control).
  event.preventDefault()
  return true
}
