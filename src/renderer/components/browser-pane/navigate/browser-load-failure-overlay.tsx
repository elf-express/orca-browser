import { Copy, ExternalLink, Globe, RefreshCw } from 'lucide-react'

import { Button } from '../../../ui/button'
import { translate } from '../../../i18n'
import type { BrowserLoadError } from '../../../../shared/browser-workspace-types'
import { isEligibleLocalCertificateHost } from '../../../../shared/browser-url'
import {
  formatLoadFailureDescription,
  formatLoadFailureRecoveryHint,
  type LoadFailureMeta
} from './browser-notices'
import { BROWSER_GUEST_RECOVERY_ERROR_CODE } from '../host-guest/browser-page-guest-recovery'

type BrowserLoadFailureOverlayProps = {
  loadError: BrowserLoadError
  externalUrl?: string | null
  currentUrl: string
  httpsRecoveryUrl: string | null
  onRetry: () => void
  onTryHttps: (url: string) => void
  onCopy: (url: string) => void
  onOpenExternal?: (url: string) => void
}

function getLoadErrorMetadata(loadError: BrowserLoadError): LoadFailureMeta {
  try {
    const parsed = new URL(loadError.validatedUrl)
    return {
      host: parsed.host || null,
      isLocalhostLike:
        parsed.hostname === '0.0.0.0' || isEligibleLocalCertificateHost(parsed.hostname)
    }
  } catch {
    return { host: null, isLocalhostLike: false }
  }
}

export function BrowserLoadFailureOverlay({
  loadError,
  externalUrl,
  currentUrl,
  httpsRecoveryUrl,
  onRetry,
  onTryHttps,
  onCopy,
  onOpenExternal
}: BrowserLoadFailureOverlayProps): React.JSX.Element {
  const meta = getLoadErrorMetadata(loadError)
  const guestRecoveryError = loadError.code === BROWSER_GUEST_RECOVERY_ERROR_CODE
  const recoveryHint = formatLoadFailureRecoveryHint(meta, loadError)

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background px-6">
      <div aria-live="polite" className="flex max-w-lg flex-col items-center px-8 py-8 text-center">
        <div className="mb-4 rounded-full border border-border bg-muted p-3 text-muted-foreground">
          <Globe className="size-5" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          {guestRecoveryError
            ? translate('browser.guestRecovery.title', 'Browser page stopped')
            : meta.host
              ? translate('browser.loadFailure.cantReachHost', "Can't reach {{value0}}", {
                  value0: meta.host
                })
              : translate('browser.loadFailure.cantLoadPage', "Can't load this page")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatLoadFailureDescription(loadError, meta)}
        </p>
        {recoveryHint ? <p className="mt-2 text-xs text-muted-foreground">{recoveryHint}</p> : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {httpsRecoveryUrl && !guestRecoveryError ? (
            <Button
              size="sm"
              className="h-9 gap-2 px-3"
              onClick={() => onTryHttps(httpsRecoveryUrl)}
            >
              {translate('browser.loadFailure.tryHttps', 'Try HTTPS')}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="h-9 gap-2 px-3" onClick={onRetry}>
            <RefreshCw className="size-4" />
            {translate('browser.loadFailure.retry', 'Retry')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 gap-2 px-3"
            onClick={() => onCopy(currentUrl)}
          >
            <Copy className="size-4" />
            {translate('browser.loadFailure.copyAddress', 'Copy Address')}
          </Button>
          {externalUrl && onOpenExternal ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 gap-2 px-3"
              onClick={() => onOpenExternal(externalUrl)}
            >
              <ExternalLink className="size-4" />
              {translate('browser.loadFailure.openExternally', 'Open Externally')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
