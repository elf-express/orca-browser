import type { BrowserPluginHandle, BrowserPluginOptions } from '../shared'
import { pluginInstallers } from './plugin-installers'
import { resolveBrowserPluginOptions } from './plugin-options'
import { isBrowserPluginInstalled, setResolvedBrowserPluginOptions } from './plugin-runtime'

export type {
  BrowserHost,
  BrowserHostLogger,
  BrowserPluginHandle,
  BrowserPluginOptions
} from '../shared'

export function installBrowserPlugin(opts: BrowserPluginOptions): BrowserPluginHandle {
  if (isBrowserPluginInstalled()) {
    throw new Error(
      'orca-browser: installBrowserPlugin() was already called; dispose the previous handle first'
    )
  }
  const options = resolveBrowserPluginOptions(opts)
  const { logger } = options.host
  setResolvedBrowserPluginOptions(options)

  const disposers: (() => void | Promise<void>)[] = []
  const runDisposers = async (): Promise<void> => {
    for (const disposer of disposers.splice(0).reverse()) {
      try {
        await disposer()
      } catch (err) {
        logger.error('orca-browser: dispose failed', { error: String(err) })
      }
    }
    setResolvedBrowserPluginOptions(null)
  }

  try {
    for (const installer of pluginInstallers) {
      const disposer = installer(options)
      if (disposer) {
        disposers.push(disposer)
      }
    }
    logger.info('orca-browser: installed', { mcpPort: options.mcpPort })
  } catch (err) {
    // Roll back so a failed install leaves no state behind and can be retried.
    setResolvedBrowserPluginOptions(null)
    void runDisposers()
    throw err
  }

  let disposePromise: Promise<void> | null = null
  return { dispose: () => (disposePromise ??= runDisposers()) }
}
