import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { translate } from '../../../i18n'
import { toHttpsRecoveryUrl } from '../../../../shared/browser-url'
import type { BrowserPage as BrowserPageState } from '../../../../shared/browser-workspace-types'
import { BROWSER_GUEST_RECOVERY_ERROR_CODE } from '../host-guest/browser-page-guest-recovery'
import { BrowserLoadFailureOverlay } from '../navigate/browser-load-failure-overlay'
import { retryBrowserTabLoad, toDisplayUrl } from '../describe-page/browser-page-url-display'
import type { BrowserTabPageState } from '../describe-page/browser-page-types'
import { BrowserPageZoomIndicator } from './browser-page-zoom-indicator'
import BrowserFind from './BrowserFind'

export function BrowserPageViewportOverlays({
  browserZoomIndicatorState,
  browserZoomPercent,
  findOpen,
  setFindOpen,
  webviewRef,
  showFailureOverlay,
  browserTab,
  failureExternalUrl,
  failedNavigationUrl,
  onUpdatePageStateRef,
  retryGuestRecoveryRef,
  navigateToUrl,
  setResourceNotice
}: {
  browserZoomIndicatorState: { ariaHidden: boolean; opacityClassName: string }
  browserZoomPercent: number
  findOpen: boolean
  setFindOpen: Dispatch<SetStateAction<boolean>>
  webviewRef: MutableRefObject<Electron.WebviewTag | null>
  showFailureOverlay: boolean
  browserTab: BrowserPageState
  failureExternalUrl: string | null
  failedNavigationUrl: string
  onUpdatePageStateRef: MutableRefObject<(tabId: string, updates: BrowserTabPageState) => void>
  retryGuestRecoveryRef: MutableRefObject<() => void>
  navigateToUrl: (url: string) => void
  setResourceNotice: Dispatch<SetStateAction<string | null>>
}): React.JSX.Element {
  return (
    <>
      <BrowserPageZoomIndicator state={browserZoomIndicatorState} percent={browserZoomPercent} />
      <BrowserFind isOpen={findOpen} onClose={() => setFindOpen(false)} webviewRef={webviewRef} />
      {showFailureOverlay && browserTab.loadError ? (
        <BrowserLoadFailureOverlay
          loadError={browserTab.loadError}
          externalUrl={failureExternalUrl}
          currentUrl={toDisplayUrl(failedNavigationUrl)}
          httpsRecoveryUrl={toHttpsRecoveryUrl(failedNavigationUrl)}
          onRetry={() => {
            const webview = webviewRef.current
            if (!webview) {
              return
            }
            onUpdatePageStateRef.current(browserTab.id, { loading: true })
            if (browserTab.loadError?.code === BROWSER_GUEST_RECOVERY_ERROR_CODE) {
              retryGuestRecoveryRef.current()
              return
            }
            retryBrowserTabLoad(webview, browserTab, onUpdatePageStateRef.current)
          }}
          onTryHttps={navigateToUrl}
          onCopy={(url) => {
            void window.browserAPI!.writeClipboardText(url)
            setResourceNotice(
              translate('browser.loadFailure.addressCopied', 'Copied the current page address.')
            )
          }}
          onOpenExternal={(url) => void window.browserAPI!.openExternal({ url })}
        />
      ) : null}
    </>
  )
}
