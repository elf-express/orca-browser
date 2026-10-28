import { useMemo } from 'react'
import { useBrowserStore } from '../../../store/browser-store'
import { getBrowserPagesForWorkspace } from './browser-pane-page-selection'
import { BrowserPageStrip } from './BrowserPageStrip'
import { BrowserPagePane } from './browser-page-pane'
import { DeferredBrowserContent } from './DeferredBrowserContent'
import { isBrowserPagePanePaintable } from '../host-guest/browser-page-paintability'
import {
  isBrowserPageMountAdmitted,
  useAnyBrowserPageMountAdmission
} from '../host-guest/browser-page-mount-admission'

export function BrowserScopePane({
  scopeId,
  isActive
}: {
  scopeId: string
  isActive: boolean
}): React.JSX.Element {
  const browserPages = useBrowserStore((s) => getBrowserPagesForWorkspace(s.pagesByScope, scopeId))
  const activePageId = useBrowserStore((s) => s.activePageIdByScope[scopeId] ?? null)
  const updateBrowserPageState = useBrowserStore((s) => s.updateBrowserPageState)
  const setBrowserPageUrl = useBrowserStore((s) => s.setBrowserPageUrl)
  const setActiveBrowserPage = useBrowserStore((s) => s.setActiveBrowserPage)
  const closeBrowserPage = useBrowserStore((s) => s.closeBrowserPage)
  const activeBrowserPage =
    browserPages.find((page) => page.id === activePageId) ?? browserPages[0] ?? null
  const browserPageIds = useMemo(() => browserPages.map((page) => page.id), [browserPages])
  const hasAdmittedPage = useAnyBrowserPageMountAdmission(browserPageIds)

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {browserPages.length >= 2 ? (
        <BrowserPageStrip
          pages={browserPages}
          activePageId={activeBrowserPage?.id ?? null}
          onSelect={(pageId) => setActiveBrowserPage(scopeId, pageId)}
          onClose={closeBrowserPage}
        />
      ) : null}
      <div className="relative flex min-h-0 flex-1">
        {browserPages.map((page) => (
          <DeferredBrowserContent
            key={page.id}
            retainMounted={isActive}
            mountEligible={isBrowserPagePanePaintable({
              isActive:
                (isActive && page.id === activeBrowserPage?.id) ||
                (hasAdmittedPage && isBrowserPageMountAdmitted(page.id))
            })}
          >
            <BrowserPagePane
              browserTab={page}
              workspaceId={scopeId}
              scopeId={scopeId}
              sessionProfileId={null}
              sessionPartition={null}
              isActive={isActive && page.id === activeBrowserPage?.id}
              chromeShortcutScope={
                isActive && page.id === activeBrowserPage?.id ? 'focused' : 'inactive'
              }
              inputLocked={false}
              onUpdatePageState={updateBrowserPageState}
              onSetUrl={setBrowserPageUrl}
            />
          </DeferredBrowserContent>
        ))}
      </div>
    </div>
  )
}

export default BrowserScopePane
