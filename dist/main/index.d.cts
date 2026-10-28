import * as electron from 'electron';

interface BrowserApi {
    readonly apiVersion: 1;
}
declare global {
    interface Window {
        browserAPI?: BrowserApi;
    }
}

type BrowserHostLogger = {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
};
type BrowserHost = {
    getMainWindow(): electron.BrowserWindow | null;
    userDataDir: string;
    resourcesPath: string;
    logger: BrowserHostLogger;
    openExternal(url: string): Promise<void>;
};
type BrowserPluginOptions = {
    host: BrowserHost;
    mcp?: {
        port?: number;
    };
};
type BrowserPluginHandle = {
    dispose(): Promise<void>;
};

declare function installBrowserPlugin(opts: BrowserPluginOptions): BrowserPluginHandle;

export { type BrowserHost, type BrowserHostLogger, type BrowserPluginHandle, type BrowserPluginOptions, installBrowserPlugin };
