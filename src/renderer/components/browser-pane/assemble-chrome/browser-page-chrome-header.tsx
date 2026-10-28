import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type { BrowserPage as BrowserPageState } from '../../../../shared/browser-workspace-types'
import { translate } from '../../../i18n'
import { BrowserPageToolbar } from './browser-page-toolbar'
import type { useBrowserPageReloadActions } from '../navigate/use-browser-page-reload-actions'

export function BrowserPageChromeHeader({
  chromeHeaderRef,
  browserTab,
  isActive,
  webviewRef,
  addressBarInputRef,
  dismissAddressBarSuggestionsRef,
  reload,
  addressBarValue,
  setAddressBarValue,
  submitAddressBar,
  navigateToUrl,
  currentUrl,
  resourceNotice,
  setResourceNotice
}: {
  chromeHeaderRef: RefObject<HTMLDivElement | null>
  browserTab: BrowserPageState
  isActive: boolean
  webviewRef: MutableRefObject<Electron.WebviewTag | null>
  addressBarInputRef: MutableRefObject<HTMLInputElement | null>
  dismissAddressBarSuggestionsRef: MutableRefObject<(() => void) | null>
  reload: ReturnType<typeof useBrowserPageReloadActions>
  addressBarValue: string
  setAddressBarValue: Dispatch<SetStateAction<string>>
  submitAddressBar: () => void
  navigateToUrl: (url: string) => void
  currentUrl: string
  resourceNotice: string | null
  setResourceNotice: Dispatch<SetStateAction<string | null>>
}): React.JSX.Element {
  return (
    <div ref={chromeHeaderRef} className="pointer-events-auto shrink-0">
      <BrowserPageToolbar
        page={browserTab}
        isActive={isActive}
        canGoBack={browserTab.canGoBack}
        canGoForward={browserTab.canGoForward}
        loading={browserTab.loading}
        currentUrl={currentUrl}
        webviewRef={webviewRef}
        reloadMenuOpen={reload.reloadMenuOpen}
        setReloadMenuOpen={reload.setReloadMenuOpen}
        reloadButtonLabel={reload.reloadButtonLabel}
        reloadButtonLabelKind={reload.reloadButtonLabelKind}
        reloadShortcut={reload.reloadShortcut}
        hardReloadShortcut={reload.hardReloadShortcut}
        runReloadTrigger={reload.runReloadTrigger}
        addressBarValue={addressBarValue}
        setAddressBarValue={setAddressBarValue}
        submitAddressBar={submitAddressBar}
        navigateToUrl={navigateToUrl}
        addressBarInputRef={addressBarInputRef}
        dismissAddressBarSuggestionsRef={dismissAddressBarSuggestionsRef}
      />
      {resourceNotice ? (
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground">
          <span>{resourceNotice}</span>
          <button
            type="button"
            onClick={() => setResourceNotice(null)}
            className="shrink-0 text-muted-foreground/60 hover:text-foreground"
            aria-label={translate('auto.components.browser.pane.BrowserPane.2fdca7df09', 'Dismiss')}
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  )
}
