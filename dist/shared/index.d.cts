import * as electron from 'electron';

type BrowserAgentPayload = {
    kind: 'grab' | 'annotation' | 'markup';
    pageUrl: string;
    pageTitle: string;
    text: string;
    images: Array<{
        name: string;
        mimeType: 'image/png';
        dataBase64: string;
    }>;
};

interface BrowserApi {
    readonly apiVersion: 1;
}
declare global {
    interface Window {
        browserAPI?: BrowserApi;
    }
}

declare const DEFAULT_MCP_PORT = 47821;
declare const BROWSER_API_GLOBAL_KEY = "browserAPI";
declare const PACKAGE_LOG_PREFIX = "orca-browser:";

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

export { BROWSER_API_GLOBAL_KEY, type BrowserAgentPayload, type BrowserApi, type BrowserHost, type BrowserHostLogger, type BrowserPluginHandle, type BrowserPluginOptions, DEFAULT_MCP_PORT, PACKAGE_LOG_PREFIX };
