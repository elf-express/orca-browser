export type BrowserHostLogger = {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export type BrowserHost = {
  getMainWindow(): import('electron').BrowserWindow | null
  userDataDir: string
  resourcesPath: string
  logger: BrowserHostLogger
  openExternal(url: string): Promise<void>
}

export type BrowserPluginOptions = {
  host: BrowserHost
  mcp?: { port?: number }
}

export type BrowserPluginHandle = {
  dispose(): Promise<void>
}
