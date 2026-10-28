import { useEffect, type JSX, type ReactNode } from 'react'
import { BrowserRendererHostContext, type BrowserRendererHost } from './host-context'
import { clearBrowserRendererHost, setBrowserRendererHost } from './i18n'
import { BrowserPaneOverlayLayer } from './components/browser-pane/assemble-chrome/BrowserPaneOverlayLayer'
import { useBrowserSessionStore } from './store/browser-session-store'
import { useBrowserStateIpcBridge } from './ipc/browser-state-ipc-bridge'

export function BrowserPluginProvider(props: {
  host: BrowserRendererHost
  children: ReactNode
}): JSX.Element {
  const { host, children } = props

  // Set during render so children calling translate() in their first render see the host.
  setBrowserRendererHost(host)

  useEffect(() => {
    // Re-set after mount: a strict-mode effect cleanup clears the host before the re-run.
    setBrowserRendererHost(host)
    return () => clearBrowserRendererHost(host)
  }, [host])

  useBrowserStateIpcBridge()

  const hasBrowserApi = typeof window !== 'undefined' && window.browserAPI !== undefined

  useEffect(() => {
    if (!hasBrowserApi) {
      return
    }
    const state = useBrowserSessionStore.getState()
    void state.loadSettings()
    void state.fetchBrowserSessionProfiles()
    void state.loadIdentity()
  }, [hasBrowserApi])

  // Without the preload API (host unit tests) there is no webview to host, so only children render.
  return (
    <BrowserRendererHostContext.Provider value={host}>
      {children}
      {hasBrowserApi ? <BrowserPaneOverlayLayer /> : null}
    </BrowserRendererHostContext.Provider>
  )
}
