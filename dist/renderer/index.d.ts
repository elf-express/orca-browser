declare function BrowserPane(props: {
    scopeId: string;
    active: boolean;
}): React.JSX.Element;

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

interface BrowserRendererHost {
    t(key: string, fallback: string, vars?: Record<string, string | number>): string;
    /**
     * The package awaits the result. A rejection keeps the pending content and shows an error,
     * except `error.name === 'AbortError'`, which counts as a user cancel and shows nothing.
     */
    onSendToAgent?(payload: BrowserAgentPayload): void | Promise<void>;
}
declare function useBrowserRendererHost(): BrowserRendererHost;

declare function BrowserPluginProvider(props: {
    host: BrowserRendererHost;
    children: React.ReactNode;
}): React.JSX.Element;

export { type BrowserAgentPayload, BrowserPane, BrowserPluginProvider, type BrowserRendererHost, useBrowserRendererHost };
