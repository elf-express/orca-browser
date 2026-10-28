import { useRef } from 'react'
import { Crosshair, ExternalLink, MessageSquarePlus, PenTool, SquareCode } from 'lucide-react'
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
import {
  BrowserChromeElementToolButtons,
  type BrowserChromeElementTools
} from './browser-chrome-element-tool-buttons'
import { translate } from '../../../i18n'
import { MarkupDrawButton } from '../annotate/MarkupDrawButton'

export type BrowserChromeMarkupTool = {
  active: boolean
  disabled: boolean
  onToggle: () => void
  /** Whether this surface may spend the draw tool's one-per-install discovery popover. */
  canShowDiscoveryHint: boolean
}

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
  elementTools = null,
  markup = null,
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
  /** The in-guest element picker (Grab and Annotate); null where the surface cannot run it. */
  elementTools?: BrowserChromeElementTools | null
  /** Draw-on-screenshot; null where the surface cannot capture a page screenshot. */
  markup?: BrowserChromeMarkupTool | null
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
  // Share is absent from this package; its stage stays in the fold order so a
  // surface that adds it folds the tools in the same sequence.
  const present: Record<BrowserChromeFoldStage, boolean> = {
    'import-label': importControl != null,
    import: importControl != null,
    external: openExternal !== null,
    devtools: viewSource !== null,
    share: false,
    draw: markup !== null,
    grab: elementTools !== null,
    annotate: elementTools !== null
  }
  const stages = BROWSER_CHROME_FOLD_ORDER.filter(
    (stage) => present[stage] && stage !== pinnedStage
  )
  const folded = useBrowserChromeToolFold(rowRef, stages)
  const afterMenuCloseRef = useRef<(() => void) | null>(null)

  const foldedTools: BrowserChromeFoldedTool[] = []
  if (elementTools && folded.has('grab')) {
    foldedTools.push({
      stage: 'grab',
      label: translate('auto.components.browser.pane.BrowserPane.fdfc7fe0ef', 'Grab page element'),
      icon: Crosshair,
      onSelect: () => elementTools.onStartIntent('copy'),
      disabled: elementTools.disabled,
      shortcut: elementTools.grabShortcutLabel,
      active: elementTools.activeIntent === 'copy'
    })
  }
  if (elementTools && folded.has('annotate')) {
    foldedTools.push({
      stage: 'annotate',
      label: translate(
        'auto.components.browser.pane.BrowserPane.fc9be38f6f',
        'Annotate page element'
      ),
      icon: MessageSquarePlus,
      onSelect: () => elementTools.onStartIntent('annotate'),
      disabled: elementTools.disabled,
      shortcut: elementTools.annotateShortcutLabel,
      count: elementTools.annotationCount,
      active: elementTools.activeIntent === 'annotate'
    })
  }
  if (markup && folded.has('draw')) {
    foldedTools.push({
      stage: 'draw',
      label: translate('auto.components.browser-pane.markup.drawButton', 'Draw on screenshot'),
      icon: PenTool,
      onSelect: markup.onToggle,
      disabled: markup.disabled,
      active: markup.active
    })
  }
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
  const showFoldedAnnotationDot = folded.has('annotate') && (elementTools?.annotationCount ?? 0) > 0
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

      {elementTools ? (
        <BrowserChromeElementToolButtons
          tools={elementTools}
          showGrab={!folded.has('grab')}
          showAnnotate={!folded.has('annotate')}
        />
      ) : null}

      {markup && !folded.has('draw') ? (
        <MarkupDrawButton
          onClick={markup.onToggle}
          disabled={markup.disabled}
          active={markup.active}
          surfaceActive={markup.canShowDiscoveryHint}
        />
      ) : null}

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
        {/* Keeps pending annotations visible once the annotate button has folded into the overflow menu. */}
        {showFoldedAnnotationDot ? (
          <span className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-primary ring-2 ring-background" />
        ) : null}
      </span>
    </BrowserNavigationControlRow>
  )
}
