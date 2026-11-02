import { useState, type JSX } from 'react'
import { toast, Toaster } from 'sonner'
import { BrowserPane, BrowserPluginProvider, BrowserSettingsPanel } from '../../src/renderer'
import type { BrowserRendererHost } from '../../src/renderer'
import { label, t } from './i18n'

const SCOPES = ['workspace-1', 'workspace-2'] as const

// Defined once at module level so the provider never sees a new host object.
const host: BrowserRendererHost = {
  t,
  onSendToAgent: (payload) => {
    console.info('[playground] onSendToAgent', payload)
    toast.success(
      `Sent ${payload.kind} to agent (${payload.images.length} image(s)); see DevTools console`
    )
  }
}

export function App(): JSX.Element {
  const [scopeId, setScopeId] = useState<string>(SCOPES[0])
  const [showSettings, setShowSettings] = useState(false)

  return (
    <BrowserPluginProvider host={host}>
      <Toaster richColors />
      <div className="flex h-screen flex-col bg-background text-foreground">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 text-sm">
          <span className="font-semibold">orca-browser playground</span>
          {SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setScopeId(scope)}
              className={`rounded-md border border-border px-2 py-1 ${
                scope === scopeId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              }`}
            >
              {scope}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="ml-auto rounded-md border border-border px-2 py-1"
          >
            {showSettings ? label('hideSettings', 'Hide settings') : label('settings', 'Settings')}
          </button>
        </header>
        <div className="flex min-h-0 flex-1">
          {/* Every scope keeps its pane mounted in the same cell; only the active one shows. */}
          <div className="grid min-h-0 min-w-0 flex-1">
            {SCOPES.map((scope) => (
              <div key={scope} className="flex min-h-0 min-w-0 [grid-area:1/1]">
                <BrowserPane scopeId={scope} active={scope === scopeId} />
              </div>
            ))}
          </div>
          {showSettings ? (
            <aside className="w-[420px] shrink-0 overflow-y-auto border-l border-border p-4">
              <BrowserSettingsPanel scopeId={scopeId} />
            </aside>
          ) : null}
        </div>
      </div>
    </BrowserPluginProvider>
  )
}
