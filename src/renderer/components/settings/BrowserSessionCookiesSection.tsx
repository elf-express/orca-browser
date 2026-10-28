import { Plus } from 'lucide-react'
import { translate } from '../../i18n'
import { useBrowserSessionStore } from '../../store/browser-session-store'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { BrowserProfileRow } from './BrowserProfileRow'

type BrowserSessionCookiesSectionProps = {
  /** Profile id the scope's active page uses; undefined when no scope is being described. */
  inUseProfileId: string | undefined
  onAddProfile: () => void
}

export function BrowserSessionCookiesSection({
  inUseProfileId,
  onAddProfile
}: BrowserSessionCookiesSectionProps): React.JSX.Element {
  const profiles = useBrowserSessionStore((s) => s.browserSessionProfiles)
  const defaultProfile = profiles.find((profile) => profile.id === 'default')
  const nonDefaultProfiles = profiles.filter((profile) => profile.id !== 'default')

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label>
            {translate('auto.components.settings.BrowserPane.2d66a6efb5', 'Session & Cookies')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.browser.settings.profilesHint',
              'Import cookies into a profile, and switch profiles per tab from the toolbar menu.'
            )}
          </p>
        </div>
        <Button variant="outline" size="xs" onClick={onAddProfile} className="shrink-0 gap-1.5">
          <Plus className="size-3" />
          {translate('auto.components.settings.BrowserPane.6f2584b39e', 'Add Profile')}
        </Button>
      </div>

      <div className="space-y-2">
        <BrowserProfileRow
          profile={
            defaultProfile ?? {
              id: 'default',
              scope: 'default',
              partition: '',
              label: translate('auto.components.settings.BrowserPane.4399c77caa', 'Default'),
              source: null
            }
          }
          inUse={inUseProfileId === 'default'}
          isDefault
        />
        {nonDefaultProfiles.map((profile) => (
          <BrowserProfileRow
            key={profile.id}
            profile={profile}
            inUse={inUseProfileId === profile.id}
          />
        ))}
      </div>
    </div>
  )
}
