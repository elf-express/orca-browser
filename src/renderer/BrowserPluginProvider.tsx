import { useEffect } from 'react'
import { BrowserRendererHostContext, type BrowserRendererHost } from './host-context'
import { setBrowserRendererHost } from './i18n'

export function BrowserPluginProvider(props: {
  host: BrowserRendererHost
  children: React.ReactNode
}): React.JSX.Element {
  const { host, children } = props

  useEffect(() => {
    setBrowserRendererHost(host)
    return () => setBrowserRendererHost(null)
  }, [host])

  return (
    <BrowserRendererHostContext.Provider value={host}>
      {children}
    </BrowserRendererHostContext.Provider>
  )
}
