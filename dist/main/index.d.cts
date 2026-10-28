import * as electron from 'electron';

/** A mounted browser pane's find bar. Both ids are known to whoever renders the chrome. */
type BrowserFindSource = {
    browserPageId: string;
    browserWorkspaceId: string;
};

/** Page-level metadata captured at selection time. */
type BrowserGrabPageContext = {
    sanitizedUrl: string;
    title: string;
    viewportWidth: number;
    viewportHeight: number;
    scrollX: number;
    scrollY: number;
    devicePixelRatio: number;
    capturedAt: string;
};
/** Accessibility metadata for the selected element. */
type BrowserGrabAccessibility = {
    role: string | null;
    accessibleName: string | null;
    ariaLabel: string | null;
    ariaLabelledBy: string | null;
};
/** Curated subset of computed styles. */
type BrowserGrabComputedStyles = {
    display: string;
    position: string;
    width: string;
    height: string;
    margin: string;
    padding: string;
    color: string;
    backgroundColor: string;
    border: string;
    borderRadius: string;
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    textAlign: string;
    zIndex: string;
};
/** Viewport-relative or page-relative rectangle in CSS pixels. */
type BrowserGrabRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
/** The selected element's extracted data. */
type BrowserGrabTarget = {
    tagName: string;
    selector: string;
    elementPath?: string;
    fullPath?: string;
    cssClasses?: string;
    nearbyElements?: string[];
    selectedText?: string | null;
    isFixed?: boolean;
    reactComponents?: string | null;
    sourceFile?: string | null;
    textSnippet: string;
    htmlSnippet: string;
    attributes: Record<string, string>;
    accessibility: BrowserGrabAccessibility;
    rectViewport: BrowserGrabRect;
    rectPage: BrowserGrabRect;
    computedStyles: BrowserGrabComputedStyles;
};
/** Screenshot attachment — always PNG, either a data URL or a temp file path. */
type BrowserGrabScreenshot = {
    mimeType: 'image/png';
    dataUrl: string;
    width: number;
    height: number;
};
/** The full payload extracted from a browser grab selection. */
type BrowserGrabPayload = {
    page: BrowserGrabPageContext;
    target: BrowserGrabTarget;
    nearbyText: string[];
    ancestorPath: string[];
    screenshot: BrowserGrabScreenshot | null;
};
type GrabIntent = 'copy' | 'annotate';
/** Why a grab operation was cancelled before the user selected an element. */
type BrowserGrabCancelReason = 'user' | 'tab-inactive' | 'navigation' | 'evicted' | 'timeout';
/** Discriminated union for the result of a single grab operation. */
type BrowserGrabResult = {
    opId: string;
    kind: 'selected';
    payload: BrowserGrabPayload;
} | {
    opId: string;
    kind: 'context-selected';
    payload: BrowserGrabPayload;
} | {
    opId: string;
    kind: 'cancelled';
    reason: BrowserGrabCancelReason;
} | {
    opId: string;
    kind: 'error';
    reason: string;
};
type BrowserSetGrabModeArgs = {
    browserPageId: string;
    enabled: boolean;
};
/** Why a grab IPC call was rejected before the operation could start. */
type BrowserGrabRejectReason = 'not-ready' | 'not-authorized' | 'already-active' | 'injection-failed';
type BrowserSetGrabModeResult = {
    ok: true;
} | {
    ok: false;
    reason: BrowserGrabRejectReason;
};
type BrowserAwaitGrabSelectionArgs = {
    browserPageId: string;
    opId: string;
};
type BrowserCancelGrabArgs = {
    browserPageId: string;
};
type BrowserCaptureSelectionScreenshotArgs = {
    browserPageId: string;
    rect: BrowserGrabRect;
};
type BrowserCaptureSelectionScreenshotResult = {
    ok: true;
    screenshot: BrowserGrabScreenshot;
} | {
    ok: false;
    reason: string;
};
type BrowserExtractHoverArgs = {
    browserPageId: string;
};
type BrowserExtractHoverResult = {
    ok: true;
    payload: BrowserGrabPayload;
} | {
    ok: false;
    reason: string;
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

type SearchEngine = 'google' | 'duckduckgo' | 'bing' | 'kagi';

type BrowserPluginSettings = {
    searchEngine: SearchEngine;
    importHintHidden: boolean;
};

type BrowserUserAgentMode = 'clean' | 'native';
type BrowserIdentityModeSnapshot = {
    state: 'missing' | 'valid';
    appliedMode: BrowserUserAgentMode;
    configuredMode: BrowserUserAgentMode;
    explicitSelection: boolean;
    migrationNoticePending: boolean;
    restartRequired: boolean;
} | {
    state: 'corrupt' | 'future' | 'unreadable';
    appliedMode: 'clean';
    configuredMode: null;
    explicitSelection: null;
    migrationNoticePending: null;
    restartRequired: false;
};
type BrowserIdentityModeStatus = {
    identity: BrowserIdentityModeSnapshot;
    migrationNotice: {
        degraded: boolean;
    } | null;
};
type BrowserIdentityModeSetResult = {
    ok: true;
    identity: BrowserIdentityModeSnapshot;
} | {
    ok: false;
    error: {
        code: 'browser_identity_reset_required' | 'browser_identity_write_failed' | 'browser_identity_backup_failed';
        message: string;
    };
    identity: BrowserIdentityModeSnapshot;
};

type BrowserLoadError = {
    code: number;
    description: string;
    validatedUrl: string;
};
type BrowserViewportOverride = {
    width: number;
    height: number;
    deviceScaleFactor: number;
    mobile: boolean;
};
type BrowserViewportScrollState = {
    scrollLeft: number;
    scrollTop: number;
    maxScrollLeft: number;
    maxScrollTop: number;
};
type BrowserSessionProfileSource = {
    browserFamily: 'chrome' | 'chromium' | 'arc' | 'edge' | 'firefox' | 'safari' | 'comet' | 'helium' | 'manual';
    profileName?: string;
    importedAt: number;
};
type BrowserCookieImportSummary = {
    totalCookies: number;
    importedCookies: number;
    skippedCookies: number;
    googleCookiesSkipped?: number;
    partitionSkippedCookies?: number;
    domains: string[];
    warning?: {
        code: 'restart-fallback-unavailable';
        loadedCookies: number;
        failedCookies: number;
    } | {
        code: 'cookies-undecryptable';
        failedCookies: number;
        otherFailedCookies?: number;
        reason: 'app-bound-encryption' | 'linux-keyring-unavailable' | 'unknown';
    };
};
type BrowserSessionProfileScope = 'default' | 'isolated' | 'imported';
type BrowserSessionProfile = {
    id: string;
    scope: BrowserSessionProfileScope;
    partition: string;
    label: string;
    source: BrowserSessionProfileSource | null;
};
type BrowserCookieImportResult = {
    ok: true;
    profileId: string;
    summary: BrowserCookieImportSummary;
} | {
    ok: false;
    reason: string;
};

/** A detected browser the cookie importer can read from; credential-store details stay in main. */
type DetectedBrowserPickerEntry = {
    family: string;
    label: string;
    profiles: {
        name: string;
        directory: string;
    }[];
    selectedProfile: string;
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
    setViewportOverride(args: {
        browserPageId: string;
        override: BrowserViewportOverride | null;
    }): Promise<boolean>;
    reportViewportScrollState(args: {
        browserPageId: string;
        state: BrowserViewportScrollState;
    }): void;
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
    onScrollPage(callback: (event: {
        browserPageId: string;
        deltaX: number;
        deltaY: number;
    }) => void): BrowserUnsubscribe;
    onSystemResumed(callback: () => void): BrowserUnsubscribe;
    setGrabMode(args: BrowserSetGrabModeArgs): Promise<BrowserSetGrabModeResult>;
    awaitGrabSelection(args: BrowserAwaitGrabSelectionArgs): Promise<BrowserGrabResult>;
    cancelGrab(args: BrowserCancelGrabArgs): Promise<boolean>;
    captureSelectionScreenshot(args: BrowserCaptureSelectionScreenshotArgs): Promise<BrowserCaptureSelectionScreenshotResult>;
    extractHoverPayload(args: BrowserExtractHoverArgs): Promise<BrowserExtractHoverResult>;
    onGrabModeToggle(callback: (browserPageId: string, intent: GrabIntent) => void): BrowserUnsubscribe;
    onGrabActionShortcut(callback: (data: {
        browserPageId: string;
        key: 'c' | 's';
    }) => void): BrowserUnsubscribe;
    session: {
        listProfiles(): Promise<BrowserSessionProfile[]>;
        createProfile(args: {
            scope: 'isolated' | 'imported';
            label: string;
        }): Promise<BrowserSessionProfile | null>;
        deleteProfile(args: {
            profileId: string;
        }): Promise<boolean>;
        importCookies(args: {
            profileId: string;
        }): Promise<BrowserCookieImportResult>;
        importFromBrowser(args: {
            profileId: string;
            browserFamily: string;
            browserProfile?: string;
        }): Promise<BrowserCookieImportResult>;
        detectBrowsers(): Promise<DetectedBrowserPickerEntry[]>;
        resolvePartition(args: {
            profileId: string | null;
        }): Promise<string | null>;
        clearDefaultCookies(): Promise<boolean>;
    };
    identity: {
        get(): Promise<BrowserIdentityModeStatus | null>;
        set(mode: BrowserUserAgentMode): Promise<BrowserIdentityModeSetResult | null>;
    };
    settings: {
        get(): Promise<BrowserPluginSettings>;
        set(patch: Partial<BrowserPluginSettings>): Promise<BrowserPluginSettings | null>;
    };
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
