import { useCallback, useEffect, useMemo, useState } from 'react'
import { Import } from 'lucide-react'
import { toast } from 'sonner'
import { emitBrowserCookieImportToast } from '../../../lib/browser-cookie-import-toast'
import { Button } from '../../../ui/button'
import { BrowserCookieImportDisclosure } from '../../BrowserCookieImportDisclosure'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '../../../ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover'
import { useBrowserSessionStore } from '../../../store/browser-session-store'
import { getRendererPlatform } from '../../../lib/platform'
import { BrowserSettingsDialog } from '../../settings/BrowserSettingsDialog'
import { getBrowserCookieImportSourceLabels } from '../../../../shared/browser-cookie-import-sources'
import { shouldShowBrowserImportHint } from './browser-import-hint-visibility'
import { formatBrowserImportSummary } from './browser-detected-browsers-summary'
import { translate } from '../../../i18n'

type BrowserImportHintButtonProps = {
  profileId: string | null
  compact?: boolean
}

export function BrowserImportHintButton({
  profileId,
  compact = false
}: BrowserImportHintButtonProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const browserSessionImportState = useBrowserSessionStore((s) => s.browserSessionImportState)
  const browserImportHintHidden = useBrowserSessionStore((s) => s.settings.importHintHidden)
  const settingsLoaded = useBrowserSessionStore((s) => s.settingsLoaded)
  const detectedBrowsers = useBrowserSessionStore((s) => s.detectedBrowsers)
  const detectedBrowsersLoaded = useBrowserSessionStore((s) => s.detectedBrowsersLoaded)
  const fetchDetectedBrowsers = useBrowserSessionStore((s) => s.fetchDetectedBrowsers)
  const importCookiesFromBrowser = useBrowserSessionStore((s) => s.importCookiesFromBrowser)
  const importCookiesToProfile = useBrowserSessionStore((s) => s.importCookiesToProfile)
  const updateSettings = useBrowserSessionStore((s) => s.updateSettings)

  const effectiveProfileId = profileId ?? 'default'
  const shouldShow = shouldShowBrowserImportHint({
    settingsLoaded,
    browserImportHintHidden
  })

  const supportedImportLabels = useMemo(() => {
    return getBrowserCookieImportSourceLabels(getRendererPlatform())
  }, [])

  const importSummary = useMemo(
    () =>
      formatBrowserImportSummary({
        detectedBrowsers,
        detectedBrowsersLoaded,
        supportedImportLabels
      }),
    [detectedBrowsers, detectedBrowsersLoaded, supportedImportLabels]
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean): void => {
      setOpen(nextOpen)
      if (!nextOpen) {
        setImportMenuOpen(false)
      }
      if (nextOpen) {
        // Why: macOS treats other browsers' profile folders as app data. Only
        // probe them when the user opens the import hint.
        void fetchDetectedBrowsers()
      }
    },
    [fetchDetectedBrowsers]
  )

  const handleImportFromBrowser = useCallback(
    async (browserFamily: string, browserProfile?: string): Promise<void> => {
      setOpen(false)
      setImportMenuOpen(false)
      const result = await importCookiesFromBrowser(
        effectiveProfileId,
        browserFamily,
        browserProfile
      )
      if (result.ok) {
        const browser = detectedBrowsers.find((entry) => entry.family === browserFamily)
        emitBrowserCookieImportToast(
          result.summary,
          translate(
            'auto.components.browser.pane.BrowserImportHintButton.02e89014c5',
            'Imported {{value0}} cookies from {{value1}}{{value2}}.',
            {
              value0: result.summary.importedCookies,
              value1: browser?.label ?? browserFamily,
              value2: browserProfile ? ` (${browserProfile})` : ''
            }
          )
        )
        return
      }
      toast.error(result.reason)
    },
    [detectedBrowsers, effectiveProfileId, importCookiesFromBrowser]
  )

  const handleImportFromFile = useCallback(async (): Promise<void> => {
    setOpen(false)
    setImportMenuOpen(false)
    const result = await importCookiesToProfile(effectiveProfileId)
    if (result.ok) {
      emitBrowserCookieImportToast(
        result.summary,
        translate(
          'auto.components.browser.pane.BrowserImportHintButton.d40d584769',
          'Imported {{value0}} cookies from file.',
          { value0: result.summary.importedCookies }
        )
      )
      return
    }
    if (result.reason !== 'canceled') {
      toast.error(result.reason)
    }
  }, [effectiveProfileId, importCookiesToProfile])

  const handleOpenBrowserSettings = useCallback((): void => {
    setSettingsOpen(true)
    setOpen(false)
  }, [])

  const handleHideHint = useCallback((): void => {
    void updateSettings({ importHintHidden: true })
    setOpen(false)
  }, [updateSettings])

  // Why: Electron <webview> elements run in a separate process, so clicking
  // inside one never dispatches pointerdown on the renderer document. Radix
  // popovers rely on that event for outside-click detection, so window blur
  // catches the moment focus leaves the renderer (including into a webview).
  useEffect(() => {
    if (!open) {
      return
    }
    const dismiss = (): void => {
      handleOpenChange(false)
    }
    window.addEventListener('blur', dismiss)
    return () => window.removeEventListener('blur', dismiss)
  }, [handleOpenChange, open])

  if (!shouldShow) {
    return null
  }

  return (
    <>
      <Popover modal={false} open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 shrink-0 rounded-full px-2.5 text-xs"
            aria-label={translate(
              'auto.components.browser.pane.BrowserImportHintButton.4f5ffaa6a1',
              'Import browser data'
            )}
          >
            <Import className="size-3.5" />
            {compact
              ? null
              : translate(
                  'auto.components.browser.pane.BrowserImportHintButton.b24fef25be',
                  'Import'
                )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" sideOffset={6} className="w-80 p-3">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-foreground">
                {translate(
                  'auto.components.browser.pane.BrowserImportHintButton.4f5ffaa6a1',
                  'Import browser data'
                )}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{importSummary}</p>
              <p className="text-[11px] leading-4 text-muted-foreground/80">
                {translate(
                  'auto.components.browser.pane.BrowserImportHintButton.e52a955e6f',
                  'You can always find this in Settings > Browser.'
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu modal={false} open={importMenuOpen} onOpenChange={setImportMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2.5 text-xs"
                    disabled={browserSessionImportState?.status === 'importing'}
                  >
                    {translate(
                      'auto.components.browser.pane.BrowserImportHintButton.244266c122',
                      'Import…'
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {detectedBrowsers.map((browser) =>
                    browser.profiles.length > 1 ? (
                      <DropdownMenuSub key={browser.family}>
                        <DropdownMenuSubTrigger>
                          {translate(
                            'auto.components.browser.pane.BrowserImportHintButton.0c6d254eca',
                            'From {{value0}}',
                            { value0: browser.label }
                          )}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            {browser.profiles.map((profile) => (
                              <DropdownMenuItem
                                key={profile.directory}
                                onSelect={() =>
                                  void handleImportFromBrowser(browser.family, profile.directory)
                                }
                              >
                                {profile.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                    ) : (
                      <DropdownMenuItem
                        key={browser.family}
                        onSelect={() => void handleImportFromBrowser(browser.family)}
                      >
                        {translate(
                          'auto.components.browser.pane.BrowserImportHintButton.0c6d254eca',
                          'From {{value0}}',
                          { value0: browser.label }
                        )}
                      </DropdownMenuItem>
                    )
                  )}
                  {detectedBrowsers.length > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem onSelect={() => void handleImportFromFile()}>
                    {translate(
                      'auto.components.browser.pane.BrowserImportHintButton.e0e125e074',
                      'From File…'
                    )}
                  </DropdownMenuItem>
                  <BrowserCookieImportDisclosure />
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onClick={handleOpenBrowserSettings}
                className="rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {translate(
                  'auto.components.browser.pane.BrowserImportHintButton.77351d22f5',
                  'Browser Settings'
                )}
              </button>

              <button
                type="button"
                onClick={handleHideHint}
                className="ml-auto rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {translate(
                  'auto.components.browser.pane.BrowserImportHintButton.05e675fe96',
                  'Hide Hint'
                )}
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <BrowserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
