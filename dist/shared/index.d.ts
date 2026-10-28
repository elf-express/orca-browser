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

/** A mounted browser pane's find bar. Both ids are known to whoever renders the chrome. */
type BrowserFindSource = {
    browserPageId: string;
    browserWorkspaceId: string;
};
/**
 * Who a forwarded Cmd/Ctrl+F is aimed at. Main knows the workspace only for guests registered
 * through the renderer; a client-hosted guest is registered by main's own host runtime, whose
 * wire command carries no workspace. Page ids are unique, so an unscoped target still resolves.
 */
type BrowserFindTarget = {
    browserPageId: string;
    browserWorkspaceId?: string;
};
declare function asBrowserFindTarget(value: unknown): BrowserFindTarget | null;

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
declare const BROWSER_PAGE_ZOOM_STEP = 0.5;
declare const BROWSER_PAGE_ZOOM_MIN = -3;
declare const BROWSER_PAGE_ZOOM_MAX = 5;
declare const DEFAULT_BROWSER_PAGE_ZOOM_LEVEL = 0;
declare const BROWSER_PAGE_ZOOM_LEVELS: readonly number[];
declare function normalizeBrowserPageZoomLevel(value: unknown): number;
declare function browserPageZoomLevelToPercent(level: number): number;
declare function nextBrowserPageZoomLevel(current: number, direction: BrowserPageZoomDirection, resetLevel?: number): number;

