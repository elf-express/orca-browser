import { translate } from '../../i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog'
import { BrowserSettingsPanel } from './BrowserSettingsPanel'

export function BrowserSettingsDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scopeId?: string
}): React.JSX.Element {
  const { open, onOpenChange, scopeId } = props
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {translate(
              'auto.components.browser.pane.BrowserToolbarMenu.a771c2b6c8',
              'Browser Settings…'
            )}
          </DialogTitle>
        </DialogHeader>
        {open ? <BrowserSettingsPanel scopeId={scopeId} /> : null}
      </DialogContent>
    </Dialog>
  )
}
