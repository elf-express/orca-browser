import { useState } from 'react'
import type { BrowserUserAgentMode } from '../../../shared/browser-user-agent-mode'
import { translate } from '../../i18n'
import { useBrowserSessionStore } from '../../store/browser-session-store'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'

export function BrowserUserAgentSetting(): React.JSX.Element {
  const status = useBrowserSessionStore((s) => s.identity)
  const setIdentityMode = useBrowserSessionStore((s) => s.setIdentityMode)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const title = translate('settings.browser.userAgent.title', 'Browser identity')
  const description = translate(
    'settings.browser.userAgent.description',
    'Choose the user agent for every browser profile and page. Native mode disables Google sign-in. Changes take effect after a restart.'
  )

  const setMode = (mode: BrowserUserAgentMode): void => {
    setSaving(true)
    setError(null)
    setIdentityMode(mode)
      .then((result) => {
        if (!result) {
          setError(
            translate('settings.browser.userAgent.unavailable', 'Browser identity is unavailable.')
          )
        } else if (!result.ok) {
          setError(result.error.message)
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setSaving(false))
  }

  let control: React.JSX.Element
  if (!status) {
    control = (
      <span className="text-xs text-muted-foreground">
        {translate('settings.browser.userAgent.loading', 'Loading…')}
      </span>
    )
  } else if (status.identity.configuredMode === null) {
    control = (
      <div className="text-xs text-destructive">
        {translate(
          'settings.browser.userAgent.resetRequired',
          'Identity data must be reset explicitly before it can be changed.'
        )}
      </div>
    )
  } else {
    const configuredMode = status.identity.configuredMode
    const options: { value: BrowserUserAgentMode; label: string; tooltip: string }[] = [
      {
        value: 'clean',
        label: translate('settings.browser.userAgent.optionClean', 'Cleaned'),
        tooltip: translate(
          'settings.browser.userAgent.optionCleanTooltip',
          'Removes Orca and Electron tokens to match imported Chrome sessions.'
        )
      },
      {
        value: 'native',
        label: translate('settings.browser.userAgent.optionNative', 'Native'),
        tooltip: translate(
          'settings.browser.userAgent.optionNativeTooltip',
          "Keeps Electron's built-in identity for sites that reject the cleaned identity. Google sign-in is unavailable in Native mode."
        )
      }
    ]
    control = (
      <div className="space-y-1 text-right">
        <div role="radiogroup" aria-label={title} className="inline-flex gap-1">
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={configuredMode === option.value}
              size="sm"
              variant={configuredMode === option.value ? 'secondary' : 'outline'}
              className="h-7 text-xs"
              title={option.tooltip}
              disabled={saving}
              onClick={() => setMode(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {status.identity.restartRequired ? (
          <div className="text-[11px] text-muted-foreground">
            {translate('settings.browser.userAgent.restartRequired', 'Restart required')}
          </div>
        ) : null}
        {error ? <div className="text-[11px] text-destructive">{error}</div> : null}
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="space-y-0.5">
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}
