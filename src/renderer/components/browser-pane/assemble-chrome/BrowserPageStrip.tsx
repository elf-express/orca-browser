import { X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { translate } from '../../../i18n'
import type { BrowserPage } from '../../../../shared/browser-workspace-types'
import { displayableFaviconUrl } from '../describe-page/browser-favicon-url'

export function BrowserPageStrip({
  pages,
  activePageId,
  onSelect,
  onClose
}: {
  pages: readonly BrowserPage[]
  activePageId: string | null
  onSelect: (pageId: string) => void
  onClose: (pageId: string) => void
}): React.JSX.Element {
  return (
    <div
      data-orca-browser-page-strip=""
      className="flex h-8 shrink-0 items-stretch gap-px overflow-x-auto border-b border-border bg-muted/40"
    >
      {pages.map((page) => {
        const faviconUrl = displayableFaviconUrl(page.faviconUrl)
        const isActive = page.id === activePageId
        return (
          <div
            key={page.id}
            data-orca-browser-page-strip-item={page.id}
            data-active={String(isActive)}
            className={cn(
              'group flex min-w-0 max-w-48 items-center gap-1 pl-2 pr-1 text-xs',
              isActive ? 'bg-background text-foreground' : 'text-muted-foreground'
            )}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left"
              onClick={() => onSelect(page.id)}
            >
              {faviconUrl ? (
                <img src={faviconUrl} alt="" className="size-3.5 shrink-0" />
              ) : (
                <span className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{page.title}</span>
            </button>
            <button
              type="button"
              aria-label={translate('auto.components.browser.pageStrip.close', 'Close page')}
              className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-muted"
              onClick={() => onClose(page.id)}
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
