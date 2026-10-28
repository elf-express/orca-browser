import { installBrowserCore } from './browser-core-installer'
import { installBrowserGrab } from './browser-grab-installer'
import { installBrowserProfiles } from './browser-profiles-installer'
import type { ResolvedBrowserPluginOptions } from './plugin-options'

export type BrowserPluginInstaller = (
  options: ResolvedBrowserPluginOptions
) => (() => void | Promise<void>) | void

// Features register here; installers run in order and their disposers in reverse.
export const pluginInstallers: BrowserPluginInstaller[] = [
  installBrowserCore,
  installBrowserProfiles,
  installBrowserGrab
]
