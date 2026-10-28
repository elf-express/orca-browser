// src/renderer/BrowserPane.tsx
import { useEffect } from "react";

// src/renderer/components/browser-pane/assemble-chrome/browser-scope-anchor.ts
var ANCHOR_NAME_PREFIX = "--orca-browser-";
function browserScopeAnchorName(scopeId) {
  let escaped = "";
  for (const char of scopeId) {
    escaped += /[A-Za-z0-9-]/.test(char) ? char : `_${(char.codePointAt(0) ?? 0).toString(16).padStart(2, "0")}`;
  }
  return `${ANCHOR_NAME_PREFIX}${escaped}`;
}

// src/renderer/host-context.ts
import { createContext, useContext } from "react";
var BrowserRendererHostContext = createContext(null);
function useBrowserRendererHost() {
  const host = useContext(BrowserRendererHostContext);
  if (!host) {
    throw new Error("orca-browser: BrowserPane must be rendered inside BrowserPluginProvider");
  }
  return host;
}

// src/renderer/store/browser-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

// src/shared/constants.ts
var ORCA_BROWSER_PARTITION = "persist:orca-browser";
var ORCA_BROWSER_BLANK_URL = "data:text/html,";

// src/shared/browser-url.ts
var LOCAL_ADDRESS_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[[0-9a-f:]+\])(?::\d+)?(?:[/?#].*)?$/i;
var LOOKS_LIKE_URL_PATTERN = /^[^\s]+\.[a-z]{2,}(\/.*)?$/i;
var WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/].*$/;
var WINDOWS_UNC_PATH_PATTERN = /^\\\\[^\s\\/]+[\\/][^\\/]+(?:[\\/].*)?$/;
var UNIX_ABSOLUTE_PATH_PATTERN = /^\/.*$/;
var SEARCH_ENGINE_URLS = {
  google: "https://www.google.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  bing: "https://www.bing.com/search?q=",
  kagi: "https://kagi.com/search?q="
};
var DEFAULT_SEARCH_ENGINE = "google";
function classifySchemeLessLocalDevAddress(rawInput) {
  const trimmed = rawInput.trim();
  if (!LOCAL_ADDRESS_PATTERN.test(trimmed)) {
    return null;
  }
  try {
    return new URL(`http://${trimmed}`);
  } catch {
    return null;
  }
}
function normalizeCertificateHostname(hostname) {
  const lower = hostname.trim().toLowerCase();
  const unbracketed = lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
  return unbracketed.endsWith(".") ? unbracketed.slice(0, -1) : unbracketed;
}
function isValidDnsName(name) {
  if (name.length === 0 || name.length > 253) {
    return false;
  }
  return name.split(".").every(
    (label) => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}
function classifySchemeLessDomainPortAddress(input) {
  const match = /^([^\s/\\:@?#]+):\d+(?:[/?#].*)?$/.exec(input);
  if (!match || !match[1].includes(".")) {
    return null;
  }
  try {
    const url = new URL(`https://${input}`);
    const hostname = normalizeCertificateHostname(url.hostname);
    if (!isValidDnsName(hostname)) {
      return null;
    }
    return hostname.endsWith(".localhost") ? new URL(`http://${input}`) : url;
  } catch {
    return null;
  }
}
function normalizeKagiSessionLink(rawLink) {
  const trimmed = rawLink.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    const token = parsed.searchParams.get("token")?.trim();
    const pathOk = parsed.pathname === "/search" || parsed.pathname === "/search/";
    if (parsed.protocol !== "https:" || hostname !== "kagi.com" && hostname !== "www.kagi.com" || !pathOk || parsed.username !== "" || parsed.password !== "" || parsed.port !== "" || !token) {
      return null;
    }
    parsed.searchParams.delete("q");
    parsed.searchParams.set("token", token);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}
function redactKagiSessionToken(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol === "https:" && (hostname === "kagi.com" || hostname === "www.kagi.com") && (parsed.pathname === "/search" || parsed.pathname === "/search/") && parsed.searchParams.has("token")) {
      parsed.searchParams.delete("token");
      return parsed.toString();
    }
  } catch {
  }
  return rawUrl;
}
function buildKagiSessionSearchUrl(query, sessionLink) {
  if (!sessionLink) {
    return null;
  }
  const normalized = normalizeKagiSessionLink(sessionLink);
  if (!normalized) {
    return null;
  }
  const parsed = new URL(normalized);
  parsed.searchParams.set("q", query);
  return parsed.toString();
}
function buildSearchUrl(query, engine = DEFAULT_SEARCH_ENGINE, options = {}) {
  if (engine === "kagi") {
    const sessionSearchUrl = buildKagiSessionSearchUrl(query, options.kagiSessionLink);
    if (sessionSearchUrl) {
      return sessionSearchUrl;
    }
  }
  return `${SEARCH_ENGINE_URLS[engine]}${encodeURIComponent(query.toWellFormed())}`;
}
function looksLikeSearchQuery(input) {
  if (input.includes(" ")) {
    return true;
  }
  if (LOOKS_LIKE_URL_PATTERN.test(input)) {
    return false;
  }
  if (input.includes(".") || input.includes(":")) {
    return false;
  }
  return true;
}
function absolutePathToFileUrl(filePath) {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const segments = normalizedPath.split("/").map((segment, index) => {
    if (index === 0 && /^[A-Za-z]:$/.test(segment)) {
      return segment;
    }
    return encodeURIComponent(segment);
  });
  return normalizedPath.startsWith("/") ? `file://${segments.join("/")}` : `file:///${segments.join("/")}`;
}
function windowsUncPathToFileUrl(filePath) {
  const normalizedPath = filePath.replaceAll("\\", "/").replace(/^\/+/, "");
  const [host, ...pathSegments] = normalizedPath.split("/");
  return `file://${host}/${pathSegments.map(encodeURIComponent).join("/")}`;
}
function normalizeBrowserNavigationUrl(rawUrl, searchEngine, options = {}) {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0 || trimmed === "about:blank" || trimmed === ORCA_BROWSER_BLANK_URL) {
    return ORCA_BROWSER_BLANK_URL;
  }
  const localDevAddress = classifySchemeLessLocalDevAddress(trimmed);
  if (localDevAddress) {
    return localDevAddress.toString();
  }
  if (WINDOWS_UNC_PATH_PATTERN.test(trimmed)) {
    return windowsUncPathToFileUrl(trimmed);
  }
  if (UNIX_ABSOLUTE_PATH_PATTERN.test(trimmed) || WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)) {
    return absolutePathToFileUrl(trimmed);
  }
  const domainPortAddress = classifySchemeLessDomainPortAddress(trimmed);
  if (domainPortAddress) {
    return domainPortAddress.toString();
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "file:" ? parsed.toString() : null;
  } catch {
    const searchEnabled = searchEngine !== void 0;
    try {
      const withScheme = new URL(`https://${trimmed}`);
      if (!searchEnabled || !looksLikeSearchQuery(trimmed)) {
        return withScheme.toString();
      }
    } catch {
    }
    if (!searchEnabled) {
      return null;
    }
    return buildSearchUrl(trimmed, searchEngine ?? DEFAULT_SEARCH_ENGINE, options);
  }
}

// src/shared/workspace-session-browser-history.ts
var MAX_BROWSER_HISTORY_ENTRIES = 200;
function normalizeBrowserHistoryUrl(url) {
  try {
    const parsed = new URL(redactKagiSessionToken(url));
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.protocol = parsed.protocol.toLowerCase();
    let normalized = parsed.toString();
    if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return redactKagiSessionToken(url).toLowerCase();
  }
}

// src/renderer/components/browser-pane/host-guest/browser-page-mount-admission.ts
import { useSyncExternalStore } from "react";
var admittedPageIds = /* @__PURE__ */ new Set();
var listeners = /* @__PURE__ */ new Set();
var version = 0;
function isBrowserPageMountAdmitted(pageId) {
  return admittedPageIds.has(pageId);
}
function emit() {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
}
function admitBrowserPageMount(pageId) {
  if (admittedPageIds.has(pageId)) {
    return;
  }
  admittedPageIds.add(pageId);
  emit();
}
function releaseBrowserPageMount(pageId) {
  if (!admittedPageIds.delete(pageId)) {
    return;
  }
  emit();
}
function useAnyBrowserPageMountAdmission(pageIds) {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => {
      void version;
      return pageIds.some(isBrowserPageMountAdmitted);
    },
    () => false
  );
  return pageIds.some(isBrowserPageMountAdmitted);
}

// src/renderer/components/browser-pane/describe-page/live-browser-url-registry.ts
var liveBrowserUrlByTabId = /* @__PURE__ */ new Map();
function seedLiveBrowserUrl(browserTabId, initialUrl) {
  if (!liveBrowserUrlByTabId.has(browserTabId)) {
    liveBrowserUrlByTabId.set(browserTabId, initialUrl);
  }
}
function rememberLiveBrowserUrl(browserTabId, url) {
  liveBrowserUrlByTabId.set(browserTabId, url);
}
function clearLiveBrowserUrl(browserTabId) {
  liveBrowserUrlByTabId.delete(browserTabId);
}

