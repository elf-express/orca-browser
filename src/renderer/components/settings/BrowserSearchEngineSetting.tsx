import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { SEARCH_ENGINE_LABELS, type SearchEngine } from '../../../shared/browser-url'
import { translate } from '../../i18n'

type BrowserSearchEngineSettingProps = {
  selectedSearchEngine: SearchEngine
  onSearchEngineChange: (engine: SearchEngine) => void
}

export function BrowserSearchEngineSetting({
  selectedSearchEngine,
  onSearchEngineChange
}: BrowserSearchEngineSettingProps): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="space-y-0.5">
        <Label>
          {translate('auto.components.settings.BrowserPane.0d9c987f21', 'Default Search Engine')}
        </Label>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.BrowserPane.3e46903ad4',
            'Used when typing non-URL text in the address bar.'
          )}
        </p>
      </div>
      <Select
        value={selectedSearchEngine}
        onValueChange={(value) => onSearchEngineChange(value as SearchEngine)}
      >
        <SelectTrigger className="h-7 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SEARCH_ENGINE_LABELS) as SearchEngine[]).map((engine) => (
            <SelectItem key={engine} value={engine} className="text-xs">
              {SEARCH_ENGINE_LABELS[engine]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
