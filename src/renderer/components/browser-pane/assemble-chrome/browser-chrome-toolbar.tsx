import { useRef } from 'react'
import { ExternalLink, SquareCode } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '../../../ui/button'
import {
  BrowserNavigationControlRow,
  type BrowserNavigationControls
} from './browser-navigation-control-row'
import {
  BrowserChromeDefaultOverflowMenu,
  type BrowserChromeFoldedTool,
  type BrowserChromeOverflowMenuProps
} from './browser-chrome-folded-tools'
import {
  BROWSER_CHROME_FOLD_ORDER,
  useBrowserChromeToolFold,
  type BrowserChromeFoldStage
} from './use-browser-chrome-tool-fold'

export type BrowserChromeToolAction = {
  onSelect: () => void
  label: string
  disabled?: boolean
  /** True when the surface's overflow menu already exposes this action. */
  alreadyInOverflowMenu?: boolean
}

function BrowserChromeActionButton({
  action,
  icon: Icon
}: {
  action: BrowserChromeToolAction
  icon: LucideIcon
}): React.JSX.Element {
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7"
      onClick={action.onSelect}
      title={action.label}
      aria-label={action.label}
      disabled={action.disabled}
    >
      <Icon className="size-4" />
    </Button>
  )
}

/**
 * The whole browser chrome bar — history, identity, tools — for every surface that renders guest
 * content: the browsing pane and the workspace document preview.
 *
 * Why one component and not a shared row plus two tool clusters: a tool added here has to appear
 * on both surfaces to stay honest, and a per-surface cluster is exactly how they drift apart. A
 * surface omits a tool only by passing null, and each null below says why that tool cannot apply.
 */
export function BrowserChromeToolbar({
  controls,
  addressSlot,
  reloadControl,
  reloadLabel,
  importControl = null,
  viewSource,
  openExternal,
  overflowMenu = null,
  showTourAnchors = false,
  pinnedStage
}: {
  controls: BrowserNavigationControls
  addressSlot: React.ReactNode
  reloadControl?: React.ReactNode
  reloadLabel?: string
  /** Cookie import — a browsing session concept; null where there is no session to import into. */
  importControl?: ((compact: boolean) => React.ReactNode) | null
  viewSource: BrowserChromeToolAction | null
  openExternal: BrowserChromeToolAction | null
  /** The surface's ⋯ menu; null falls back to a default menu holding only the folded tools. */
  overflowMenu?: ((props: BrowserChromeOverflowMenuProps) => React.ReactNode) | null
  /** Only the browsing pane anchors the contextual tour; a second anchor would steal its steps. */
  showTourAnchors?: boolean
  /** Keeps the active contextual-tour control measurable while the remaining tools still fold. */
  pinnedStage?: BrowserChromeFoldStage
}): React.JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null)
  const overflowTriggerRef = useRef<HTMLButtonElement>(null)
  // Share, draw, grab and annotate are absent from this package; the stages stay in the fold
  // order so a surface that adds those tools folds them in the same sequence.
  const present: Record<BrowserChromeFoldStage, boolean> = {
    'import-label': importControl != null,
    import: importControl != null,
    external: openExternal !== null,
    devtools: viewSource !== null,
    share: false,
    draw: false,
    grab: false,
    annotate: false
  }
  const stages = BROWSER_CHROME_FOLD_ORDER.filter(
    (stage) => present[stage] && stage !== pinnedStage
  )
  const folded = useBrowserChromeToolFold(rowRef, stages)
  const afterMenuCloseRef = useRef<(() => void) | null>(null)

  const foldedTools: BrowserChromeFoldedTool[] = []
  if (viewSource && folded.has('devtools') && !viewSource.alreadyInOverflowMenu) {
    foldedTools.push({ stage: 'devtools', icon: SquareCode, ...viewSource })
  }
  if (openExternal && folded.has('external') && !openExternal.alreadyInOverflowMenu) {
    foldedTools.push({ stage: 'external', icon: ExternalLink, ...openExternal })
  }

  const runAfterMenuClose = (action: () => void): void => {
    afterMenuCloseRef.current = action
  }
  const onMenuCloseAutoFocus = (event: Event): void => {
    const action = afterMenuCloseRef.current
    if (!action) {
      return
    }
    afterMenuCloseRef.current = null
    event.preventDefault()
    action()
  }
  const overflowProps: BrowserChromeOverflowMenuProps = {
    triggerRef: overflowTriggerRef,
    tools: foldedTools,
    deferUntilClose: runAfterMenuClose,
    onMenuCloseAutoFocus
  }

  return (
    <BrowserNavigationControlRow
      rowRef={rowRef}
      controls={controls}
      addressSlot={addressSlot}
      reloadControl={reloadControl}
      reloadLabel={reloadLabel}
      showTourAnchors={showTourAnchors}
    >
      {folded.has('import') ? null : importControl?.(folded.has('import-label'))}

      {viewSource && !folded.has('devtools') ? (
        <BrowserChromeActionButton action={viewSource} icon={SquareCode} />
      ) : null}

      {openExternal && !folded.has('external') ? (
        <BrowserChromeActionButton action={openExternal} icon={ExternalLink} />
      ) : null}

      <span className="relative inline-flex">
        {overflowMenu ? (
          // oxlint-disable-next-line react/refs -- Intentional: overflowProps carries a ref object and closures that touch refs only from event handlers.
          overflowMenu(overflowProps)
        ) : (
          <BrowserChromeDefaultOverflowMenu {...overflowProps} />
        )}
      </span>
    </BrowserNavigationControlRow>
  )
}
