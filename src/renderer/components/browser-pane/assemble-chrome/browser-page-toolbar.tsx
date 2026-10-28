import type { Dispatch, RefObject, SetStateAction } from 'react'
import { translate } from '../../../i18n'
import { TooltipProvider } from '../../../ui/tooltip'
import type { BrowserReloadTrigger } from '../navigate/browser-reload-action'
import { getOpenableExternalUrl } from '../describe-page/browser-page-url-display'
import BrowserAddressBar from './BrowserAddressBar'
import { BrowserChromeToolbar } from './browser-chrome-toolbar'
import { BrowserReloadControl } from './browser-reload-control'
import { BrowserImportHintButton } from './BrowserImportHintButton'
import { BrowserToolbarMenu } from './BrowserToolbarMenu'
import { destroyPersistentWebview } from '../host-guest/webview-registry'
import type { BrowserPage } from '../../../../shared/browser-workspace-types'

/** Binds the shared browser chrome to a browsing page: an editable address bar and the page tools. */
export function BrowserPageToolbar({
  page,
  isActive,
  canGoBack,
  canGoForward,
  loading,
  currentUrl,
  webviewRef,
  reloadMenuOpen,
  setReloadMenuOpen,
  reloadButtonLabel,
  reloadButtonLabelKind,
  reloadShortcut,
  hardReloadShortcut,
  runReloadTrigger,
  addressBarValue,
  setAddressBarValue,
  submitAddressBar,
  navigateToUrl,
  addressBarInputRef,
  dismissAddressBarSuggestionsRef
}: {
  page: BrowserPage
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
  /** The page's live URL; the open-externally target is derived from it. */
  currentUrl: string
  webviewRef: RefObject<Electron.WebviewTag | null>
  reloadMenuOpen: boolean
  setReloadMenuOpen: Dispatch<SetStateAction<boolean>>
  reloadButtonLabel: string
  reloadButtonLabelKind: 'stop' | 'retry' | 'reload'
  reloadShortcut: string
  hardReloadShortcut: string
  runReloadTrigger: (trigger: BrowserReloadTrigger) => void
  addressBarValue: string
  setAddressBarValue: Dispatch<SetStateAction<string>>
  submitAddressBar: () => void
  navigateToUrl: (url: string) => void
  addressBarInputRef: RefObject<HTMLInputElement | null>
  dismissAddressBarSuggestionsRef: RefObject<(() => void) | null>
}): React.JSX.Element {
  const browserPageId = page.id
  const externalUrl = getOpenableExternalUrl(currentUrl)

  return (
    <TooltipProvider>
      <BrowserChromeToolbar
        controls={{
          canGoBack,
          canGoForward,
          loading,
          goBack: () => webviewRef.current?.goBack(),
          goForward: () => webviewRef.current?.goForward(),
          reload: () => runReloadTrigger('button'),
          navigate: navigateToUrl
        }}
        addressSlot={
          <BrowserAddressBar
            value={addressBarValue}
            onChange={setAddressBarValue}
            onSubmit={submitAddressBar}
            onNavigate={navigateToUrl}
            inputRef={addressBarInputRef}
            dismissSuggestionsRef={dismissAddressBarSuggestionsRef}
          />
        }
        reloadControl={
          <BrowserReloadControl
            menuOpen={reloadMenuOpen}
            onMenuOpenChange={setReloadMenuOpen}
            label={reloadButtonLabel}
            loading={loading}
            showShortcutHint={reloadButtonLabelKind === 'reload'}
            reloadShortcut={reloadShortcut}
            hardReloadShortcut={hardReloadShortcut}
            onPrimary={() => runReloadTrigger('button')}
            onReload={() => runReloadTrigger('reload')}
            onHardReload={() => runReloadTrigger('hard-reload')}
          />
        }
        importControl={(compact) => (
          <BrowserImportHintButton profileId={page.sessionProfileId} compact={compact} />
        )}
        overflowMenu={(overflow) => (
          <BrowserToolbarMenu
            currentProfileId={page.sessionProfileId}
            scopeId={page.scopeId}
            browserPageId={page.id}
            viewportPresetId={page.viewportPresetId}
            onDestroyWebview={() => void destroyPersistentWebview(page.id)}
            isActive={isActive}
            overflow={overflow}
          />
        )}
        viewSource={{
          onSelect: () => void window.browserAPI!.openDevTools({ browserPageId }),
          label: translate(
            'auto.components.browser.pane.BrowserPane.ec75d0c412',
            'Open browser devtools'
          )
        }}
        openExternal={{
          onSelect: () => {
            if (!externalUrl) {
              return
            }
            void window.browserAPI!.openExternal({ url: externalUrl })
          },
          label: translate(
            'auto.components.browser.pane.BrowserPane.0f41bf80c7',
            'Open in default browser'
          ),
          disabled: !externalUrl
        }}
      />
    </TooltipProvider>
  )
}
