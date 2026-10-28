import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type { BrowserPage as BrowserPageState } from '../../../../shared/browser-workspace-types'
import { BrowserPageToolbar } from './browser-page-toolbar'
import type { useBrowserPageReloadActions } from '../navigate/use-browser-page-reload-actions'

export function BrowserPageChromeHeader({
  chromeHeaderRef,
  browserTab,
  webviewRef,
  addressBarInputRef,
  dismissAddressBarSuggestionsRef,
  reload,
  addressBarValue,
  setAddressBarValue,
  submitAddressBar,
  navigateToUrl,
  currentUrl
}: {
  chromeHeaderRef: RefObject<HTMLDivElement | null>
  browserTab: BrowserPageState
  webviewRef: MutableRefObject<Electron.WebviewTag | null>
  addressBarInputRef: MutableRefObject<HTMLInputElement | null>
  dismissAddressBarSuggestionsRef: MutableRefObject<(() => void) | null>
  reload: ReturnType<typeof useBrowserPageReloadActions>
  addressBarValue: string
  setAddressBarValue: Dispatch<SetStateAction<string>>
  submitAddressBar: () => void
  navigateToUrl: (url: string) => void
  currentUrl: string
}): React.JSX.Element {
  return (
    <div ref={chromeHeaderRef} className="pointer-events-auto shrink-0">
      <BrowserPageToolbar
        browserPageId={browserTab.id}
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
    </div>
  )
}
