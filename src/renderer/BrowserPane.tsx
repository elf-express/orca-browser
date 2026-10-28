import { useEffect, type CSSProperties, type JSX } from 'react'
import { browserScopeAnchorName } from './components/browser-pane/assemble-chrome/browser-scope-anchor'
import { useBrowserRendererHost } from './host-context'
import { useBrowserStore } from './store/browser-store'

export function BrowserPane(props: { scopeId: string; active: boolean }): JSX.Element {
  useBrowserRendererHost()
  const { scopeId, active } = props
  const anchorName = browserScopeAnchorName(scopeId)

  useEffect(() => {
    useBrowserStore.getState().ensureScopePage(scopeId)
  }, [scopeId])

  useEffect(() => {
    useBrowserStore.getState().setPaneMount(scopeId, { active })
  }, [scopeId, active])

  useEffect(() => {
    return () => useBrowserStore.getState().setPaneMount(scopeId, null)
  }, [scopeId])

  // The overlay slot for this scope follows this element through the CSS anchor.
  const style: CSSProperties = { anchorName }

  return (
    <div
      data-orca-browser-pane=""
      data-scope-id={scopeId}
      data-active={String(active)}
      data-orca-browser-anchor={anchorName}
      className="relative flex h-full min-h-0 flex-1"
      style={style}
    />
  )
}
