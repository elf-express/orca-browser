import { JSX, ReactNode } from 'react';

declare function BrowserPane(props: {
    scopeId: string;
    active: boolean;
}): JSX.Element;

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

/** A mounted browser pane's find bar. Both ids are known to whoever renders the chrome. */
type BrowserFindSource = {
    browserPageId: string;
    browserWorkspaceId: string;
};

type BrowserPermissionDeniedEvent = {
    browserPageId: string;
    /** Electron permission string (e.g. "media", "notifications"). */
    permission: string;
    /** Sanitized to origin/host so auth query params never leak into UI state. */
    origin: string;
};
type BrowserPopupEvent = {
    browserPageId: string;
    /** Sanitized to origin/host so auth query params never leak into UI state. */
    origin: string;
    /** Whether Orca opened the target in Orca, opened it externally, or blocked it as unsafe. */
    action: 'opened-in-orca' | 'opened-external' | 'blocked';
};
type BrowserContextMenuRequestedEvent = {
    browserPageId: string;
    x: number;
    y: number;
    screenX: number;
    screenY: number;
    pageUrl: string;
    linkUrl: string | null;
    selectionText: string;
    canGoBack: boolean;
    canGoForward: boolean;
};
type BrowserContextMenuDismissedEvent = {
    browserPageId: string;
};

/** The page a guest-forwarded chrome chord (reload, history, address bar) is aimed at. */
type BrowserPageCommandTarget = {
    browserPageId: string;
};
type BrowserHistoryNavigateCommand = BrowserPageCommandTarget & {
    direction: 'back' | 'forward';
};

type BrowserPageZoomDirection = 'in' | 'out' | 'reset';
type BrowserPageZoomCommand = {
    browserPageId: string;
    direction: BrowserPageZoomDirection;
};

type BrowserLoadError = {
    code: number;
    description: string;
    validatedUrl: string;
};

type BrowserGuestArgs = {
    browserPageId: string;
    scopeId: string;
    sessionProfileId?: string | null;
    webContentsId: number;
};
type BrowserGuestLoadFailedEvent = {
    browserPageId: string;
    loadError: BrowserLoadError;
};
type BrowserOpenLinkInTabEvent = {
    browserPageId: string;
    url: string;
    activate?: boolean;
};
/** Every `on*` subscription returns the function that cancels it. */
type BrowserUnsubscribe = () => void;
interface BrowserApi {
    readonly apiVersion: 1;
    registerGuest(args: BrowserGuestArgs): Promise<boolean>;
    isGuestRegistered(args: {
        browserPageId: string;
        webContentsId: number;
    }): Promise<boolean>;
    repairGuestRegistration(args: BrowserGuestArgs): Promise<boolean>;
    unregisterGuest(args: {
        browserPageId: string;
    }): Promise<boolean>;
    notifyActiveTabChanged(args: {
        browserPageId: string;
    }): Promise<boolean>;
    openDevTools(args: {
        browserPageId: string;
    }): Promise<boolean>;
    openExternal(args: {
        url: string;
    }): Promise<boolean>;
    writeClipboardText(text: string): Promise<void>;
    onGuestLoadFailed(callback: (event: BrowserGuestLoadFailedEvent) => void): BrowserUnsubscribe;
    onPermissionDenied(callback: (event: BrowserPermissionDeniedEvent) => void): BrowserUnsubscribe;
    onPopup(callback: (event: BrowserPopupEvent) => void): BrowserUnsubscribe;
    onContextMenuRequested(callback: (event: BrowserContextMenuRequestedEvent) => void): BrowserUnsubscribe;
    onContextMenuDismissed(callback: (event: BrowserContextMenuDismissedEvent) => void): BrowserUnsubscribe;
    onOpenLinkInOrcaTab(callback: (event: BrowserOpenLinkInTabEvent) => void): BrowserUnsubscribe;
    onFocusAddressBar(callback: (target: BrowserPageCommandTarget) => void): BrowserUnsubscribe;
    onReloadPage(callback: (target: BrowserPageCommandTarget) => void): BrowserUnsubscribe;
    onHardReloadPage(callback: (target: BrowserPageCommandTarget) => void): BrowserUnsubscribe;
    onFindInPage(source: BrowserFindSource, callback: () => void): BrowserUnsubscribe;
    onHistoryNavigate(callback: (command: BrowserHistoryNavigateCommand) => void): BrowserUnsubscribe;
    onZoomPage(callback: (command: BrowserPageZoomCommand) => void): BrowserUnsubscribe;
    onSystemResumed(callback: () => void): BrowserUnsubscribe;
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
    children: ReactNode;
}): JSX.Element;

export { type BrowserAgentPayload, BrowserPane, BrowserPluginProvider, type BrowserRendererHost, useBrowserRendererHost };