// src/renderer/components/browser-pane/host-guest/browser-page-viewport.ts
var slotViewportRoots = /* @__PURE__ */ new Map();
var browserPageViewports = /* @__PURE__ */ new Map();
var browserPageChromeInsetHeights = /* @__PURE__ */ new Map();
var browserPageViewportPresetSizes = /* @__PURE__ */ new Map();
var slotRootListeners = /* @__PURE__ */ new Map();
function notifySlotRootListeners(workspaceTabId) {
  for (const listener of slotRootListeners.get(workspaceTabId) ?? []) {
    listener();
  }
}
function registerBrowserOverlaySlotViewport(workspaceTabId, element) {
  if (element) {
    slotViewportRoots.set(workspaceTabId, element);
    notifySlotRootListeners(workspaceTabId);
    return;
  }
  slotViewportRoots.delete(workspaceTabId);
  notifySlotRootListeners(workspaceTabId);
}
function getBrowserOverlaySlotViewport(workspaceTabId) {
  return slotViewportRoots.get(workspaceTabId) ?? null;
}
function subscribeBrowserOverlaySlotViewport(workspaceTabId, listener) {
  let listeners2 = slotRootListeners.get(workspaceTabId);
  if (!listeners2) {
    listeners2 = /* @__PURE__ */ new Set();
    slotRootListeners.set(workspaceTabId, listeners2);
  }
  const ownedListeners = listeners2;
  ownedListeners.add(listener);
  return () => {
    ownedListeners.delete(listener);
    if (ownedListeners.size === 0 && slotRootListeners.get(workspaceTabId) === ownedListeners) {
      slotRootListeners.delete(workspaceTabId);
    }
  };
}
function ensureBrowserPageViewport(browserPageId, workspaceTabId) {
  const root = slotViewportRoots.get(workspaceTabId);
  const existing = browserPageViewports.get(browserPageId);
  if (existing) {
    if (!root || existing.shell.parentElement === root) {
      return existing;
    }
    existing.shell.remove();
    browserPageViewports.delete(browserPageId);
  }
  if (!root) {
    return null;
  }
  const shell = document.createElement("div");
  shell.dataset.browserPageViewportId = browserPageId;
  shell.className = "absolute inset-0 flex min-h-0 flex-col";
  shell.style.display = "none";
  shell.inert = true;
  shell.setAttribute("aria-hidden", "true");
  const chromeInset = document.createElement("div");
  chromeInset.dataset.browserPageChromeInset = "";
  chromeInset.className = "shrink-0";
  const rememberedInsetHeight = browserPageChromeInsetHeights.get(browserPageId);
  if (rememberedInsetHeight !== void 0) {
    chromeInset.style.height = `${rememberedInsetHeight}px`;
  }
  const container = document.createElement("div");
  container.dataset.browserPageContainer = "";
  container.className = "relative flex min-h-0 flex-1 overflow-hidden bg-background";
  const scroller = document.createElement("div");
  scroller.dataset.browserPageScroller = "";
  scroller.className = "[scrollbar-width:thin] relative min-h-0 min-w-0 flex-1 overflow-hidden";
  const content = document.createElement("div");
  content.dataset.browserPageContent = "";
  content.className = "relative mx-auto";
  scroller.appendChild(content);
  container.appendChild(scroller);
  shell.append(chromeInset, container);
  root.appendChild(shell);
  const viewport = { shell, chromeInset, container, scroller, content };
  browserPageViewports.set(browserPageId, viewport);
  applyViewportPresetSizeStyles(viewport, browserPageViewportPresetSizes.get(browserPageId) ?? null);
  return viewport;
}
var BROWSER_PAGE_PRESET_VIEWPORT_CLASS_NAME = "browser-page-preset-viewport";
function applyViewportPresetSizeStyles(viewport, size) {
  if (size) {
    viewport.content.style.setProperty("--browser-page-viewport-width", `${size.width}px`);
    viewport.content.style.setProperty("--browser-page-viewport-height", `${size.height}px`);
    viewport.content.style.removeProperty("width");
    viewport.content.style.removeProperty("height");
    viewport.content.classList.add(BROWSER_PAGE_PRESET_VIEWPORT_CLASS_NAME);
  } else {
    viewport.content.classList.remove(BROWSER_PAGE_PRESET_VIEWPORT_CLASS_NAME);
    viewport.content.style.removeProperty("--browser-page-viewport-width");
    viewport.content.style.removeProperty("--browser-page-viewport-height");
    viewport.content.style.width = "100%";
    viewport.content.style.height = "100%";
  }
  viewport.scroller.style.overflow = size ? "auto" : "";
}
function setBrowserPageViewportPresetSize(browserPageId, size) {
  if (size) {
    browserPageViewportPresetSizes.set(browserPageId, size);
  } else {
    browserPageViewportPresetSizes.delete(browserPageId);
  }
  const viewport = browserPageViewports.get(browserPageId);
  if (viewport) {
    applyViewportPresetSizeStyles(viewport, size);
  }
}
function clearBrowserPageViewportPresetSize(browserPageId) {
  setBrowserPageViewportPresetSize(browserPageId, null);
}
function removeBrowserPageViewport(browserPageId) {
  const viewport = browserPageViewports.get(browserPageId);
  if (viewport) {
    viewport.shell.remove();
    browserPageViewports.delete(browserPageId);
  }
}
function applyBrowserPageViewportLayout(browserPageId, layout) {
  const viewport = browserPageViewports.get(browserPageId);
  if (!viewport) {
    return;
  }
  if (!layout.paintable) {
    viewport.shell.style.display = "none";
    viewport.shell.inert = true;
    viewport.shell.setAttribute("aria-hidden", "true");
    return;
  }
  viewport.shell.inert = !layout.active;
  if (layout.active) {
    viewport.shell.removeAttribute("aria-hidden");
  } else {
    viewport.shell.setAttribute("aria-hidden", "true");
  }
  viewport.shell.style.display = "flex";
  viewport.shell.style.opacity = layout.active ? "1" : "0";
  viewport.shell.style.pointerEvents = layout.active ? "auto" : "none";
  viewport.shell.style.zIndex = layout.active ? "1" : "0";
}
function parkBrowserPageViewport(browserPageId) {
  const viewport = browserPageViewports.get(browserPageId);
  if (viewport) {
    viewport.shell.style.display = "none";
    viewport.shell.inert = true;
    viewport.shell.setAttribute("aria-hidden", "true");
    viewport.shell.style.pointerEvents = "none";
    viewport.shell.style.opacity = "0";
  }
}

// src/shared/browser-page-zoom.ts
var BROWSER_PAGE_ZOOM_STEP = 0.5;
var BROWSER_PAGE_ZOOM_MIN = -3;
var BROWSER_PAGE_ZOOM_MAX = 5;
var DEFAULT_BROWSER_PAGE_ZOOM_LEVEL = 0;
var BROWSER_PAGE_ZOOM_LEVELS = Array.from(
  {
    length: Math.round((BROWSER_PAGE_ZOOM_MAX - BROWSER_PAGE_ZOOM_MIN) / BROWSER_PAGE_ZOOM_STEP) + 1
  },
  (_, index) => BROWSER_PAGE_ZOOM_MIN + index * BROWSER_PAGE_ZOOM_STEP
);
function normalizeBrowserPageZoomLevel(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_BROWSER_PAGE_ZOOM_LEVEL;
  }
  const roundedToStep = Math.round(value / BROWSER_PAGE_ZOOM_STEP) * BROWSER_PAGE_ZOOM_STEP;
  return Math.max(BROWSER_PAGE_ZOOM_MIN, Math.min(BROWSER_PAGE_ZOOM_MAX, roundedToStep));
}
function browserPageZoomLevelToPercent(level) {
  return Math.round(100 * 1.2 ** normalizeBrowserPageZoomLevel(level));
}

// src/renderer/components/browser-pane/host-guest/browser-page-zoom.ts
function setBrowserPageZoomLevel(webview, level) {
  try {
    if (!webview || webview.isDestroyed?.()) {
      return null;
    }
    const next = normalizeBrowserPageZoomLevel(level);
    if (normalizeBrowserPageZoomLevel(webview.getZoomLevel()) === next) {
      return next;
    }
    webview.setZoomLevel(next);
    return next;
  } catch {
    return null;
  }
}
var explicitPaneZoomLevels = /* @__PURE__ */ new Map();
function forgetExplicitBrowserPageZoomLevel(browserPageId) {
  explicitPaneZoomLevels.delete(browserPageId);
}

// src/renderer/components/browser-pane/host-guest/webview-drag-passthrough.ts
var passthroughTokens = /* @__PURE__ */ new Set();
var passthroughSurfaces = /* @__PURE__ */ new Set();
function isWebviewDragPassthroughActive() {
  return passthroughTokens.size > 0;
}
function registerWebviewDragPassthroughSurface(surface) {
  passthroughSurfaces.add(surface);
  return () => {
    passthroughSurfaces.delete(surface);
  };
}
function notifyWebviewDragPassthroughSurfaces() {
  const passthrough = isWebviewDragPassthroughActive();
  const notified = Array.from(passthroughSurfaces);
  for (const surface of notified) {
    surface(passthrough);
  }
}
function acquireWebviewsDragPassthrough() {
  const token = /* @__PURE__ */ Symbol("webview-drag-passthrough");
  let released = false;
  passthroughTokens.add(token);
  notifyWebviewDragPassthroughSurfaces();
  return () => {
    if (released) {
      return;
    }
    released = true;
    passthroughTokens.delete(token);
    notifyWebviewDragPassthroughSurfaces();
  };
}

// src/renderer/components/browser-pane/host-guest/webview-registry.ts
var webviewRegistry = /* @__PURE__ */ new Map();
var registeredWebContentsIds = /* @__PURE__ */ new Map();
var DRAG_LISTENER_KEY = "__orcaBrowserPaneDragListeners";
var dragListenersAttached = false;
var nativeDragPassthroughRelease = null;
var dragPassthroughPreviousPointerEvents = /* @__PURE__ */ new Map();
var rendererRecoveryPendingPageIds = /* @__PURE__ */ new Set();
var webviewLifecycleListeners = /* @__PURE__ */ new Map();
function getListenerHost() {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return null;
  }
  return window;
}
function removeDragListeners() {
  const listenerHost = getListenerHost();
  const existingListeners = listenerHost?.[DRAG_LISTENER_KEY];
  if (!listenerHost || !existingListeners) {
    return;
  }
  window.removeEventListener("dragstart", existingListeners.dragstart, true);
  window.removeEventListener("dragend", existingListeners.dragend, true);
  window.removeEventListener("drop", existingListeners.drop, true);
  window.removeEventListener("pointerdown", existingListeners.pointerdown, true);
  window.removeEventListener("pointermove", existingListeners.pointermove, true);
  delete listenerHost[DRAG_LISTENER_KEY];
  dragListenersAttached = false;
  nativeDragPassthroughRelease?.();
  nativeDragPassthroughRelease = null;
}
function ensureDragListeners() {
  const listenerHost = getListenerHost();
  if (!listenerHost) {
    return;
  }
  if (dragListenersAttached && listenerHost[DRAG_LISTENER_KEY]) {
    return;
  }
  removeDragListeners();
  const dragstart = () => setWebviewsDragPassthrough(true);
  const dragend = () => setWebviewsDragPassthrough(false);
  const drop = () => setWebviewsDragPassthrough(false);
  const pointerdown = () => setWebviewsDragPassthrough(false);
  const pointermove = () => setWebviewsDragPassthrough(false);
  window.addEventListener("dragstart", dragstart, true);
  window.addEventListener("dragend", dragend, true);
  window.addEventListener("drop", drop, true);
  window.addEventListener("pointerdown", pointerdown, true);
  window.addEventListener("pointermove", pointermove, true);
  listenerHost[DRAG_LISTENER_KEY] = { dragstart, dragend, drop, pointerdown, pointermove };
  dragListenersAttached = true;
}
function applyWebviewsDragPassthrough(passthrough) {
  for (const webview of webviewRegistry.values()) {
    if (passthrough) {
      if (!dragPassthroughPreviousPointerEvents.has(webview)) {
        dragPassthroughPreviousPointerEvents.set(webview, webview.style.pointerEvents);
      }
      webview.style.pointerEvents = "none";
      continue;
    }
    const previous = dragPassthroughPreviousPointerEvents.get(webview);
    if (previous !== void 0) {
      webview.style.pointerEvents = previous;
      dragPassthroughPreviousPointerEvents.delete(webview);
    }
  }
}
registerWebviewDragPassthroughSurface(applyWebviewsDragPassthrough);
function setWebviewsDragPassthrough(passthrough) {
  if (passthrough) {
    if (!nativeDragPassthroughRelease) {
      nativeDragPassthroughRelease = acquireWebviewsDragPassthrough();
    }
    return;
  }
  nativeDragPassthroughRelease?.();
  nativeDragPassthroughRelease = null;
}
function applyCurrentDragPassthroughToWebview(webview) {
  if (!isWebviewDragPassthroughActive()) {
    return;
  }
  if (!dragPassthroughPreviousPointerEvents.has(webview)) {
    dragPassthroughPreviousPointerEvents.set(webview, webview.style.pointerEvents);
  }
  webview.style.pointerEvents = "none";
}
function registerPersistentWebview(browserTabId, webview) {
  const previousListeners = webviewLifecycleListeners.get(browserTabId);
  if (previousListeners) {
    previousListeners.webview.removeEventListener(
      "render-process-gone",
      previousListeners.onRendererGone
    );
    previousListeners.webview.removeEventListener("dom-ready", previousListeners.onRendererReady);
    previousListeners.webview.removeEventListener("destroyed", previousListeners.onGuestDestroyed);
  }
  const onRendererGone = () => {
    rendererRecoveryPendingPageIds.add(browserTabId);
  };
  const onRendererReady = () => {
    rendererRecoveryPendingPageIds.delete(browserTabId);
  };
  const onGuestDestroyed = () => {
    if (webview.isConnected) {
      rendererRecoveryPendingPageIds.add(browserTabId);
    }
  };
  webview.addEventListener("render-process-gone", onRendererGone);
  webview.addEventListener("dom-ready", onRendererReady);
  webview.addEventListener("destroyed", onGuestDestroyed);
  webviewLifecycleListeners.set(browserTabId, {
    webview,
    onRendererGone,
    onRendererReady,
    onGuestDestroyed
  });
  webviewRegistry.set(browserTabId, webview);
  applyCurrentDragPassthroughToWebview(webview);
  ensureDragListeners();
}
function unregisterPersistentWebview(browserTabId) {
  const webview = webviewRegistry.get(browserTabId);
  const lifecycleListeners = webviewLifecycleListeners.get(browserTabId);
  if (lifecycleListeners) {
    lifecycleListeners.webview.removeEventListener(
      "render-process-gone",
      lifecycleListeners.onRendererGone
    );
    lifecycleListeners.webview.removeEventListener("dom-ready", lifecycleListeners.onRendererReady);
    lifecycleListeners.webview.removeEventListener("destroyed", lifecycleListeners.onGuestDestroyed);
    webviewLifecycleListeners.delete(browserTabId);
  }
  rendererRecoveryPendingPageIds.delete(browserTabId);
  if (webview) {
    dragPassthroughPreviousPointerEvents.delete(webview);
  }
  webviewRegistry.delete(browserTabId);
  if (webviewRegistry.size === 0) {
    removeDragListeners();
  }
}
function isBrowserPageRendererRecoveryPending(browserTabId) {
  return rendererRecoveryPendingPageIds.has(browserTabId);
}
function moveFocusToRendererIfWebviewOwnsFocus(webview) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }
  if (webview === activeElement || webview.contains(activeElement)) {
    activeElement.blur?.();
    window.focus();
    return true;
  }
  return false;
}
function moveFocusToRendererBeforeWebviewDetach(webview) {
  moveFocusToRendererIfWebviewOwnsFocus(webview);
}
function removePersistentWebview(browserTabId, { preserveViewport, preserveZoom }) {
  const webview = webviewRegistry.get(browserTabId);
  if (!preserveZoom) {
    forgetExplicitBrowserPageZoomLevel(browserTabId);
  }
  if (!webview) {
    if (!preserveViewport) {
      clearBrowserPageViewportPresetSize(browserTabId);
      removeBrowserPageViewport(browserTabId);
    }
    registeredWebContentsIds.delete(browserTabId);
    clearLiveBrowserUrl(browserTabId);
    return Promise.resolve();
  }
  const unregisterGuest = Promise.resolve(
    window.browserAPI.unregisterGuest({ browserPageId: browserTabId })
  ).then(() => {
  }).catch(() => {
  });
  moveFocusToRendererBeforeWebviewDetach(webview);
  webview.remove();
  unregisterPersistentWebview(browserTabId);
  if (!preserveViewport) {
    clearBrowserPageViewportPresetSize(browserTabId);
    removeBrowserPageViewport(browserTabId);
  }
  registeredWebContentsIds.delete(browserTabId);
  clearLiveBrowserUrl(browserTabId);
  return unregisterGuest;
}
function destroyPersistentWebview(browserTabId) {
  return removePersistentWebview(browserTabId, {
    preserveViewport: false,
    preserveZoom: false
  });
}
function replacePersistentWebview(browserTabId, { preserveViewport = false } = {}) {
  return removePersistentWebview(browserTabId, { preserveViewport, preserveZoom: true });
}