type BrowserLoadError = {
    code: number;
    description: string;
    validatedUrl: string;
};
type BrowserPage = {
    id: string;
    scopeId: string;
    url: string;
    title: string;
    loading: boolean;
    faviconUrl: string | null;
    canGoBack: boolean;
    canGoForward: boolean;
    loadError: BrowserLoadError | null;
    createdAt: number;
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
type BrowserHistoryEntry = {
    url: string;
    normalizedUrl: string;
    title: string;
    faviconUrl?: string | null;
    lastVisitedAt: number;
    visitCount: number;
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

declare const DEFAULT_MCP_PORT = 47821;
declare const BROWSER_API_GLOBAL_KEY = "browserAPI";
declare const PACKAGE_LOG_PREFIX = "orca-browser:";
declare const ORCA_BROWSER_PARTITION = "persist:orca-browser";
declare const ORCA_BROWSER_BLANK_URL = "data:text/html,";

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

declare const BROWSER_INVOKE_CHANNELS: readonly ["browser:registerGuest", "browser:isGuestRegistered", "browser:repairGuestRegistration", "browser:unregisterGuest", "browser:activeTabChanged", "browser:openDevTools", "browser:openExternal", "browser:writeClipboardText"];
declare const BROWSER_EVENT_CHANNELS: readonly ["browser:guest-load-failed", "browser:permission-denied", "browser:popup", "browser:context-menu-requested", "browser:context-menu-dismissed", "browser:open-link-in-orca-tab", "browser:focusAddressBar", "browser:reloadPage", "browser:hardReloadPage", "browser:findInPage", "browser:historyNavigate", "browser:zoomPage", "browser:systemResumed"];

type BrowserShortcutAction = 'browser.back' | 'browser.forward' | 'browser.reload' | 'browser.hardReload' | 'browser.focusAddressBar' | 'browser.find' | 'zoom.in' | 'zoom.out' | 'zoom.reset';
type BrowserShortcutInput = {
    key: string;
    code?: string;
    control?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
};
declare function matchBrowserShortcut(input: BrowserShortcutInput, platform: NodeJS.Platform): BrowserShortcutAction | null;
declare function formatBrowserShortcutLabel(action: BrowserShortcutAction, platform: NodeJS.Platform): string;

declare const ORCA_BROWSER_GUEST_WEB_PREFERENCES: {
    readonly disableHtmlFullscreenWindowResize: true;
};
declare const ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE = "disableHtmlFullscreenWindowResize=true";

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

type SearchEngine = 'google' | 'duckduckgo' | 'bing' | 'kagi';
type SearchUrlOptions = {
    kagiSessionLink?: string | null;
};
declare const SEARCH_ENGINE_LABELS: Record<SearchEngine, string>;
declare const DEFAULT_SEARCH_ENGINE: SearchEngine;
declare function classifySchemeLessLocalDevAddress(rawInput: string): URL | null;
declare function isEligibleLocalCertificateHost(hostname: string): boolean;
declare function toHttpsRecoveryUrl(rawUrl: string): string | null;
declare function toSecureCertificateEndpoint(rawUrl: string): string | null;
declare function resolveRemoteFailureExternalUrl(rawUrl: string): string | null;
declare function normalizeKagiSessionLink(rawLink: string): string | null;
declare function redactKagiSessionToken(rawUrl: string): string;
declare function buildSearchUrl(query: string, engine?: SearchEngine, options?: SearchUrlOptions): string;
declare function looksLikeSearchQuery(input: string): boolean;
/** True for input shaped like an absolute filesystem path (POSIX, Windows drive, or UNC). */
declare function isAbsoluteFilesystemPathInput(input: string): boolean;
declare function normalizeBrowserNavigationUrl(rawUrl: string, searchEngine?: SearchEngine | null, options?: SearchUrlOptions): string | null;
declare function normalizeExternalBrowserUrl(rawUrl: string): string | null;
/** Whether the URL points at the local file system; the in-app browser never loads such pages. */
declare function isFileUrl(url: string): boolean;

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
/** Persisted annotation payloads keep DOM context but drop transient screenshots. */
type BrowserAnnotationPayload = Omit<BrowserGrabPayload, 'screenshot'> & {
    screenshot: null;
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
type BrowserAnnotationIntent = 'fix' | 'change' | 'question' | 'approve';
type BrowserAnnotationPriority = 'blocking' | 'important' | 'suggestion';
type BrowserPageAnnotation = {
    id: string;
    browserPageId: string;
    comment: string;
    intent: BrowserAnnotationIntent;
    priority: BrowserAnnotationPriority;
    createdAt: string;
    payload: BrowserAnnotationPayload;
};
declare const GRAB_BUDGET: {
    readonly textSnippetMaxLength: 200;
    readonly nearbyTextEntryMaxLength: 200;
    readonly nearbyTextMaxEntries: 10;
    readonly htmlSnippetMaxLength: 4096;
    readonly ancestorPathMaxEntries: 10;
    readonly nearbyElementsMaxEntries: 6;
    readonly nearbyElementMaxLength: 160;
    readonly selectorMaxLength: 700;
    readonly pathMaxLength: 900;
    readonly cssClassesMaxLength: 500;
    readonly selectedTextMaxLength: 500;
    readonly sourceFileMaxLength: 500;
    readonly reactComponentsMaxLength: 500;
    readonly annotationCommentMaxLength: 2000;
    readonly annotationsMaxPerPage: 20;
    /** Hard byte budget for screenshot PNG data URL before we omit the screenshot. */
    readonly screenshotMaxBytes: number;
};
/** Only these attribute names are included in the payload by default. */
declare const GRAB_SAFE_ATTRIBUTE_NAMES: Set<string>;
/** Attribute names matching aria-* are always included. */
declare function isAriaAttribute(name: string): boolean;
/**
 * Patterns in attribute values that indicate secrets — these values get
 * redacted. Why tighter patterns than broad words like 'code' or 'state':
 * those match normal CSS class names (e.g. 'source-code', 'stateful') and
 * would visibly degrade extraction quality on most real-world sites. The
 * intent is to catch OAuth callback params and credential-like values.
 */
declare const GRAB_SECRET_PATTERNS: string[];

declare const MAX_BROWSER_HISTORY_ENTRIES = 200;
declare function normalizeBrowserHistoryUrl(url: string): string;

export { BROWSER_API_GLOBAL_KEY, BROWSER_EVENT_CHANNELS, BROWSER_INVOKE_CHANNELS, BROWSER_PAGE_ZOOM_LEVELS, BROWSER_PAGE_ZOOM_MAX, BROWSER_PAGE_ZOOM_MIN, BROWSER_PAGE_ZOOM_STEP, type BrowserAgentPayload, type BrowserAnnotationIntent, type BrowserAnnotationPayload, type BrowserAnnotationPriority, type BrowserApi, type BrowserAwaitGrabSelectionArgs, type BrowserCancelGrabArgs, type BrowserCaptureSelectionScreenshotArgs, type BrowserCaptureSelectionScreenshotResult, type BrowserContextMenuDismissedEvent, type BrowserContextMenuRequestedEvent, type BrowserExtractHoverArgs, type BrowserExtractHoverResult, type BrowserFindSource, type BrowserFindTarget, type BrowserGrabAccessibility, type BrowserGrabCancelReason, type BrowserGrabComputedStyles, type BrowserGrabPageContext, type BrowserGrabPayload, type BrowserGrabRect, type BrowserGrabRejectReason, type BrowserGrabResult, type BrowserGrabScreenshot, type BrowserGrabTarget, type BrowserGuestArgs, type BrowserGuestLoadFailedEvent, type BrowserHistoryEntry, type BrowserHistoryNavigateCommand, type BrowserHost, type BrowserHostLogger, type BrowserIdentityModeSetResult, type BrowserIdentityModeSnapshot, type BrowserIdentityModeStatus, type BrowserLoadError, type BrowserOpenLinkInTabEvent, type BrowserPage, type BrowserPageAnnotation, type BrowserPageCommandTarget, type BrowserPageZoomCommand, type BrowserPageZoomDirection, type BrowserPermissionDeniedEvent, type BrowserPluginHandle, type BrowserPluginOptions, type BrowserPopupEvent, type BrowserSetGrabModeArgs, type BrowserSetGrabModeResult, type BrowserShortcutAction, type BrowserShortcutInput, type BrowserUnsubscribe, type BrowserUserAgentMode, type BrowserViewportOverride, type BrowserViewportScrollState, DEFAULT_BROWSER_PAGE_ZOOM_LEVEL, DEFAULT_MCP_PORT, DEFAULT_SEARCH_ENGINE, GRAB_BUDGET, GRAB_SAFE_ATTRIBUTE_NAMES, GRAB_SECRET_PATTERNS, type GrabIntent, MAX_BROWSER_HISTORY_ENTRIES, ORCA_BROWSER_BLANK_URL, ORCA_BROWSER_GUEST_WEB_PREFERENCES, ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE, ORCA_BROWSER_PARTITION, PACKAGE_LOG_PREFIX, SEARCH_ENGINE_LABELS, type SearchEngine, type SearchUrlOptions, asBrowserFindTarget, browserPageZoomLevelToPercent, buildSearchUrl, classifySchemeLessLocalDevAddress, formatBrowserShortcutLabel, isAbsoluteFilesystemPathInput, isAriaAttribute, isEligibleLocalCertificateHost, isFileUrl, looksLikeSearchQuery, matchBrowserShortcut, nextBrowserPageZoomLevel, normalizeBrowserHistoryUrl, normalizeBrowserNavigationUrl, normalizeBrowserPageZoomLevel, normalizeExternalBrowserUrl, normalizeKagiSessionLink, redactKagiSessionToken, resolveRemoteFailureExternalUrl, toHttpsRecoveryUrl, toSecureCertificateEndpoint };
