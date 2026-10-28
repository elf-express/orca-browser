import { useBrowserRendererHost } from './host-context'

export function BrowserPane(props: { scopeId: string; active: boolean }): React.JSX.Element {
  useBrowserRendererHost()

  return (
    <div
      data-orca-browser-pane=""
      data-scope-id={props.scopeId}
      data-active={String(props.active)}
      className="relative flex h-full min-h-0 flex-1"
    />
  )
}