// src/renderer/store/browser-store.ts
var BROWSER_HISTORY_STORAGE_KEY = "orca-browser:history:v1";
function isBlankHistoryUrl(url) {
  return url === ORCA_BROWSER_BLANK_URL || url === "about:blank" || url === "";
}
function makePage(scopeId, url) {
  return {
    id: globalThis.crypto.randomUUID(),
    scopeId,
    url,
    title: url === ORCA_BROWSER_BLANK_URL ? "New Tab" : url,
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: Date.now()
  };
}
var useBrowserStore = create()(
  persist(
    (set, get) => {
      const updatePage = (pageId, update) => {
        set((state) => {
          for (const [scopeId, pages] of Object.entries(state.pagesByScope)) {
            const index = pages.findIndex((page) => page.id === pageId);
            if (index === -1) {
              continue;
            }
            const nextPages = pages.slice();
            nextPages[index] = update(pages[index]);
            return { pagesByScope: { ...state.pagesByScope, [scopeId]: nextPages } };
          }
          return state;
        });
      };
      return {
        pagesByScope: {},
        activePageIdByScope: {},
        paneMountByScope: {},
        browserUrlHistory: [],
        pendingAddressBarFocusByPageId: {},
        ensureScopePage: (scopeId) => {
          const existing = get().pagesByScope[scopeId];
          if (existing && existing.length > 0) {
            const activeId = get().activePageIdByScope[scopeId];
            return existing.find((page) => page.id === activeId) ?? existing[0];
          }
          return get().createBrowserPage(scopeId, ORCA_BROWSER_BLANK_URL);
        },
        createBrowserPage: (scopeId, url, options) => {
          const page = makePage(scopeId, url);
          const activate = options?.activate ?? true;
          set((state) => ({
            pagesByScope: {
              ...state.pagesByScope,
              [scopeId]: [...state.pagesByScope[scopeId] ?? [], page]
            },
            activePageIdByScope: {
              ...state.activePageIdByScope,
              [scopeId]: activate || state.activePageIdByScope[scopeId] == null ? page.id : state.activePageIdByScope[scopeId]
            }
          }));
          if (!activate) {
            admitBrowserPageMount(page.id);
          }
          return page;
        },
        closeBrowserPage: (pageId) => {
          const scopeId = getScopeIdForPage(pageId);
          if (!scopeId) {
            return;
          }
          void destroyPersistentWebview(pageId);
          set((state) => {
            const pages = state.pagesByScope[scopeId] ?? [];
            const index = pages.findIndex((page) => page.id === pageId);
            const remaining = pages.filter((page) => page.id !== pageId);
            const wasActive = state.activePageIdByScope[scopeId] === pageId;
            const nextActive = wasActive ? (remaining[index] ?? remaining[index - 1] ?? null)?.id : state.activePageIdByScope[scopeId];
            const { [pageId]: _focusRequest, ...pendingFocus } = state.pendingAddressBarFocusByPageId;
            return {
              pagesByScope: { ...state.pagesByScope, [scopeId]: remaining },
              activePageIdByScope: { ...state.activePageIdByScope, [scopeId]: nextActive ?? null },
              pendingAddressBarFocusByPageId: pendingFocus
            };
          });
        },
        setActiveBrowserPage: (scopeId, pageId) => {
          const pages = get().pagesByScope[scopeId] ?? [];
          if (!pages.some((page) => page.id === pageId)) {
            return;
          }
          set((state) => ({
            activePageIdByScope: { ...state.activePageIdByScope, [scopeId]: pageId }
          }));
        },
        updateBrowserPageState: (pageId, updates) => {
          updatePage(pageId, (page) => ({ ...page, ...updates }));
        },
        setBrowserPageUrl: (pageId, url, options) => {
          updatePage(pageId, (page) => ({
            ...page,
            url,
            loadError: options?.preserveLoadError ? page.loadError : null
          }));
        },
        addBrowserHistoryEntry: (url, title, faviconUrl) => {
          if (isBlankHistoryUrl(url)) {
            return;
          }
          const normalizedUrl = normalizeBrowserHistoryUrl(url);
          set((state) => {
            const existing = state.browserUrlHistory.find(
              (entry2) => entry2.normalizedUrl === normalizedUrl
            );
            const entry = {
              url,
              normalizedUrl,
              title,
              faviconUrl: faviconUrl ?? existing?.faviconUrl ?? null,
              lastVisitedAt: Date.now(),
              visitCount: (existing?.visitCount ?? 0) + 1
            };
            const others = state.browserUrlHistory.filter(
              (candidate) => candidate.normalizedUrl !== normalizedUrl
            );
            return { browserUrlHistory: [entry, ...others].slice(0, MAX_BROWSER_HISTORY_ENTRIES) };
          });
        },
        clearBrowserHistory: () => set({ browserUrlHistory: [] }),
        requestAddressBarFocus: (pageId) => {
          set((state) => ({
            pendingAddressBarFocusByPageId: {
              ...state.pendingAddressBarFocusByPageId,
              [pageId]: true
            }
          }));
        },
        consumeAddressBarFocusRequest: (pageId) => {
          if (!get().pendingAddressBarFocusByPageId[pageId]) {
            return false;
          }
          set((state) => {
            const { [pageId]: _consumed, ...rest } = state.pendingAddressBarFocusByPageId;
            return { pendingAddressBarFocusByPageId: rest };
          });
          return true;
        },
        setPaneMount: (scopeId, mount) => {
          set((state) => {
            const current = state.paneMountByScope[scopeId];
            if (mount === null) {
              if (!current) {
                return state;
              }
              const { [scopeId]: _removed, ...rest } = state.paneMountByScope;
              return { paneMountByScope: rest };
            }
            if (current?.active === mount.active) {
              return state;
            }
            return { paneMountByScope: { ...state.paneMountByScope, [scopeId]: mount } };
          });
        }
      };
    },
    {
      name: BROWSER_HISTORY_STORAGE_KEY,
      partialize: (state) => ({ browserUrlHistory: state.browserUrlHistory })
    }
  )
);
function getScopeIdForPage(pageId) {
  for (const [scopeId, pages] of Object.entries(useBrowserStore.getState().pagesByScope)) {
    if (pages.some((page) => page.id === pageId)) {
      return scopeId;
    }
  }
  return null;
}

// src/renderer/BrowserPane.tsx
import { jsx } from "react/jsx-runtime";
function BrowserPane(props) {
  useBrowserRendererHost();
  const { scopeId, active } = props;
  const anchorName = browserScopeAnchorName(scopeId);
  useEffect(() => {
    useBrowserStore.getState().ensureScopePage(scopeId);
  }, [scopeId]);
  useEffect(() => {
    useBrowserStore.getState().setPaneMount(scopeId, { active });
  }, [scopeId, active]);
  useEffect(() => {
    return () => useBrowserStore.getState().setPaneMount(scopeId, null);
  }, [scopeId]);
  const style = { anchorName };
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-orca-browser-pane": "",
      "data-scope-id": scopeId,
      "data-active": String(active),
      "data-orca-browser-anchor": anchorName,
      className: "relative flex h-full min-h-0 flex-1",
      style
    }
  );
}

// src/renderer/BrowserPluginProvider.tsx
import { useEffect as useEffect4 } from "react";

