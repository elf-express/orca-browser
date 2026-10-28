import { memo, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useBrowserStore } from '../../../store/browser-store'
import { registerBrowserOverlaySlotViewport } from '../host-guest/browser-page-viewport'
import BrowserScopePane from './browser-workspace-pane'
import { DeferredBrowserContent } from './DeferredBrowserContent'
import { browserScopeAnchorName } from './browser-scope-anchor'

// Why: Electron <webview> destroys its guest on DOM reparent, so every scope renders once in this overlay and the host's BrowserPane placeholder only supplies the CSS anchor the slot follows.

// Memoized so unrelated scope changes do not re-render every BrowserScopePane subtree.
const BrowserOverlaySlot = memo(function BrowserOverlaySlot({
  scopeId
}: {
  scopeId: string
}): React.JSX.Element {
  const isActive = useBrowserStore((state) => state.paneMountByScope[scopeId]?.active === true)
  // Why: persistent page viewports (webview guests) live under this root so they survive BrowserPane unmounts without reparenting.
  const setSlotViewportRef = useCallback(
    (node: HTMLDivElement | null): void => {
      registerBrowserOverlaySlotViewport(scopeId, node)
    },
    [scopeId]
  )
  const anchorName = browserScopeAnchorName(scopeId)
  // CSS anchor positioning pins the slot to its placeholder; a parked slot is display:none so its guest stays alive.
  const style: React.CSSProperties = useMemo(
    () => ({
      position: 'fixed',
      positionAnchor: anchorName,
      top: `anchor(${anchorName} top)`,
      left: `anchor(${anchorName} left)`,
      width: `anchor-size(${anchorName} width)`,
      height: `anchor-size(${anchorName} height)`,
      display: isActive ? 'flex' : 'none',
      pointerEvents: isActive ? 'auto' : 'none'
    }),
    [anchorName, isActive]
  )

  return (
    <div
      style={style}
      className="min-h-0 flex-col"
      data-orca-browser-scope-slot={scopeId}
      data-orca-browser-anchor={anchorName}
      data-browser-overlay-tab-id={scopeId}
    >
      <div ref={setSlotViewportRef} className="absolute inset-0 flex min-h-0 flex-col" />
      <DeferredBrowserContent mountEligible={isActive}>
        <BrowserScopePane scopeId={scopeId} isActive={isActive} />
      </DeferredBrowserContent>
    </div>
  )
})

export const BrowserPaneOverlayLayer = memo(function BrowserPaneOverlayLayer(): React.JSX.Element {
  const scopeIds = useBrowserStore(useShallow((state) => Object.keys(state.pagesByScope)))
  return (
    <>
      {scopeIds.map((scopeId) => (
        <BrowserOverlaySlot key={scopeId} scopeId={scopeId} />
      ))}
    </>
  )
})

export default BrowserPaneOverlayLayer