// src/renderer/i18n.ts
var currentHost = null;
function setBrowserRendererHost(host) {
  currentHost = host;
}
function clearBrowserRendererHost(host) {
  if (currentHost === host) {
    currentHost = null;
  }
}
function translate(key, fallback, vars) {
  if (currentHost) {
    return currentHost.t(key, fallback, vars);
  }
  if (!vars) {
    return fallback;
  }
  return fallback.replace(
    /\{\{(\w+)\}\}/g,
    (match, name) => Object.hasOwn(vars, name) ? String(vars[name]) : match
  );
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserPaneOverlayLayer.tsx
import { memo, useCallback as useCallback4, useMemo as useMemo2 } from "react";
import { useShallow } from "zustand/react/shallow";

// src/renderer/components/browser-pane/assemble-chrome/browser-workspace-pane.tsx
import { useMemo } from "react";

// src/renderer/components/browser-pane/assemble-chrome/browser-pane-page-selection.ts
var EMPTY_BROWSER_PAGES = [];
function getBrowserPagesForWorkspace(browserPagesByWorkspace, workspaceId) {
  return browserPagesByWorkspace[workspaceId] ?? EMPTY_BROWSER_PAGES;
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserPageStrip.tsx
import { X } from "lucide-react";

// src/renderer/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/renderer/components/browser-pane/describe-page/browser-favicon-url.ts
function displayableFaviconUrl(faviconUrl) {
  const trimmed = faviconUrl?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}
function pickDisplayableFaviconUrl(favicons) {
  for (const candidate of favicons ?? []) {
    const displayable = displayableFaviconUrl(candidate);
    if (displayable) {
      return displayable;
    }
  }
  return null;
}
function faviconOrigin(rawUrl) {
  if (!rawUrl) {
    return null;
  }
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}
function browserNavigationLeavesFaviconOrigin(fromUrl, toUrl) {
  const to = faviconOrigin(toUrl);
  if (to === null) {
    return true;
  }
  const from = faviconOrigin(fromUrl);
  if (from === null) {
    return false;
  }
  return from !== to;
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserPageStrip.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function BrowserPageStrip({
  pages,
  activePageId,
  onSelect,
  onClose
}) {
  return /* @__PURE__ */ jsx2(
    "div",
    {
      "data-orca-browser-page-strip": "",
      className: "flex h-8 shrink-0 items-stretch gap-px overflow-x-auto border-b border-border bg-muted/40",
      children: pages.map((page) => {
        const faviconUrl = displayableFaviconUrl(page.faviconUrl);
        const isActive = page.id === activePageId;
        return /* @__PURE__ */ jsxs(
          "div",
          {
            "data-orca-browser-page-strip-item": page.id,
            "data-active": String(isActive),
            className: cn(
              "group flex min-w-0 max-w-48 items-center gap-1 pl-2 pr-1 text-xs",
              isActive ? "bg-background text-foreground" : "text-muted-foreground"
            ),
            children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  className: "flex min-w-0 flex-1 items-center gap-1.5 truncate text-left",
                  onClick: () => onSelect(page.id),
                  children: [
                    faviconUrl ? /* @__PURE__ */ jsx2("img", { src: faviconUrl, alt: "", className: "size-3.5 shrink-0" }) : /* @__PURE__ */ jsx2("span", { className: "size-3.5 shrink-0", "aria-hidden": "true" }),
                    /* @__PURE__ */ jsx2("span", { className: "truncate", children: page.title })
                  ]
                }
              ),
              /* @__PURE__ */ jsx2(
                "button",
                {
                  type: "button",
                  "aria-label": translate("auto.components.browser.pageStrip.close", "Close page"),
                  className: "flex size-4 shrink-0 items-center justify-center rounded hover:bg-muted",
                  onClick: () => onClose(page.id),
                  children: /* @__PURE__ */ jsx2(X, { className: "size-3" })
                }
              )
            ]
          },
          page.id
        );
      })
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-pane.tsx
import { useCallback as useCallback3, useLayoutEffect as useLayoutEffect2, useRef as useRef2 } from "react";

// src/renderer/components/browser-pane/host-guest/browser-page-paintability.ts
function isBrowserPagePanePaintable({ isActive }) {
  return isActive;
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-slot-viewport.ts
import { useCallback, useSyncExternalStore as useSyncExternalStore2 } from "react";
function useBrowserPageSlotViewport(workspaceId) {
  const subscribe = useCallback(
    (listener) => subscribeBrowserOverlaySlotViewport(workspaceId, listener),
    [workspaceId]
  );
  const getSnapshot = useCallback(() => getBrowserOverlaySlotViewport(workspaceId), [workspaceId]);
  return useSyncExternalStore2(subscribe, getSnapshot, () => null);
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-webview-lifecycle.ts
import {
  useCallback as useCallback2,
  useEffect as useEffect2,
  useLayoutEffect,
  useRef,
  useState
} from "react";

// src/renderer/components/browser-pane/describe-page/browser-page-url-display.ts
function toDisplayUrl(url) {
  return url === ORCA_BROWSER_BLANK_URL ? "about:blank" : redactKagiSessionToken(url);
}
function getBrowserDisplayTitle(title, url) {
  if (url === "about:blank" || url === ORCA_BROWSER_BLANK_URL || title === "about:blank" || title === ORCA_BROWSER_BLANK_URL || !title) {
    return "New Tab";
  }
  return title;
}
function isChromiumErrorPage(url) {
  return url.startsWith("chrome-error://");
}

// src/shared/browser-guest-web-preferences.ts
var ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE = "disableHtmlFullscreenWindowResize=true";

// src/renderer/components/browser-pane/host-guest/browser-page-webview.ts
function setBrowserPageWebviewInputLock(webview, inputLocked) {
  webview.style.pointerEvents = inputLocked ? "none" : "auto";
}
function ensureBrowserPageWebview({
  browserTabId,
  container,
  inputLocked,
  webviewPartition,
  resolveContainer
}) {
  let webview = webviewRegistry.get(browserTabId);
  let created = false;
  let activeContainer = container;
  const parentDrifted = webview?.parentElement !== container;
  if (webview && (parentDrifted || webview.getAttribute("partition") !== webviewPartition)) {
    if (parentDrifted) {
      void replacePersistentWebview(browserTabId, { preserveViewport: true });
    } else {
      void destroyPersistentWebview(browserTabId);
    }
    webview = void 0;
    const refreshedContainer = resolveContainer();
    if (!refreshedContainer) {
      return null;
    }
    activeContainer = refreshedContainer;
  }
  if (webview) {
    setBrowserPageWebviewInputLock(webview, inputLocked);
    return { container: activeContainer, created, webview };
  }
  webview = document.createElement("webview");
  webview.setAttribute("partition", webviewPartition);
  webview.setAttribute("allowpopups", "");
  webview.setAttribute(
    "webpreferences",
    `${ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE},transparent=false`
  );
  webview.style.display = "flex";
  webview.style.flex = "1";
  webview.style.width = "100%";
  webview.style.height = "100%";
  webview.style.border = "none";
  setBrowserPageWebviewInputLock(webview, inputLocked);
  webview.style.background = "var(--background)";
  const guest = webview;
  guest.addEventListener("load-commit", (event) => {
    if (event.isMainFrame) {
      guest.style.visibility = event.url === "about:blank" || event.url === ORCA_BROWSER_BLANK_URL ? "hidden" : "visible";
    }
  });
  guest.addEventListener("render-process-gone", () => {
    guest.style.visibility = "hidden";
  });
  registerPersistentWebview(browserTabId, webview);
  activeContainer.appendChild(webview);
  created = true;
  return { container: activeContainer, created, webview };
}

// src/renderer/components/browser-pane/host-guest/browser-system-resume.ts
var resumeListeners = /* @__PURE__ */ new Set();
var unsubscribeSystemResumed = null;
function dispatchBrowserSystemResume() {
  for (const listener of resumeListeners) {
    try {
      listener();
    } catch (error) {
      console.error("[browser] system resume listener failed:", error);
    }
  }
}
function subscribeBrowserSystemResume(listener) {
  resumeListeners.add(listener);
  unsubscribeSystemResumed ??= window.browserAPI.onSystemResumed(dispatchBrowserSystemResume);
  return () => {
    resumeListeners.delete(listener);
    if (resumeListeners.size === 0) {
      unsubscribeSystemResumed?.();
      unsubscribeSystemResumed = null;
    }
  };
}

// src/renderer/components/browser-pane/host-guest/browser-page-guest-recovery.ts
var BROWSER_GUEST_RECOVERY_ERROR_CODE = -1e4;
var BROWSER_GUEST_RECOVERY_TIMEOUT_MS = 8e3;
var BROWSER_GUEST_VALIDATION_RETRY_DELAY_MS = 1e3;
var BROWSER_GUEST_VALIDATION_TIMEOUT_MS = 3e3;
var BROWSER_GUEST_VALIDATION_MAX_ATTEMPTS = 3;
function createBrowserPageGuestRecovery(options) {
  let recoveryTimer = null;
  let disposed = false;
  let recoveryStarted = options.isPending();
  let replacementRequired = false;
  let replacementRequested = false;
  let validationInFlight = false;
  let validationFailureCount = 0;
  let validationRetryTimer = null;
  let validationTimeoutTimer = null;
  let lifecycleGeneration = 0;
  let registrationConfirmedGeneration = -1;
  const clearRecoveryTimer = () => {
    if (recoveryTimer !== null) {
      window.clearTimeout(recoveryTimer);
      recoveryTimer = null;
    }
  };
  const clearValidationRetry = () => {
    if (validationRetryTimer !== null) {
      window.clearTimeout(validationRetryTimer);
      validationRetryTimer = null;
    }
  };
  const clearValidationTimeout = () => {
    if (validationTimeoutTimer !== null) {
      window.clearTimeout(validationTimeoutTimer);
      validationTimeoutTimer = null;
    }
  };
  const finish = () => {
    const completedRecovery = recoveryStarted;
    recoveryStarted = false;
    options.setPending(false);
    clearRecoveryTimer();
    return completedRecovery;
  };
  const showRecoveryFailure = () => {
    if (disposed || !options.browserPageExists()) {
      return;
    }
    recoveryTimer = null;
    options.setPending(false);
    options.onRecoveryFailed();
  };
  const watchRecovery = () => {
    clearRecoveryTimer();
    recoveryTimer = window.setTimeout(showRecoveryFailure, BROWSER_GUEST_RECOVERY_TIMEOUT_MS);
  };
  const replaceGuestWithTimeout = () => {
    let timeoutTimer = null;
    const deadline = new Promise((_resolve, reject) => {
      timeoutTimer = window.setTimeout(() => {
        reject(new Error("Guest replacement timed out"));
      }, BROWSER_GUEST_RECOVERY_TIMEOUT_MS);
    });
    const replacement = Promise.resolve().then(() => options.replaceGuest());
    return Promise.race([replacement, deadline]).finally(() => {
      if (timeoutTimer !== null) {
        window.clearTimeout(timeoutTimer);
      }
    });
  };
  const replaceGuest = () => {
    if (disposed || replacementRequested || !options.browserPageExists()) {
      return;
    }
    replacementRequired = true;
    replacementRequested = true;
    lifecycleGeneration += 1;
    validationFailureCount = 0;
    options.setPending(true);
    clearRecoveryTimer();
    clearValidationRetry();
    void replaceGuestWithTimeout().then(
      () => {
        replacementRequired = false;
        if (disposed || !options.browserPageExists()) {
          options.setPending(false);
          return;
        }
        options.onReplacementReady();
      },
      (error) => {
        options.setPending(false);
        replacementRequested = false;
        if (disposed || !options.browserPageExists()) {
          return;
        }
        console.warn("[browser] guest replacement failed:", error);
        options.onRecoveryFailed();
      }
    );
  };
  const recoverRenderer = () => {
    if (disposed || recoveryStarted || !options.isCurrentWebview() || !options.browserPageExists()) {
      return;
    }
    recoveryStarted = true;
    lifecycleGeneration += 1;
    validationFailureCount = 0;
    options.setPending(true);
    clearValidationRetry();
    watchRecovery();
    try {
      options.webview.reload();
    } catch {
      replaceGuest();
    }
  };
  const scheduleValidationRetry = () => {
    clearValidationRetry();
    validationRetryTimer = window.setTimeout(() => {
      validationRetryTimer = null;
      validateAfterResume();
    }, BROWSER_GUEST_VALIDATION_RETRY_DELAY_MS);
  };
  const validateRegistrationWithTimeout = () => {
    const deadline = new Promise((_resolve, reject) => {
      validationTimeoutTimer = window.setTimeout(() => {
        validationTimeoutTimer = null;
        reject(new Error("Guest registration validation timed out"));
      }, BROWSER_GUEST_VALIDATION_TIMEOUT_MS);
    });
    return Promise.race([options.validateRegistration(), deadline]).finally(clearValidationTimeout);
  };
  function validateAfterResume() {
    if (disposed || recoveryStarted || validationInFlight || options.isPending() || !options.shouldValidate() || !options.isCurrentWebview()) {
      return;
    }
    validationInFlight = true;
    clearValidationRetry();
    const validationGeneration = lifecycleGeneration;
    let retryValidation = false;
    void validateRegistrationWithTimeout().then((registered) => {
      if (validationGeneration !== lifecycleGeneration) {
        return;
      }
      if (registered === true) {
        validationFailureCount = 0;
        options.onRecoverySucceeded();
      } else if (registered === false) {
        validationFailureCount = 0;
        if (!options.isPending() && options.isCurrentWebview()) {
          replaceGuest();
        }
      } else if (!disposed && !options.isPending() && options.browserPageExists() && options.shouldValidate() && options.isCurrentWebview()) {
        validationFailureCount += 1;
        if (validationFailureCount >= BROWSER_GUEST_VALIDATION_MAX_ATTEMPTS) {
          validationFailureCount = 0;
          options.onRecoveryFailed();
        } else {
          retryValidation = true;
        }
      }
    }).catch((error) => {
      if (validationGeneration !== lifecycleGeneration) {
        return;
      }
      console.warn("[browser] guest registration validation failed:", error);
      if (disposed || options.isPending() || !options.browserPageExists() || !options.shouldValidate() || !options.isCurrentWebview()) {
        return;
      }
      validationFailureCount += 1;
      if (validationFailureCount >= BROWSER_GUEST_VALIDATION_MAX_ATTEMPTS) {
        validationFailureCount = 0;
        options.onRecoveryFailed();
        return;
      }
      retryValidation = true;
    }).finally(() => {
      validationInFlight = false;
      if (validationGeneration !== lifecycleGeneration && registrationConfirmedGeneration !== lifecycleGeneration && !disposed && !options.isPending() && options.shouldValidate() && options.isCurrentWebview()) {
        validateAfterResume();
      } else if (retryValidation) {
        scheduleValidationRetry();
      }
    });
  }
  if (options.isPending()) {
    watchRecovery();
  }
  return {
    confirmRegistration: () => {
      lifecycleGeneration += 1;
      registrationConfirmedGeneration = lifecycleGeneration;
      validationFailureCount = 0;
      clearValidationRetry();
    },
    dispose: () => {
      disposed = true;
      lifecycleGeneration += 1;
      clearRecoveryTimer();
      clearValidationRetry();
      clearValidationTimeout();
    },
    isDisposed: () => disposed,
    finish,
    recoverRenderer,
    retryRecovery: () => {
      if (disposed || options.isPending() || !options.isCurrentWebview() || !options.browserPageExists()) {
        return;
      }
      recoveryStarted = false;
      options.setPending(false);
      if (replacementRequired) {
        recoveryStarted = true;
        replaceGuest();
        return;
      }
      recoverRenderer();
    },
    validateAfterResume
  };
}

// src/renderer/components/browser-pane/describe-page/browser-page-load-error.ts
function browserPageExists(tabId) {
  return Object.values(useBrowserStore.getState().pagesByScope).some(
    (pages) => pages.some((page) => page.id === tabId)
  );
}

// src/renderer/components/browser-pane/host-guest/browser-page-webview-guest-session.ts
function createBrowserPageWebviewGuestSession({
  webview,
  browserTabId,
  scopeId,
  sessionProfileId,
  webviewRef,
  isPaintableRef,
  guestRecoveryPendingRef,
  browserTabUrlRef,
  addressBarValueRef,
  activeLoadFailureRef,
  recoveryNavigationValidationRef,
  keepAddressBarFocusRef,
  paneZoomLevelRef,
  onUpdatePageStateRef,
  setGuestRecoveryGeneration,
  setBrowserZoomPercent,
  focusAddressBarNow,
  syncNavigationState
}) {
  let registrationInFlight = null;
  const readWebContentsId = () => {
    try {
      return webview.getWebContentsId();
    } catch {
      return null;
    }
  };
  const ownsGuest = (webContentsId) => webContentsId !== null && !guestRecovery.isDisposed() && webviewRef.current === webview && webviewRegistry.get(browserTabId) === webview && readWebContentsId() === webContentsId;
  const registerGuest = (webContentsId) => {
    if (webContentsId === null || !ownsGuest(webContentsId)) {
      return Promise.resolve(null);
    }
    if (registrationInFlight?.webContentsId === webContentsId) {
      return registrationInFlight.promise;
    }
    const promise = window.browserAPI.registerGuest({
      browserPageId: browserTabId,
      scopeId,
      sessionProfileId,
      webContentsId
    }).then((registered) => {
      if (!ownsGuest(webContentsId)) {
        return null;
      }
      if (registered) {
        registeredWebContentsIds.set(browserTabId, webContentsId);
        return true;
      }
      return null;
    }).catch(() => null).finally(() => {
      if (registrationInFlight?.promise === promise) {
        registrationInFlight = null;
      }
    });
    registrationInFlight = { webContentsId, promise };
    return promise;
  };
  const clearGuestRecoveryError = () => {
    if (activeLoadFailureRef.current?.code !== BROWSER_GUEST_RECOVERY_ERROR_CODE) {
      return;
    }
    activeLoadFailureRef.current = null;
    onUpdatePageStateRef.current(browserTabId, { loading: false, loadError: null });
  };
  const guestRecovery = createBrowserPageGuestRecovery({
    webview,
    browserPageExists: () => browserPageExists(browserTabId),
    shouldValidate: () => isPaintableRef.current,
    isCurrentWebview: () => webviewRef.current === webview,
    isPending: () => guestRecoveryPendingRef.current,
    setPending: (pending) => {
      guestRecoveryPendingRef.current = pending;
    },
    validateRegistration: async () => {
      if (!webview.isConnected) {
        return false;
      }
      let webContentsId;
      try {
        webContentsId = webview.getWebContentsId();
      } catch {
        return null;
      }
      if (registeredWebContentsIds.get(browserTabId) !== webContentsId) {
        return registerGuest(webContentsId);
      }
      const registered = await window.browserAPI.isGuestRegistered({
        browserPageId: browserTabId,
        webContentsId
      });
      if (!ownsGuest(webContentsId)) {
        return null;
      }
      if (registered) {
        return true;
      }
      const repaired = await window.browserAPI.repairGuestRegistration({
        browserPageId: browserTabId,
        scopeId,
        sessionProfileId,
        webContentsId
      });
      return ownsGuest(webContentsId) ? repaired : null;
    },
    replaceGuest: () => replacePersistentWebview(browserTabId),
    onReplacementReady: () => setGuestRecoveryGeneration((generation) => generation + 1),
    onRecoveryFailed: () => {
      const loadError = {
        code: BROWSER_GUEST_RECOVERY_ERROR_CODE,
        description: translate(
          "browser.guestRecovery.failed",
          "The browser page stopped unexpectedly. Retry to restore it."
        ),
        validatedUrl: redactKagiSessionToken(
          browserTabUrlRef.current || addressBarValueRef.current || "about:blank"
        )
      };
      activeLoadFailureRef.current = loadError;
      onUpdatePageStateRef.current(browserTabId, { loading: false, loadError });
    },
    onRecoverySucceeded: clearGuestRecoveryError
  });
  const handleDidAttach = () => {
    const webContentsId = readWebContentsId();
    void registerGuest(webContentsId).then((registered) => {
      if (!ownsGuest(webContentsId)) {
        return;
      }
      if (registered === true) {
        guestRecovery.confirmRegistration();
      }
    });
  };
  const handleDomReady = () => {
    const validateRecoveryAfterNavigation = recoveryNavigationValidationRef.current?.committed === true;
    if (validateRecoveryAfterNavigation) {
      recoveryNavigationValidationRef.current = null;
    }
    let liveWebContentsId = null;
    try {
      liveWebContentsId = webview.getWebContentsId();
    } catch {
    }
    const needsGuestRegistration = liveWebContentsId === null || registeredWebContentsIds.get(browserTabId) !== liveWebContentsId;
    if (needsGuestRegistration) {
      void registerGuest(liveWebContentsId).then((registered) => {
        if (!ownsGuest(liveWebContentsId)) {
          return;
        }
        const completedRecovery = guestRecovery.finish();
        if (registered === true) {
          guestRecovery.confirmRegistration();
          clearGuestRecoveryError();
        }
        if (registered === null || completedRecovery || validateRecoveryAfterNavigation) {
          guestRecovery.validateAfterResume();
        }
      });
    } else {
      const completedRecovery = guestRecovery.finish();
      if (completedRecovery || validateRecoveryAfterNavigation) {
        guestRecovery.validateAfterResume();
      }
    }
    syncNavigationState(webview);
    if (keepAddressBarFocusRef.current) {
      focusAddressBarNow();
    }
    const appliedLevel = setBrowserPageZoomLevel(webview, paneZoomLevelRef.current);
    if (appliedLevel !== null) {
      setBrowserZoomPercent(browserPageZoomLevelToPercent(appliedLevel));
    }
  };
  const handleGuestDestroyed = () => {
    if (webview.isConnected) {
      guestRecovery.recoverRenderer();
    }
  };
  return {
    guestRecovery,
    handleDidAttach,
    handleDomReady,
    handleGuestDestroyed
  };
}

// src/renderer/components/browser-pane/navigate/browser-webview-load-failure.ts
function resolveBrowserWebviewLoadFailure(event, options = {}) {
  if (event.isMainFrame === false || event.errorCode === -3) {
    return null;
  }
  const fallbackUrl = typeof options.fallbackUrl === "function" ? options.fallbackUrl() : options.fallbackUrl;
  return {
    code: event.errorCode ?? -1,
    description: event.errorDescription || "Unknown load failure",
    validatedUrl: redactKagiSessionToken(event.validatedURL || fallbackUrl || "about:blank")
  };
}

// src/renderer/components/browser-pane/host-guest/browser-page-webview-loading-handlers.ts
function createBrowserPageWebviewLoadingHandlers({
  webview,
  browserTabId,
  faviconUrlRef,
  browserTabUrlRef,
  addressBarValueRef,
  addressBarInputRef,
  activeLoadFailureRef,
  lastKnownWebviewUrlRef,
  trackNextLoadingEventRef,
  keepAddressBarFocusRef,
  recoveryNavigationValidationRef,
  onUpdatePageStateRef,
  onSetUrlRef,
  setAddressBarValue,
  focusAddressBarNow
}) {
  const handleDidStartLoading = () => {
    if (!trackNextLoadingEventRef.current) {
      return;
    }
    onUpdatePageStateRef.current(browserTabId, {
      loading: true
    });
  };
  const handleDidStopLoading = () => {
    releaseBrowserPageMount(browserTabId);
    const currentUrl = webview.getURL() || webview.src || "about:blank";
    const browserModelUrl = redactKagiSessionToken(currentUrl);
    const activeLoadFailure = activeLoadFailureRef.current;
    if (isChromiumErrorPage(currentUrl)) {
      trackNextLoadingEventRef.current = false;
      const synthesizedFailure = {
        code: -1,
        description: translate(
          "auto.components.browser.pane.BrowserPane.e48569ac6d",
          "This site could not be reached."
        ),
        validatedUrl: redactKagiSessionToken(
          browserTabUrlRef.current || addressBarValueRef.current || "about:blank"
        )
      };
      activeLoadFailureRef.current = synthesizedFailure;
      onUpdatePageStateRef.current(browserTabId, {
        loading: false,
        loadError: synthesizedFailure
      });
      return;
    }
    if (activeLoadFailure?.code === BROWSER_GUEST_RECOVERY_ERROR_CODE) {
      trackNextLoadingEventRef.current = false;
      onUpdatePageStateRef.current(browserTabId, {
        loading: false,
        title: getBrowserDisplayTitle(webview.getTitle(), browserModelUrl),
        faviconUrl: faviconUrlRef.current,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward(),
        loadError: activeLoadFailure
      });
      return;
    } else if (activeLoadFailure) {
      const normalizedAttemptedUrl = normalizeBrowserNavigationUrl(activeLoadFailure.validatedUrl) ?? activeLoadFailure.validatedUrl;
      const normalizedCurrentUrl = normalizeBrowserNavigationUrl(browserModelUrl) ?? browserModelUrl;
      if (normalizedAttemptedUrl === normalizedCurrentUrl) {
        trackNextLoadingEventRef.current = false;
        onUpdatePageStateRef.current(browserTabId, {
          loading: false,
          title: getBrowserDisplayTitle(webview.getTitle(), browserModelUrl),
          faviconUrl: faviconUrlRef.current,
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward(),
          loadError: activeLoadFailure
        });
        return;
      }
    }
    trackNextLoadingEventRef.current = false;
    activeLoadFailureRef.current = null;
    lastKnownWebviewUrlRef.current = normalizeBrowserNavigationUrl(browserModelUrl) ?? browserModelUrl;
    rememberLiveBrowserUrl(browserTabId, browserModelUrl);
    if (document.activeElement !== addressBarInputRef.current) {
      setAddressBarValue(toDisplayUrl(browserModelUrl));
    }
    onSetUrlRef.current(browserTabId, browserModelUrl);
    if (keepAddressBarFocusRef.current && currentUrl === ORCA_BROWSER_BLANK_URL) {
      focusAddressBarNow();
    } else {
      keepAddressBarFocusRef.current = false;
    }
    onUpdatePageStateRef.current(browserTabId, {
      loading: false,
      title: getBrowserDisplayTitle(webview.getTitle(), browserModelUrl),
      faviconUrl: faviconUrlRef.current,
      canGoBack: webview.canGoBack(),
      canGoForward: webview.canGoForward(),
      loadError: null
    });
  };
  const handleFailLoad = (event) => {
    const loadError = resolveBrowserWebviewLoadFailure(event);
    if (!loadError) {
      return;
    }
    trackNextLoadingEventRef.current = false;
    const pendingRecoveryNavigation = recoveryNavigationValidationRef.current;
    if (pendingRecoveryNavigation?.started) {
      recoveryNavigationValidationRef.current = null;
    }
    activeLoadFailureRef.current = loadError;
    onUpdatePageStateRef.current(browserTabId, {
      loading: false,
      loadError
    });
  };
  return {
    handleDidStartLoading,
    handleDidStopLoading,
    handleFailLoad
  };
}

// src/renderer/components/browser-pane/host-guest/browser-page-webview-navigation-handlers.ts
function createBrowserPageWebviewNavigationHandlers({
  webview,
  browserTabId,
  browserTabUrl,
  recoveryNavigationValidationRef,
  activeLoadFailureRef,
  lastKnownWebviewUrlRef,
  addressBarInputRef,
  onSetUrlRef,
  onUpdatePageStateRef,
  addBrowserHistoryEntryRef,
  faviconUrlRef,
  setAddressBarValue
}) {
  const clearFaviconIfOriginChanges = (event) => {
    if (!event.isMainFrame || event.isInPlace || !event.url) {
      return;
    }
    const browserStartedUrl = redactKagiSessionToken(event.url);
    const startedUrl = normalizeBrowserNavigationUrl(browserStartedUrl) ?? browserStartedUrl;
    let committedUrl = null;
    try {
      committedUrl = webview.getURL() || null;
    } catch {
    }
    if (browserNavigationLeavesFaviconOrigin(committedUrl, startedUrl)) {
      faviconUrlRef.current = null;
      onUpdatePageStateRef.current(browserTabId, { faviconUrl: null });
    }
  };
  const handleDidStartNavigation = (event) => {
    if (!event.isMainFrame || event.isInPlace || !event.url) {
      return;
    }
    const pendingRecoveryNavigation = recoveryNavigationValidationRef.current;
    const browserStartedUrl = redactKagiSessionToken(event.url);
    const startedUrl = normalizeBrowserNavigationUrl(browserStartedUrl) ?? browserStartedUrl;
    if (pendingRecoveryNavigation?.targetUrl === startedUrl) {
      pendingRecoveryNavigation.started = true;
    }
    clearFaviconIfOriginChanges(event);
  };
  const handleDidRedirectNavigation = (event) => {
    clearFaviconIfOriginChanges(event);
  };
  const handleDidNavigate = (event, persistUrl = true, preserveLoadError = false) => {
    if (event.isMainFrame === false) {
      return;
    }
    const currentUrl = event.url ?? webview.getURL() ?? webview.src ?? "about:blank";
    if (isChromiumErrorPage(currentUrl)) {
      return;
    }
    const browserModelUrl = redactKagiSessionToken(currentUrl);
    const normalizedBrowserModelUrl = normalizeBrowserNavigationUrl(browserModelUrl) ?? browserModelUrl;
    lastKnownWebviewUrlRef.current = normalizedBrowserModelUrl;
    rememberLiveBrowserUrl(browserTabId, browserModelUrl);
    if (document.activeElement !== addressBarInputRef.current) {
      setAddressBarValue(toDisplayUrl(browserModelUrl));
    }
    if (persistUrl) {
      onSetUrlRef.current(browserTabId, browserModelUrl, { preserveLoadError });
    }
    onUpdatePageStateRef.current(browserTabId, {
      title: webview.getTitle() || browserModelUrl,
      canGoBack: webview.canGoBack(),
      canGoForward: webview.canGoForward()
    });
  };
  const handleFullDidNavigate = (event) => {
    const pendingRecoveryNavigation = recoveryNavigationValidationRef.current;
    if (event.isMainFrame !== false && pendingRecoveryNavigation?.started) {
      pendingRecoveryNavigation.committed = true;
    }
    const preserveRecoveryError = activeLoadFailureRef.current?.code === BROWSER_GUEST_RECOVERY_ERROR_CODE;
    handleDidNavigate(event, true, preserveRecoveryError);
  };
  const handleDidNavigateInPage = (event) => {
    const preserveRecoveryError = activeLoadFailureRef.current?.code === BROWSER_GUEST_RECOVERY_ERROR_CODE;
    handleDidNavigate(event, !preserveRecoveryError);
  };
  const handleTitleUpdate = (event) => {
    try {
      const currentUrl = webview.getURL() || browserTabUrl;
      const browserModelUrl = redactKagiSessionToken(currentUrl);
      const title = getBrowserDisplayTitle(event.title, browserModelUrl);
      onUpdatePageStateRef.current(browserTabId, { title });
      addBrowserHistoryEntryRef.current(browserModelUrl, title, faviconUrlRef.current);
    } catch {
    }
  };
  const handleFaviconUpdate = (event) => {
    faviconUrlRef.current = pickDisplayableFaviconUrl(event.favicons);
    onUpdatePageStateRef.current(browserTabId, { faviconUrl: faviconUrlRef.current });
  };
  return {
    handleDidStartNavigation,
    handleDidRedirectNavigation,
    handleFullDidNavigate,
    handleDidNavigateInPage,
    handleTitleUpdate,
    handleFaviconUpdate
  };
}

// src/renderer/components/browser-pane/host-guest/bind-browser-page-webview-listeners.ts
function bindBrowserPageWebviewListeners({
  container,
  webview,
  needsInitialNavigation,
  onContainerDragOver,
  onContainerDrop,
  dismissAddressBarSuggestions,
  args
}) {
  const {
    browserTabId,
    browserTabUrl,
    scopeId,
    sessionProfileId,
    webviewRef,
    isPaintableRef,
    guestRecoveryPendingRef,
    browserTabUrlRef,
    addressBarValueRef,
    activeLoadFailureRef,
    recoveryNavigationValidationRef,
    keepAddressBarFocusRef,
    paneZoomLevelRef,
    onUpdatePageStateRef,
    setGuestRecoveryGeneration,
    setBrowserZoomPercent,
    focusAddressBarNow,
    syncNavigationState,
    faviconUrlRef,
    addressBarInputRef,
    lastKnownWebviewUrlRef,
    trackNextLoadingEventRef,
    onSetUrlRef,
    setAddressBarValue,
    addBrowserHistoryEntryRef,
    initialBrowserUrlRef,
    validateVisibleGuestRegistrationRef,
    retryGuestRecoveryRef,
    setFindOpen
  } = args;
  const { guestRecovery, handleDidAttach, handleDomReady, handleGuestDestroyed } = createBrowserPageWebviewGuestSession({
    webview,
    browserTabId,
    scopeId,
    sessionProfileId,
    webviewRef,
    isPaintableRef,
    guestRecoveryPendingRef,
    browserTabUrlRef,
    addressBarValueRef,
    activeLoadFailureRef,
    recoveryNavigationValidationRef,
    keepAddressBarFocusRef,
    paneZoomLevelRef,
    onUpdatePageStateRef,
    setGuestRecoveryGeneration,
    setBrowserZoomPercent,
    focusAddressBarNow,
    syncNavigationState
  });
  const { handleDidStartLoading, handleDidStopLoading, handleFailLoad } = createBrowserPageWebviewLoadingHandlers({
    webview,
    browserTabId,
    faviconUrlRef,
    browserTabUrlRef,
    addressBarValueRef,
    addressBarInputRef,
    activeLoadFailureRef,
    lastKnownWebviewUrlRef,
    trackNextLoadingEventRef,
    keepAddressBarFocusRef,
    recoveryNavigationValidationRef,
    onUpdatePageStateRef,
    onSetUrlRef,
    setAddressBarValue,
    focusAddressBarNow
  });
  const {
    handleDidStartNavigation,
    handleDidRedirectNavigation,
    handleFullDidNavigate,
    handleDidNavigateInPage,
    handleTitleUpdate,
    handleFaviconUpdate
  } = createBrowserPageWebviewNavigationHandlers({
    webview,
    browserTabId,
    browserTabUrl,
    recoveryNavigationValidationRef,
    activeLoadFailureRef,
    lastKnownWebviewUrlRef,
    addressBarInputRef,
    onSetUrlRef,
    onUpdatePageStateRef,
    addBrowserHistoryEntryRef,
    faviconUrlRef,
    setAddressBarValue
  });
  const unsubscribeSystemResumed2 = subscribeBrowserSystemResume(guestRecovery.validateAfterResume);
  validateVisibleGuestRegistrationRef.current = guestRecovery.validateAfterResume;
  retryGuestRecoveryRef.current = guestRecovery.retryRecovery;
  webview.addEventListener("did-attach", handleDidAttach);
  webview.addEventListener("dom-ready", handleDomReady);
  webview.addEventListener("render-process-gone", guestRecovery.recoverRenderer);
  webview.addEventListener("destroyed", handleGuestDestroyed);
  webview.addEventListener("focus", dismissAddressBarSuggestions);
  webview.addEventListener("did-start-loading", handleDidStartLoading);
  webview.addEventListener("did-start-navigation", handleDidStartNavigation);
  webview.addEventListener("did-redirect-navigation", handleDidRedirectNavigation);
  webview.addEventListener("did-stop-loading", handleDidStopLoading);
  const handleFindCloseOnNavigate = () => {
    setFindOpen(false);
  };
  webview.addEventListener("did-navigate", handleFullDidNavigate);
  webview.addEventListener("did-navigate", handleFindCloseOnNavigate);
  webview.addEventListener("did-navigate-in-page", handleDidNavigateInPage);
  webview.addEventListener("page-title-updated", handleTitleUpdate);
  webview.addEventListener("page-favicon-updated", handleFaviconUpdate);
  webview.addEventListener("did-fail-load", handleFailLoad);
  if (needsInitialNavigation) {
    const initialUrl = normalizeBrowserNavigationUrl(initialBrowserUrlRef.current) ?? ORCA_BROWSER_BLANK_URL;
    trackNextLoadingEventRef.current = initialUrl !== ORCA_BROWSER_BLANK_URL;
    lastKnownWebviewUrlRef.current = initialUrl;
    webview.src = initialUrl;
  } else if (isPaintableRef.current) {
    if (isBrowserPageRendererRecoveryPending(browserTabId)) {
      guestRecovery.recoverRenderer();
    } else {
      guestRecovery.validateAfterResume();
    }
  }
  return () => {
    webview.removeEventListener("did-attach", handleDidAttach);
    webview.removeEventListener("dom-ready", handleDomReady);
    webview.removeEventListener("render-process-gone", guestRecovery.recoverRenderer);
    webview.removeEventListener("destroyed", handleGuestDestroyed);
    webview.removeEventListener("focus", dismissAddressBarSuggestions);
    webview.removeEventListener("did-start-loading", handleDidStartLoading);
    webview.removeEventListener("did-start-navigation", handleDidStartNavigation);
    webview.removeEventListener("did-redirect-navigation", handleDidRedirectNavigation);
    webview.removeEventListener("did-stop-loading", handleDidStopLoading);
    webview.removeEventListener("did-navigate", handleFullDidNavigate);
    webview.removeEventListener("did-navigate", handleFindCloseOnNavigate);
    webview.removeEventListener("did-navigate-in-page", handleDidNavigateInPage);
    webview.removeEventListener("page-title-updated", handleTitleUpdate);
    webview.removeEventListener("page-favicon-updated", handleFaviconUpdate);
    webview.removeEventListener("did-fail-load", handleFailLoad);
    container.removeEventListener("dragover", onContainerDragOver);
    container.removeEventListener("drop", onContainerDrop);
    unsubscribeSystemResumed2();
    guestRecovery.dispose();
    if (validateVisibleGuestRegistrationRef.current === guestRecovery.validateAfterResume) {
      validateVisibleGuestRegistrationRef.current = () => {
      };
    }
    if (retryGuestRecoveryRef.current === guestRecovery.retryRecovery) {
      retryGuestRecoveryRef.current = () => {
      };
    }
    if (webviewRef.current === webview) {
      webviewRef.current = null;
    }
    moveFocusToRendererBeforeWebviewDetach(webview);
    parkBrowserPageViewport(browserTabId);
  };
}

// src/renderer/components/browser-pane/host-guest/attach-browser-page-webview.ts
function attachBrowserPageWebview(args) {
  const {
    browserTabId,
    workspaceId,
    webviewPartition,
    isActive,
    isPaintable,
    inputLockedRef,
    webviewRef,
    handleInternalFileDragOverRef,
    handleInternalFileDropRef,
    dismissAddressBarSuggestionsRef,
    browserTabUrlRef,
    lastKnownWebviewUrlRef,
    syncNavigationState
  } = args;
  const viewport = ensureBrowserPageViewport(browserTabId, workspaceId);
  let container = viewport?.container ?? null;
  let webviewContainer = viewport?.content ?? null;
  if (!container || !webviewContainer) {
    return;
  }
  const ensuredWebview = ensureBrowserPageWebview({
    browserTabId,
    container: webviewContainer,
    inputLocked: inputLockedRef.current,
    webviewPartition,
    resolveContainer: () => ensureBrowserPageViewport(browserTabId, workspaceId)?.content ?? null
  });
  if (!ensuredWebview) {
    return;
  }
  container = ensureBrowserPageViewport(browserTabId, workspaceId)?.container ?? null;
  webviewContainer = ensuredWebview.container;
  if (!container || !webviewContainer) {
    return;
  }
  const webview = ensuredWebview.webview;
  const needsInitialNavigation = ensuredWebview.created;
  seedLiveBrowserUrl(browserTabId, redactKagiSessionToken(browserTabUrlRef.current));
  if (!ensuredWebview.created) {
    syncNavigationState(webview);
    lastKnownWebviewUrlRef.current = normalizeBrowserNavigationUrl(browserTabUrlRef.current) ?? null;
  }
  webviewRef.current = webview;
  applyBrowserPageViewportLayout(browserTabId, { paintable: isPaintable, active: isActive });
  const onContainerDragOver = (event) => {
    handleInternalFileDragOverRef.current(event);
  };
  const onContainerDrop = (event) => {
    handleInternalFileDropRef.current(event);
  };
  container.addEventListener("dragover", onContainerDragOver);
  container.addEventListener("drop", onContainerDrop);
  const dismissAddressBarSuggestions = () => {
    dismissAddressBarSuggestionsRef.current?.();
  };
  return bindBrowserPageWebviewListeners({
    container,
    webview,
    needsInitialNavigation,
    onContainerDragOver,
    onContainerDrop,
    dismissAddressBarSuggestions,
    args
  });
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-webview-lifecycle.ts
function useBrowserPageWebviewLifecycle({
  browserTabId,
  browserTabUrl,
  browserTabLoading,
  browserTabLoadError,
  workspaceId,
  scopeId,
  sessionProfileId,
  webviewPartition,
  isActive,
  isPaintable,
  slotViewport,
  addressBarInputRef,
  addressBarValueRef,
  browserTabUrlRef,
  keepAddressBarFocusRef,
  handleInternalFileDragOverRef,
  handleInternalFileDropRef,
  dismissAddressBarSuggestionsRef,
  onUpdatePageState,
  onSetUrl,
  setAddressBarValue,
  setFindOpen,
  focusAddressBarNow,
  focusWebviewNow,
  paneZoomLevelRef,
  setBrowserZoomPercent,
  inputLocked,
  faviconUrl,
  webviewRef,
  lastKnownWebviewUrlRef,
  trackNextLoadingEventRef,
  recoveryNavigationValidationRef,
  activeLoadFailureRef,
  retryGuestRecoveryRef,
  onUpdatePageStateRef,
  onSetUrlRef
}) {
  const [guestRecoveryGeneration, setGuestRecoveryGeneration] = useState(0);
  const guestRecoveryPendingRef = useRef(false);
  const validateVisibleGuestRegistrationRef = useRef(() => {
  });
  const wasPaintableForGuestValidationRef = useRef(isPaintable);
  const browserTabLoadingRef = useRef(browserTabLoading);
  const inputLockedRef = useRef(inputLocked);
  const faviconUrlRef = useRef(faviconUrl);
  const initialBrowserUrlRef = useRef(browserTabUrl);
  const addBrowserHistoryEntry = useBrowserStore((s) => s.addBrowserHistoryEntry);
  const addBrowserHistoryEntryRef = useRef(addBrowserHistoryEntry);
  const isPaintableRef = useRef(isPaintable);
  useLayoutEffect(() => {
    browserTabLoadingRef.current = browserTabLoading;
    inputLockedRef.current = inputLocked;
    isPaintableRef.current = isPaintable;
  }, [browserTabLoading, inputLocked, isPaintable]);
  useLayoutEffect(() => {
    const webview = webviewRef.current;
    if (webview) {
      setBrowserPageWebviewInputLock(webview, inputLocked);
    }
  }, [inputLocked, webviewRef]);
  useEffect2(() => {
    initialBrowserUrlRef.current = browserTabUrl;
  }, [browserTabId, browserTabUrl]);
  useEffect2(() => {
    browserTabUrlRef.current = browserTabUrl;
  }, [browserTabUrl, browserTabUrlRef]);
  useEffect2(() => {
    activeLoadFailureRef.current = browserTabLoadError;
  }, [activeLoadFailureRef, browserTabLoadError]);
  useEffect2(() => {
    onUpdatePageStateRef.current = onUpdatePageState;
    onSetUrlRef.current = onSetUrl;
    addBrowserHistoryEntryRef.current = addBrowserHistoryEntry;
  }, [onSetUrl, onUpdatePageState, addBrowserHistoryEntry, onSetUrlRef, onUpdatePageStateRef]);
  const syncNavigationState = useCallback2(
    (webview) => {
      try {
        const loading = browserTabLoadingRef.current ? webview.isLoading() : void 0;
        onUpdatePageStateRef.current(browserTabId, {
          title: getBrowserDisplayTitle(
            webview.getTitle(),
            webview.getURL() || browserTabUrlRef.current
          ),
          ...loading === void 0 ? {} : { loading },
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward()
        });
      } catch {
      }
    },
    [browserTabId, browserTabUrlRef, onUpdatePageStateRef]
  );
  useEffect2(() => {
    return attachBrowserPageWebview({
      browserTabId,
      browserTabUrl,
      workspaceId,
      scopeId,
      sessionProfileId,
      webviewPartition,
      isActive,
      isPaintable,
      inputLockedRef,
      webviewRef,
      handleInternalFileDragOverRef,
      handleInternalFileDropRef,
      dismissAddressBarSuggestionsRef,
      isPaintableRef,
      guestRecoveryPendingRef,
      browserTabUrlRef,
      addressBarValueRef,
      activeLoadFailureRef,
      recoveryNavigationValidationRef,
      keepAddressBarFocusRef,
      paneZoomLevelRef,
      onUpdatePageStateRef,
      setGuestRecoveryGeneration,
      setBrowserZoomPercent,
      focusAddressBarNow,
      syncNavigationState,
      faviconUrlRef,
      addressBarInputRef,
      lastKnownWebviewUrlRef,
      trackNextLoadingEventRef,
      onSetUrlRef,
      setAddressBarValue,
      addBrowserHistoryEntryRef,
      initialBrowserUrlRef,
      validateVisibleGuestRegistrationRef,
      retryGuestRecoveryRef,
      setFindOpen
    });
  }, [
    browserTabId,
    guestRecoveryGeneration,
    workspaceId,
    slotViewport,
    webviewPartition,
    scopeId,
    focusAddressBarNow,
    focusWebviewNow,
    syncNavigationState
  ]);
  useEffect2(() => {
    const becamePaintable = isPaintable && !wasPaintableForGuestValidationRef.current;
    wasPaintableForGuestValidationRef.current = isPaintable;
    if (becamePaintable) {
      validateVisibleGuestRegistrationRef.current();
    }
  }, [isPaintable]);
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-webview-partition.ts
function useBrowserPageWebviewPartition(_args) {
  return ORCA_BROWSER_PARTITION;
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-pane.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
function BrowserPagePane({
  browserTab,
  workspaceId,
  scopeId,
  sessionProfileId,
  sessionPartition,
  isActive,
  inputLocked,
  onUpdatePageState,
  onSetUrl
}) {
  const isPaintable = isBrowserPagePanePaintable({ isActive });
  const slotViewport = useBrowserPageSlotViewport(workspaceId);
  ensureBrowserPageViewport(browserTab.id, workspaceId);
  const webviewRef = useRef2(null);
  const addressBarInputRef = useRef2(null);
  const dismissAddressBarSuggestionsRef = useRef2(null);
  const addressBarValueRef = useRef2(toDisplayUrl(browserTab.url));
  const browserTabUrlRef = useRef2(browserTab.url);
  const lastKnownWebviewUrlRef = useRef2(null);
  const trackNextLoadingEventRef = useRef2(false);
  const recoveryNavigationValidationRef = useRef2(
    null
  );
  const activeLoadFailureRef = useRef2(browserTab.loadError);
  const retryGuestRecoveryRef = useRef2(() => {
  });
  const onUpdatePageStateRef = useRef2(onUpdatePageState);
  const onSetUrlRef = useRef2(onSetUrl);
  const keepAddressBarFocusRef = useRef2(false);
  const paneZoomLevelRef = useRef2(DEFAULT_BROWSER_PAGE_ZOOM_LEVEL);
  const handleInternalFileDragOverRef = useRef2(() => {
  });
  const handleInternalFileDropRef = useRef2(() => {
  });
  const setAddressBarValue = useCallback3((value) => {
    addressBarValueRef.current = typeof value === "function" ? value(addressBarValueRef.current) : value;
  }, []);
  const setFindOpen = useCallback3(() => {
  }, []);
  const setBrowserZoomPercent = useCallback3(() => {
  }, []);
  const focusAddressBarNow = useCallback3(() => false, []);
  const focusWebviewNow = useCallback3(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return false;
    }
    try {
      webview.focus();
      return true;
    } catch {
      return false;
    }
  }, []);
  const webviewPartition = useBrowserPageWebviewPartition({ sessionProfileId, sessionPartition });
  useLayoutEffect2(() => {
    applyBrowserPageViewportLayout(browserTab.id, { paintable: isPaintable, active: isActive });
  }, [browserTab.id, isActive, isPaintable, slotViewport]);
  useBrowserPageWebviewLifecycle({
    browserTabId: browserTab.id,
    browserTabUrl: browserTab.url,
    browserTabLoading: browserTab.loading,
    browserTabLoadError: browserTab.loadError,
    workspaceId,
    scopeId,
    sessionProfileId,
    webviewPartition,
    isActive,
    isPaintable,
    slotViewport,
    addressBarInputRef,
    addressBarValueRef,
    browserTabUrlRef,
    keepAddressBarFocusRef,
    handleInternalFileDragOverRef,
    handleInternalFileDropRef,
    dismissAddressBarSuggestionsRef,
    onUpdatePageState,
    onSetUrl,
    setAddressBarValue,
    setFindOpen,
    focusAddressBarNow,
    focusWebviewNow,
    paneZoomLevelRef,
    setBrowserZoomPercent,
    inputLocked,
    faviconUrl: browserTab.faviconUrl,
    webviewRef,
    lastKnownWebviewUrlRef,
    trackNextLoadingEventRef,
    recoveryNavigationValidationRef,
    activeLoadFailureRef,
    retryGuestRecoveryRef,
    onUpdatePageStateRef,
    onSetUrlRef
  });
  return /* @__PURE__ */ jsx3(
    "div",
    {
      "data-browser-page-pane-id": browserTab.id,
      className: cn(
        "absolute inset-0 flex min-h-0 flex-1 flex-col",
        isActive ? "pointer-events-none z-10" : isPaintable ? "pointer-events-none z-0 opacity-0" : "pointer-events-none hidden"
      ),
      inert: !isActive,
      "aria-hidden": !isActive
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/DeferredBrowserContent.tsx
import { useLayoutEffect as useLayoutEffect3, useState as useState2 } from "react";
import { Fragment, jsx as jsx4 } from "react/jsx-runtime";
function DeferredBrowserContent({
  mountEligible,
  retainMounted = true,
  children
}) {
  const [hasCommittedMount, setHasCommittedMount] = useState2(false);
  useLayoutEffect3(() => {
    if (!retainMounted) {
      setHasCommittedMount(false);
    } else if (mountEligible && !hasCommittedMount) {
      setHasCommittedMount(true);
    }
  }, [hasCommittedMount, mountEligible, retainMounted]);
  return mountEligible || retainMounted && hasCommittedMount ? /* @__PURE__ */ jsx4(Fragment, { children }) : null;
}

// src/renderer/components/browser-pane/assemble-chrome/browser-workspace-pane.tsx
import { jsx as jsx5, jsxs as jsxs2 } from "react/jsx-runtime";
function BrowserScopePane({
  scopeId,
  isActive
}) {
  const browserPages = useBrowserStore((s) => getBrowserPagesForWorkspace(s.pagesByScope, scopeId));
  const activePageId = useBrowserStore((s) => s.activePageIdByScope[scopeId] ?? null);
  const updateBrowserPageState = useBrowserStore((s) => s.updateBrowserPageState);
  const setBrowserPageUrl = useBrowserStore((s) => s.setBrowserPageUrl);
  const setActiveBrowserPage = useBrowserStore((s) => s.setActiveBrowserPage);
  const closeBrowserPage = useBrowserStore((s) => s.closeBrowserPage);
  const activeBrowserPage = browserPages.find((page) => page.id === activePageId) ?? browserPages[0] ?? null;
  const browserPageIds = useMemo(() => browserPages.map((page) => page.id), [browserPages]);
  const hasAdmittedPage = useAnyBrowserPageMountAdmission(browserPageIds);
  return /* @__PURE__ */ jsxs2("div", { className: "relative flex h-full min-h-0 flex-1 flex-col", children: [
    browserPages.length >= 2 ? /* @__PURE__ */ jsx5(
      BrowserPageStrip,
      {
        pages: browserPages,
        activePageId: activeBrowserPage?.id ?? null,
        onSelect: (pageId) => setActiveBrowserPage(scopeId, pageId),
        onClose: closeBrowserPage
      }
    ) : null,
    /* @__PURE__ */ jsx5("div", { className: "relative flex min-h-0 flex-1", children: browserPages.map((page) => /* @__PURE__ */ jsx5(
      DeferredBrowserContent,
      {
        retainMounted: isActive,
        mountEligible: isBrowserPagePanePaintable({
          isActive: isActive && page.id === activeBrowserPage?.id || hasAdmittedPage && isBrowserPageMountAdmitted(page.id)
        }),
        children: /* @__PURE__ */ jsx5(
          BrowserPagePane,
          {
            browserTab: page,
            workspaceId: scopeId,
            scopeId,
            sessionProfileId: null,
            sessionPartition: null,
            isActive: isActive && page.id === activeBrowserPage?.id,
            chromeShortcutScope: isActive && page.id === activeBrowserPage?.id ? "focused" : "inactive",
            inputLocked: false,
            onUpdatePageState: updateBrowserPageState,
            onSetUrl: setBrowserPageUrl
          }
        )
      },
      page.id
    )) })
  ] });
}
var browser_workspace_pane_default = BrowserScopePane;

// src/renderer/components/browser-pane/assemble-chrome/BrowserPaneOverlayLayer.tsx
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs3 } from "react/jsx-runtime";
var BrowserOverlaySlot = memo(function BrowserOverlaySlot2({
  scopeId
}) {
  const isActive = useBrowserStore((state) => state.paneMountByScope[scopeId]?.active === true);
  const setSlotViewportRef = useCallback4(
    (node) => {
      registerBrowserOverlaySlotViewport(scopeId, node);
    },
    [scopeId]
  );
  const anchorName = browserScopeAnchorName(scopeId);
  const style = useMemo2(
    () => ({
      position: "fixed",
      positionAnchor: anchorName,
      top: `anchor(${anchorName} top)`,
      left: `anchor(${anchorName} left)`,
      width: `anchor-size(${anchorName} width)`,
      height: `anchor-size(${anchorName} height)`,
      display: isActive ? "flex" : "none",
      pointerEvents: isActive ? "auto" : "none"
    }),
    [anchorName, isActive]
  );
  return /* @__PURE__ */ jsxs3(
    "div",
    {
      style,
      className: "min-h-0 flex-col",
      "data-orca-browser-scope-slot": scopeId,
      "data-orca-browser-anchor": anchorName,
      "data-browser-overlay-tab-id": scopeId,
      children: [
        /* @__PURE__ */ jsx6("div", { ref: setSlotViewportRef, className: "absolute inset-0 flex min-h-0 flex-col" }),
        /* @__PURE__ */ jsx6(DeferredBrowserContent, { mountEligible: isActive, children: /* @__PURE__ */ jsx6(browser_workspace_pane_default, { scopeId, isActive }) })
      ]
    }
  );
});
var BrowserPaneOverlayLayer = memo(function BrowserPaneOverlayLayer2() {
  const scopeIds = useBrowserStore(useShallow((state) => Object.keys(state.pagesByScope)));
  return /* @__PURE__ */ jsx6(Fragment2, { children: scopeIds.map((scopeId) => /* @__PURE__ */ jsx6(BrowserOverlaySlot, { scopeId }, scopeId)) });
});

// src/renderer/ipc/browser-state-ipc-bridge.ts
import { useEffect as useEffect3 } from "react";
function useBrowserStateIpcBridge() {
  useEffect3(() => {
    const api = window.browserAPI;
    if (!api) {
      return;
    }
    return api.onOpenLinkInOrcaTab(({ browserPageId, url, activate }) => {
      const scopeId = getScopeIdForPage(browserPageId);
      if (!scopeId) {
        return;
      }
      useBrowserStore.getState().createBrowserPage(scopeId, url, { activate: activate ?? true });
    });
  }, []);
  useEffect3(() => {
    const api = window.browserAPI;
    if (!api) {
      return;
    }
    const reported = /* @__PURE__ */ new Map();
    const reportActivePages = (state) => {
      for (const scopeId of reported.keys()) {
        if (state.paneMountByScope[scopeId]?.active !== true) {
          reported.delete(scopeId);
        }
      }
      for (const [scopeId, mount] of Object.entries(state.paneMountByScope)) {
        const pageId = state.activePageIdByScope[scopeId];
        if (!mount.active || !pageId || reported.get(scopeId) === pageId) {
          continue;
        }
        reported.set(scopeId, pageId);
        void api.notifyActiveTabChanged({ browserPageId: pageId });
      }
    };
    reportActivePages(useBrowserStore.getState());
    return useBrowserStore.subscribe(reportActivePages);
  }, []);
}

// src/renderer/BrowserPluginProvider.tsx
import { jsx as jsx7, jsxs as jsxs4 } from "react/jsx-runtime";
function BrowserPluginProvider(props) {
  const { host, children } = props;
  setBrowserRendererHost(host);
  useEffect4(() => {
    setBrowserRendererHost(host);
    return () => clearBrowserRendererHost(host);
  }, [host]);
  useBrowserStateIpcBridge();
  const hasBrowserApi = typeof window !== "undefined" && window.browserAPI !== void 0;
  return /* @__PURE__ */ jsxs4(BrowserRendererHostContext.Provider, { value: host, children: [
    children,
    hasBrowserApi ? /* @__PURE__ */ jsx7(BrowserPaneOverlayLayer, {}) : null
  ] });
}
export {
  BrowserPane,
  BrowserPluginProvider,
  useBrowserRendererHost
};
