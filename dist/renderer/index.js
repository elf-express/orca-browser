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
var SEARCH_ENGINE_LABELS = {
  google: "Google",
  duckduckgo: "DuckDuckGo",
  bing: "Bing",
  kagi: "Kagi"
};
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
function normalizeExternalBrowserUrl(rawUrl) {
  const normalized = normalizeBrowserNavigationUrl(rawUrl);
  if (normalized === null || normalized === ORCA_BROWSER_BLANK_URL) {
    return null;
  }
  if (normalized.startsWith("file:")) {
    return null;
  }
  return normalized;
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
function getLiveBrowserUrl(browserTabId) {
  return liveBrowserUrlByTabId.get(browserTabId) ?? null;
}
function clearLiveBrowserUrl(browserTabId) {
  liveBrowserUrlByTabId.delete(browserTabId);
}

// src/renderer/components/browser-pane/host-guest/browser-page-viewport.ts
var slotViewportRoots = /* @__PURE__ */ new Map();
var browserPageViewports = /* @__PURE__ */ new Map();
var browserPageChromeInsetHeights = /* @__PURE__ */ new Map();
var browserPageViewportPresetSizes = /* @__PURE__ */ new Map();
var MAX_REMEMBERED_BROWSER_PAGE_INSETS = 512;
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
function syncBrowserPageChromeInset(browserPageId, heightPx) {
  const insetHeight = Math.max(0, heightPx);
  browserPageChromeInsetHeights.set(browserPageId, insetHeight);
  while (browserPageChromeInsetHeights.size > MAX_REMEMBERED_BROWSER_PAGE_INSETS) {
    const oldest = browserPageChromeInsetHeights.keys().next();
    if (oldest.done) {
      break;
    }
    browserPageChromeInsetHeights.delete(oldest.value);
  }
  const viewport = browserPageViewports.get(browserPageId);
  if (!viewport) {
    return;
  }
  viewport.chromeInset.style.height = `${insetHeight}px`;
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
function nextBrowserPageZoomLevel(current, direction, resetLevel = DEFAULT_BROWSER_PAGE_ZOOM_LEVEL) {
  const rawNext = direction === "in" ? current + BROWSER_PAGE_ZOOM_STEP : direction === "out" ? current - BROWSER_PAGE_ZOOM_STEP : normalizeBrowserPageZoomLevel(resetLevel);
  return normalizeBrowserPageZoomLevel(rawNext);
}

// src/renderer/components/browser-pane/host-guest/browser-page-zoom.ts
var ORCA_BROWSER_PAGE_ZOOM_EVENT = "orca:browser-page-zoom";
function applyBrowserPageZoom(webview, direction, resetLevel = DEFAULT_BROWSER_PAGE_ZOOM_LEVEL) {
  try {
    if (!webview || webview.isDestroyed?.()) {
      return null;
    }
    const next = nextBrowserPageZoomLevel(webview.getZoomLevel(), direction, resetLevel);
    webview.setZoomLevel(next);
    return next;
  } catch {
    return null;
  }
}
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
function rememberExplicitBrowserPageZoomLevel(browserPageId, level) {
  explicitPaneZoomLevels.set(browserPageId, level);
}
function forgetExplicitBrowserPageZoomLevel(browserPageId) {
  explicitPaneZoomLevels.delete(browserPageId);
}
function addBrowserPageZoomEventListener(callback) {
  const listener = (event) => {
    if (event instanceof CustomEvent) {
      callback(event.detail);
    }
  };
  window.addEventListener(ORCA_BROWSER_PAGE_ZOOM_EVENT, listener);
  return () => window.removeEventListener(ORCA_BROWSER_PAGE_ZOOM_EVENT, listener);
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
import { useEffect as useEffect11 } from "react";

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
import { memo, useCallback as useCallback10, useMemo as useMemo6 } from "react";
import { useShallow } from "zustand/react/shallow";

// src/renderer/components/browser-pane/assemble-chrome/browser-workspace-pane.tsx
import { useMemo as useMemo5 } from "react";

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
import { useCallback as useCallback9, useEffect as useEffect9, useLayoutEffect as useLayoutEffect5, useRef as useRef9, useState as useState5 } from "react";

// src/renderer/components/browser-pane/navigate/browser-address-bar-navigation.ts
function resolveBrowserAddressBarSubmission(rawValue, options) {
  const url = normalizeBrowserNavigationUrl(rawValue, DEFAULT_SEARCH_ENGINE);
  const fileUrlUnsupported = options?.allowFileUrls === false && Boolean(url) && url.startsWith("file:");
  if (url && !fileUrlUnsupported) {
    return { status: "navigate", url };
  }
  return {
    status: "invalid",
    loadError: {
      code: 0,
      description: fileUrlUnsupported ? translate(
        "auto.components.browser.pane.BrowserPane.fileUrlUnsupported",
        'This browser tab cannot open local files. Use "Open Preview to the Side" on the file instead.'
      ) : translate(
        "auto.components.browser.pane.BrowserPane.87eb75f7d2",
        "Enter a valid http(s) or localhost URL."
      ),
      // Why: validatedUrl is persisted, so redact a possible Kagi session token first.
      validatedUrl: redactKagiSessionToken(rawValue.trim()) || "about:blank"
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
function getOpenableExternalUrl(currentUrl) {
  return normalizeExternalBrowserUrl(redactKagiSessionToken(currentUrl));
}
function retryBrowserTabLoad(webview, browserTab, onUpdatePageState) {
  if (!webview) {
    return;
  }
  const retryUrl = normalizeBrowserNavigationUrl(
    browserTab.loadError?.validatedUrl ?? browserTab.url
  );
  if (!retryUrl) {
    return;
  }
  onUpdatePageState(browserTab.id, {
    loading: true,
    title: retryUrl
  });
  webview.src = retryUrl;
}

// src/renderer/components/browser-pane/navigate/navigate-browser-page-url.ts
function navigateBrowserPageToUrl({
  url,
  browserTabId,
  activeLoadFailureRef,
  lastKnownWebviewUrlRef,
  trackNextLoadingEventRef,
  recoveryNavigationValidationRef,
  webviewRef,
  onSetUrlRef,
  onUpdatePageStateRef,
  setAddressBarValue,
  setResourceNotice,
  focusWebviewNow
}) {
  const navigateBrowserUrl = (targetUrl) => {
    const browserModelUrl = redactKagiSessionToken(targetUrl);
    const normalizedBrowserModelUrl = normalizeBrowserNavigationUrl(browserModelUrl) ?? browserModelUrl;
    const recoveryLoadError = activeLoadFailureRef.current?.code === BROWSER_GUEST_RECOVERY_ERROR_CODE ? activeLoadFailureRef.current : null;
    setAddressBarValue(toDisplayUrl(browserModelUrl));
    onSetUrlRef.current(browserTabId, browserModelUrl);
    onUpdatePageStateRef.current(browserTabId, {
      loading: true,
      loadError: recoveryLoadError,
      title: getBrowserDisplayTitle(browserModelUrl, browserModelUrl)
    });
    setResourceNotice(null);
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }
    trackNextLoadingEventRef.current = targetUrl !== ORCA_BROWSER_BLANK_URL;
    lastKnownWebviewUrlRef.current = normalizedBrowserModelUrl;
    recoveryNavigationValidationRef.current = recoveryLoadError ? { committed: false, started: false, targetUrl: normalizedBrowserModelUrl } : null;
    webview.src = targetUrl;
    if (targetUrl !== ORCA_BROWSER_BLANK_URL) {
      focusWebviewNow();
    }
  };
  navigateBrowserUrl(url);
}

// src/renderer/components/browser-pane/navigate/use-browser-page-reload-actions.ts
import { useCallback, useMemo, useState } from "react";

// src/renderer/lib/platform.ts
function getRendererPlatform() {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Mac|iPhone|iPad/i.test(userAgent)) {
    return "darwin";
  }
  if (/Windows|Win32|Win64/i.test(userAgent)) {
    return "win32";
  }
  return "linux";
}

// src/shared/browser-keybindings.ts
var BROWSER_SHORTCUT_BINDINGS = {
  "browser.back": {
    darwin: [{ mod: true, key: "[" }],
    other: [{ alt: true, key: "ArrowLeft" }]
  },
  "browser.forward": {
    darwin: [{ mod: true, key: "]" }],
    other: [{ alt: true, key: "ArrowRight" }]
  },
  "browser.reload": {
    darwin: [{ mod: true, key: "r" }],
    other: [{ mod: true, key: "r" }]
  },
  "browser.hardReload": {
    darwin: [{ mod: true, shift: true, key: "r" }],
    other: [{ mod: true, shift: true, key: "r" }]
  },
  "browser.focusAddressBar": {
    darwin: [{ mod: true, key: "l" }],
    other: [{ mod: true, key: "l" }]
  },
  "browser.find": {
    darwin: [{ mod: true, key: "f" }],
    other: [{ mod: true, key: "f" }]
  },
  "zoom.in": {
    darwin: [
      { mod: true, code: "Equal" },
      { mod: true, shift: true, key: "+" },
      { mod: true, code: "NumpadAdd" }
    ],
    other: [
      { mod: true, code: "Equal" },
      { mod: true, shift: true, key: "+" },
      { mod: true, code: "NumpadAdd" }
    ]
  },
  "zoom.out": {
    darwin: [
      { mod: true, code: "Minus" },
      { mod: true, code: "NumpadSubtract" }
    ],
    other: [
      { mod: true, code: "Minus" },
      { mod: true, code: "NumpadSubtract" }
    ]
  },
  "zoom.reset": {
    darwin: [{ mod: true, key: "0" }],
    other: [{ mod: true, key: "0" }]
  }
};
var ACTIONS = Object.keys(BROWSER_SHORTCUT_BINDINGS);
var CODE_LABELS = {
  Equal: "=",
  Minus: "-",
  NumpadAdd: "+",
  NumpadSubtract: "-"
};
function groupOf(platform) {
  return platform === "darwin" ? "darwin" : "other";
}
function bindingMatches(binding, input, group) {
  const modIsMeta = group === "darwin";
  const wantsControl = modIsMeta ? false : !!binding.mod;
  const wantsMeta = modIsMeta ? !!binding.mod : false;
  if (!!input.control !== wantsControl || !!input.meta !== wantsMeta || !!input.shift !== !!binding.shift || !!input.alt !== !!binding.alt) {
    return false;
  }
  if (binding.code !== void 0) {
    return input.code === binding.code;
  }
  return binding.key !== void 0 && input.key.toLowerCase() === binding.key.toLowerCase();
}
function matchBrowserShortcut(input, platform) {
  const group = groupOf(platform);
  for (const action of ACTIONS) {
    if (BROWSER_SHORTCUT_BINDINGS[action][group].some((b) => bindingMatches(b, input, group))) {
      return action;
    }
  }
  return null;
}
function keyLabel(binding) {
  if (binding.code !== void 0) {
    return CODE_LABELS[binding.code] ?? binding.code;
  }
  const key = binding.key ?? "";
  if (key === "ArrowLeft") {
    return "Left";
  }
  if (key === "ArrowRight") {
    return "Right";
  }
  return key.length === 1 ? key.toUpperCase() : key;
}
function formatBrowserShortcutLabel(action, platform) {
  const group = groupOf(platform);
  const binding = BROWSER_SHORTCUT_BINDINGS[action][group][0];
  const key = keyLabel(binding);
  if (group === "darwin") {
    return `${binding.alt ? "\u2325" : ""}${binding.shift ? "\u21E7" : ""}${binding.mod ? "\u2318" : ""}${key}`;
  }
  const parts = [
    binding.mod ? "Ctrl" : null,
    binding.alt ? "Alt" : null,
    binding.shift ? "Shift" : null,
    key
  ].filter((part) => part !== null);
  return parts.join("+");
}

// src/renderer/components/browser-pane/navigate/browser-reload-action.ts
function resolveBrowserReloadIntent(trigger, state) {
  if (trigger === "button" && state.loading) {
    return "stop";
  }
  if (state.loadErrorCode !== null) {
    return state.loadErrorCode === BROWSER_GUEST_RECOVERY_ERROR_CODE ? "retry-guest-recovery" : "retry-load";
  }
  return trigger === "hard-reload" ? "hard-reload" : "reload";
}
function reloadBrowserPageWebview(webview, { ignoreCache }) {
  try {
    webview.getWebContentsId();
  } catch {
    return "guest-missing";
  }
  try {
    if (ignoreCache) {
      webview.reloadIgnoringCache();
    } else {
      webview.reload();
    }
  } catch {
    try {
      webview.getWebContentsId();
    } catch {
      return "guest-missing";
    }
    return "not-ready";
  }
  return "reloaded";
}
function resolveBrowserReloadButtonLabelKind(state) {
  if (state.loading) {
    return "stop";
  }
  return state.loadErrorCode !== null ? "retry" : "reload";
}

// src/renderer/components/browser-pane/navigate/use-browser-page-reload-actions.ts
function useBrowserPageReloadActions({
  browserTab,
  webviewRef,
  trackNextLoadingEventRef,
  retryGuestRecoveryRef,
  onUpdatePageStateRef
}) {
  const reloadShortcut = formatBrowserShortcutLabel("browser.reload", getRendererPlatform());
  const hardReloadShortcut = formatBrowserShortcutLabel("browser.hardReload", getRendererPlatform());
  const [reloadMenuOpen, setReloadMenuOpen] = useState(false);
  const reloadState = useMemo(
    () => ({ loading: browserTab.loading, loadErrorCode: browserTab.loadError?.code ?? null }),
    [browserTab.loading, browserTab.loadError]
  );
  const reloadWebviewOrRecoverGuest = useCallback(
    (ignoreCache) => {
      const webview = webviewRef.current;
      if (!webview) {
        return;
      }
      if (trackNextLoadingEventRef) {
        trackNextLoadingEventRef.current = true;
      }
      const result = reloadBrowserPageWebview(webview, { ignoreCache });
      if (result === "reloaded") {
        onUpdatePageStateRef.current(browserTab.id, { loading: true });
      } else if (result === "guest-missing") {
        if (trackNextLoadingEventRef) {
          trackNextLoadingEventRef.current = false;
        }
        onUpdatePageStateRef.current(browserTab.id, { loading: true });
        retryGuestRecoveryRef.current();
      } else if (trackNextLoadingEventRef) {
        trackNextLoadingEventRef.current = false;
      }
    },
    [
      browserTab.id,
      onUpdatePageStateRef,
      retryGuestRecoveryRef,
      trackNextLoadingEventRef,
      webviewRef
    ]
  );
  const runReloadTrigger = useCallback(
    (trigger) => {
      const webview = webviewRef.current;
      if (!webview) {
        return;
      }
      switch (resolveBrowserReloadIntent(trigger, reloadState)) {
        case "stop":
          webview.stop();
          break;
        case "retry-guest-recovery":
          onUpdatePageStateRef.current(browserTab.id, { loading: true });
          retryGuestRecoveryRef.current();
          break;
        case "retry-load":
          retryBrowserTabLoad(webview, browserTab, onUpdatePageStateRef.current);
          break;
        case "hard-reload":
          reloadWebviewOrRecoverGuest(true);
          break;
        case "reload":
          reloadWebviewOrRecoverGuest(false);
          break;
      }
    },
    [
      browserTab,
      onUpdatePageStateRef,
      reloadState,
      reloadWebviewOrRecoverGuest,
      retryGuestRecoveryRef,
      webviewRef
    ]
  );
  const reloadButtonLabelKind = resolveBrowserReloadButtonLabelKind(reloadState);
  const reloadButtonLabel = reloadButtonLabelKind === "stop" ? translate("auto.components.browser.pane.BrowserPane.b7e4d9c1a2", "Stop") : reloadButtonLabelKind === "retry" ? translate("auto.components.browser.pane.BrowserPane.781d6459ad", "Retry") : translate("auto.components.browser.pane.BrowserPane.0e080d820e", "Reload");
  return {
    reloadWebviewOrRecoverGuest,
    runReloadTrigger,
    reloadButtonLabel,
    reloadButtonLabelKind,
    reloadMenuOpen,
    setReloadMenuOpen,
    reloadShortcut,
    hardReloadShortcut
  };
}

// src/renderer/components/browser-pane/navigate/use-browser-page-webview-url-sync.ts
import { useEffect as useEffect2, useLayoutEffect } from "react";

// src/renderer/components/browser-pane/navigate/chromium-error-page-polling.ts
function shouldPollChromiumErrorPage(args) {
  return args.isActive && args.loading;
}

// src/renderer/components/browser-pane/navigate/use-browser-page-webview-url-sync.ts
function runWhileDocumentVisible(run, intervalMs) {
  let intervalId = null;
  const reconcile = () => {
    const visible = document.visibilityState === void 0 || document.visibilityState === "visible";
    if (visible && intervalId === null) {
      run();
      intervalId = setInterval(run, intervalMs);
    } else if (!visible && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
  reconcile();
  document.addEventListener("visibilitychange", reconcile);
  return () => {
    document.removeEventListener("visibilitychange", reconcile);
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
function useBrowserPageWebviewUrlSync({
  browserTabId,
  browserTabUrl,
  browserTabLoading,
  isActive,
  isPaintable,
  slotViewport,
  webviewRef,
  chromeHeaderRef,
  lastKnownWebviewUrlRef,
  trackNextLoadingEventRef,
  keepAddressBarFocusRef,
  addressBarInputRef,
  browserTabUrlRef,
  addressBarValueRef,
  onUpdatePageStateRef,
  focusWebviewNow
}) {
  useLayoutEffect(() => {
    applyBrowserPageViewportLayout(browserTabId, { paintable: isPaintable, active: isActive });
    const syncChromeInset = () => {
      const header2 = chromeHeaderRef.current;
      if (!header2) {
        return;
      }
      syncBrowserPageChromeInset(browserTabId, header2.offsetHeight);
    };
    syncChromeInset();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncChromeInset);
    const header = chromeHeaderRef.current;
    if (header) {
      resizeObserver?.observe(header);
    }
    return () => {
      resizeObserver?.disconnect();
    };
  }, [browserTabId, chromeHeaderRef, isActive, isPaintable, slotViewport]);
  useEffect2(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }
    const normalizedUrl = normalizeBrowserNavigationUrl(browserTabUrl);
    if (!normalizedUrl) {
      return;
    }
    if (lastKnownWebviewUrlRef.current === normalizedUrl) {
      return;
    }
    let liveUrl = null;
    try {
      liveUrl = webview.getURL() || null;
    } catch {
      return;
    }
    const normalizedLiveUrl = liveUrl ? normalizeBrowserNavigationUrl(liveUrl) ?? liveUrl : null;
    const declaredSrc = webview.getAttribute("src");
    if (normalizedLiveUrl !== normalizedUrl && webview.src !== normalizedUrl && declaredSrc !== normalizedUrl) {
      trackNextLoadingEventRef.current = normalizedUrl !== ORCA_BROWSER_BLANK_URL;
      lastKnownWebviewUrlRef.current = normalizedUrl;
      webview.src = normalizedUrl;
      if (normalizedUrl !== ORCA_BROWSER_BLANK_URL) {
        keepAddressBarFocusRef.current = false;
        if (document.activeElement === addressBarInputRef.current) {
          focusWebviewNow();
        }
      }
    }
  }, [
    addressBarInputRef,
    browserTabUrl,
    focusWebviewNow,
    keepAddressBarFocusRef,
    lastKnownWebviewUrlRef,
    trackNextLoadingEventRef,
    webviewRef
  ]);
  useEffect2(() => {
    if (!shouldPollChromiumErrorPage({ isActive, loading: browserTabLoading })) {
      return;
    }
    const detectChromiumErrorPage = () => {
      const webview = webviewRef.current;
      if (!webview) {
        return;
      }
      try {
        const currentUrl = webview.getURL() || webview.src || "";
        if (!isChromiumErrorPage(currentUrl)) {
          return;
        }
        const attemptedUrl = browserTabUrlRef.current || addressBarValueRef.current || "about:blank";
        onUpdatePageStateRef.current(browserTabId, {
          loading: false,
          loadError: {
            code: -1,
            description: translate(
              "auto.components.browser.pane.BrowserPane.e48569ac6d",
              "This site could not be reached."
            ),
            validatedUrl: redactKagiSessionToken(attemptedUrl)
          }
        });
      } catch {
      }
    };
    return runWhileDocumentVisible(detectChromiumErrorPage, 250);
  }, [
    addressBarValueRef,
    browserTabId,
    browserTabLoading,
    browserTabUrlRef,
    isActive,
    onUpdatePageStateRef,
    webviewRef
  ]);
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-webview-shortcuts.ts
import { useEffect as useEffect3 } from "react";

// src/renderer/components/browser-pane/describe-page/browser-overlay-shortcut-target.ts
function browserOverlayOwnsShortcutTarget(target, overlayTabId) {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest("[data-browser-overlay-tab-id]")?.getAttribute("data-browser-overlay-tab-id") === overlayTabId;
}
function browserChromeShortcutOwnsEvent(chromeShortcutScope, event, workspaceId) {
  return chromeShortcutScope === "focused" || chromeShortcutScope === "owned-target" && browserOverlayOwnsShortcutTarget(event.target, workspaceId);
}

// src/renderer/components/browser-pane/host-guest/browser-keyboard.ts
function isEditableKeyboardTarget(target) {
  const element = target && typeof target === "object" && ("closest" in target || "isContentEditable" in target) ? target : null;
  if (!element) {
    return false;
  }
  const editableHost = element.closest?.(
    [
      "input",
      "textarea",
      "select",
      '[contenteditable=""]',
      '[contenteditable="true"]',
      ".monaco-editor",
      ".diff-editor",
      ".rich-markdown-editor",
      ".rich-markdown-editor-shell"
    ].join(", ")
  );
  if (editableHost) {
    return true;
  }
  return element.isContentEditable === true;
}
function matchBrowserShortcutEvent(event) {
  return matchBrowserShortcut(
    {
      key: event.key,
      code: event.code,
      control: event.ctrlKey,
      meta: event.metaKey,
      shift: event.shiftKey,
      alt: event.altKey
    },
    getRendererPlatform()
  );
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-webview-shortcuts.ts
function useBrowserPageWebviewShortcuts({
  browserTabId,
  workspaceId,
  isActive,
  chromeShortcutScope,
  isActiveRef,
  webviewRef,
  paneZoomLevelRef,
  setBrowserDefaultZoomLevel,
  showBrowserZoomFeedback,
  reloadWebviewOrRecoverGuest
}) {
  useEffect3(() => {
    if (chromeShortcutScope === "inactive") {
      return;
    }
    const handleKeyDown = (e) => {
      const action = matchBrowserShortcutEvent(e);
      const direction = action === "browser.back" ? "back" : action === "browser.forward" ? "forward" : null;
      if (direction === null || !browserChromeShortcutOwnsEvent(chromeShortcutScope, e, workspaceId)) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      if (direction === "back") {
        webviewRef.current?.goBack();
      } else {
        webviewRef.current?.goForward();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [chromeShortcutScope, webviewRef, workspaceId]);
  useEffect3(() => {
    if (!isActive) {
      return;
    }
    return window.browserAPI.onHistoryNavigate(({ browserPageId, direction }) => {
      if (browserPageId !== browserTabId) {
        return;
      }
      if (direction === "back") {
        webviewRef.current?.goBack();
      } else {
        webviewRef.current?.goForward();
      }
    });
  }, [browserTabId, isActive, webviewRef]);
  useEffect3(() => {
    if (chromeShortcutScope === "inactive") {
      return;
    }
    const handleKeyDown = (e) => {
      const action = matchBrowserShortcutEvent(e);
      const isHardReload = action === "browser.hardReload";
      const isReload = action === "browser.reload";
      if (!isHardReload && !isReload) {
        return;
      }
      if (isEditableKeyboardTarget(e.target) || !browserChromeShortcutOwnsEvent(chromeShortcutScope, e, workspaceId)) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      reloadWebviewOrRecoverGuest(isHardReload);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [chromeShortcutScope, reloadWebviewOrRecoverGuest, workspaceId]);
  useEffect3(() => {
    if (!isActive) {
      return;
    }
    return window.browserAPI.onReloadPage(({ browserPageId }) => {
      if (browserPageId === browserTabId) {
        reloadWebviewOrRecoverGuest(false);
      }
    });
  }, [browserTabId, isActive, reloadWebviewOrRecoverGuest]);
  useEffect3(() => {
    if (!isActive) {
      return;
    }
    return window.browserAPI.onHardReloadPage(({ browserPageId }) => {
      if (browserPageId === browserTabId) {
        reloadWebviewOrRecoverGuest(true);
      }
    });
  }, [browserTabId, isActive, reloadWebviewOrRecoverGuest]);
  useEffect3(() => {
    if (!isActive) {
      return;
    }
    const applyActivePageZoom = (direction) => {
      if (!isActiveRef.current) {
        return;
      }
      const nextLevel = applyBrowserPageZoom(webviewRef.current, direction);
      if (nextLevel !== null) {
        paneZoomLevelRef.current = nextLevel;
        rememberExplicitBrowserPageZoomLevel(browserTabId, nextLevel);
        setBrowserDefaultZoomLevel(nextLevel);
        showBrowserZoomFeedback(nextLevel);
      }
    };
    const handleZoom = ({ browserPageId, direction }) => {
      if (browserPageId === browserTabId) {
        applyActivePageZoom(direction);
      }
    };
    const removeGuestListener = window.browserAPI.onZoomPage(handleZoom);
    const removeLocalListener = addBrowserPageZoomEventListener(handleZoom);
    return () => {
      removeGuestListener();
      removeLocalListener();
    };
  }, [
    browserTabId,
    isActive,
    isActiveRef,
    paneZoomLevelRef,
    setBrowserDefaultZoomLevel,
    showBrowserZoomFeedback,
    webviewRef
  ]);
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-keyboard-shortcuts.ts
function useBrowserPageKeyboardShortcuts({
  browserTabId,
  workspaceId,
  isActive,
  chromeShortcutScope,
  isActiveRef,
  webviewRef,
  paneZoomLevelRef,
  setBrowserDefaultZoomLevel,
  showBrowserZoomFeedback,
  reloadWebviewOrRecoverGuest
}) {
  useBrowserPageWebviewShortcuts({
    browserTabId,
    workspaceId,
    isActive,
    chromeShortcutScope,
    isActiveRef,
    webviewRef,
    paneZoomLevelRef,
    setBrowserDefaultZoomLevel,
    showBrowserZoomFeedback,
    reloadWebviewOrRecoverGuest
  });
}

// src/renderer/ui/tooltip.tsx
import * as TooltipPrimitive from "radix-ui/tooltip";
import { cva } from "class-variance-authority";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function TooltipProvider({
  delayDuration = 0,
  disableHoverableContent = true,
  ...props
}) {
  return /* @__PURE__ */ jsx3(
    TooltipPrimitive.Provider,
    {
      "data-slot": "tooltip-provider",
      delayDuration,
      disableHoverableContent,
      ...props
    }
  );
}
function Tooltip({ ...props }) {
  return /* @__PURE__ */ jsx3(TooltipPrimitive.Root, { "data-slot": "tooltip", ...props });
}
function TooltipTrigger({ ...props }) {
  return /* @__PURE__ */ jsx3(TooltipPrimitive.Trigger, { "data-slot": "tooltip-trigger", ...props });
}
var tooltipContentVariants = cva("pointer-events-none z-[90] rounded-md text-xs", {
  variants: {
    variant: {
      default: "w-fit origin-(--radix-tooltip-content-transform-origin) animate-in bg-foreground px-3 py-1.5 text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
      "tab-preview": "w-64 max-w-[calc(100vw-1rem)] border border-border bg-popover p-3 text-popover-foreground shadow-floating motion-safe:animate-in motion-safe:fade-in-0 data-[state=closed]:animate-none"
    }
  },
  defaultVariants: { variant: "default" }
});
function TooltipContent({
  className,
  sideOffset = 0,
  showArrow = true,
  variant,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsx3(TooltipPrimitive.Portal, { children: /* @__PURE__ */ jsxs2(
    TooltipPrimitive.Content,
    {
      "data-slot": "tooltip-content",
      sideOffset,
      className: cn(tooltipContentVariants({ variant }), className),
      ...props,
      children: [
        children,
        showArrow ? /* @__PURE__ */ jsx3(TooltipPrimitive.Arrow, { className: "size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" }) : null
      ]
    }
  ) });
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserAddressBar.tsx
import { useCallback as useCallback5, useEffect as useEffect6, useLayoutEffect as useLayoutEffect2, useMemo as useMemo3, useRef as useRef4, useState as useState2 } from "react";
import { Globe as Globe2 } from "lucide-react";

// src/renderer/ui/input.tsx
import * as React from "react";

// src/renderer/lib/ime-composition-keyboard-event.ts
import { useMemo as useMemo2, useRef } from "react";
function isImeOwnedKeyboardEvent(event) {
  return event.isComposing === true || event.keyCode === 229 || event.nativeEvent?.isComposing === true || event.nativeEvent?.keyCode === 229;
}
function useImeEnterGestureOwnership() {
  const stateRef = useRef({
    composing: false,
    pendingEnter: null
  });
  return useMemo2(() => {
    const reset = () => {
      stateRef.current = { composing: false, pendingEnter: null };
    };
    const expirePendingEnter = () => {
      const pendingEnter = stateRef.current.pendingEnter;
      if (pendingEnter) {
        requestAnimationFrame(() => {
          if (stateRef.current.pendingEnter === pendingEnter) {
            stateRef.current.pendingEnter = null;
          }
        });
      }
    };
    const isPlainEnter = (event) => event.key === "Enter" && event.keyCode === 13 && !event.shiftKey;
    const hasChordModifier = (event) => Boolean(event.altKey || event.ctrlKey || event.metaKey);
    return {
      isComposing: () => stateRef.current.composing,
      ownsKeyDown: (event) => {
        const markedEnter = (isImeOwnedKeyboardEvent(event) || stateRef.current.composing) && (isPlainEnter(event) || event.key === "Enter" && event.keyCode === 229 || event.key === "Process" && event.keyCode === 229);
        if (markedEnter) {
          stateRef.current.pendingEnter = {};
          return true;
        }
        if (!stateRef.current.composing && !isImeOwnedKeyboardEvent(event) && !["Enter", "Shift", "Control", "Alt", "Meta"].includes(event.key)) {
          stateRef.current.pendingEnter = null;
        }
        if (stateRef.current.pendingEnter && isPlainEnter(event) && !event.nativeEvent.isComposing) {
          stateRef.current.pendingEnter = null;
          if (hasChordModifier(event)) {
            return false;
          }
          event.preventDefault();
          return true;
        }
        return false;
      },
      onKeyUp: () => {
        expirePendingEnter();
      },
      onCompositionEnd: () => {
        const compositionWasActive = stateRef.current.composing;
        stateRef.current.composing = false;
        if (compositionWasActive && !stateRef.current.pendingEnter) {
          stateRef.current.pendingEnter = {};
          expirePendingEnter();
        }
      },
      reset,
      setComposing: (active) => {
        stateRef.current.composing = active;
      }
    };
  }, []);
}

// src/renderer/lib/ime-text-field.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
function useImeTextFieldProps(props) {
  const ime = useImeEnterGestureOwnership();
  return {
    onKeyDown(event) {
      if (ime.ownsKeyDown(event) || ime.isComposing() || isImeOwnedKeyboardEvent(event)) {
        event.stopPropagation();
        return;
      }
      props.onKeyDown?.(event);
    },
    onKeyUp(event) {
      ime.onKeyUp(event);
      props.onKeyUp?.(event);
    },
    onCompositionStart(event) {
      ime.setComposing(true);
      props.onCompositionStart?.(event);
    },
    onCompositionEnd(event) {
      ime.onCompositionEnd();
      props.onCompositionEnd?.(event);
    },
    onBlur(event) {
      ime.reset();
      props.onBlur?.(event);
    }
  };
}
function ImeInput(props) {
  const imeProps = useImeTextFieldProps(props);
  return /* @__PURE__ */ jsx4("input", { ...props, ...imeProps });
}

// src/renderer/ui/input.tsx
import { jsx as jsx5 } from "react/jsx-runtime";
var Input = React.forwardRef(
  ({ className, type, ...props }, ref) => {
    return /* @__PURE__ */ jsx5(
      ImeInput,
      {
        ref,
        type,
        "data-slot": "input",
        className: cn(
          "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className
        ),
        ...props
      }
    );
  }
);
Input.displayName = "Input";

// src/renderer/ui/popover.tsx
import * as React2 from "react";
import * as PopoverPrimitive from "radix-ui/popover";

// src/renderer/lib/ime-overlay-escape.ts
function handleImeOverlayEscape(event, onEscapeKeyDown) {
  if (isImeOwnedKeyboardEvent(event)) {
    event.preventDefault();
    return;
  }
  onEscapeKeyDown?.(event);
}

// src/renderer/ui/popover.tsx
import { jsx as jsx6 } from "react/jsx-runtime";
var consumerPreventedWheelEvents = /* @__PURE__ */ new WeakSet();
function Popover(props) {
  return /* @__PURE__ */ jsx6(PopoverPrimitive.Root, { "data-slot": "popover", ...props });
}
function PopoverTrigger(props) {
  return /* @__PURE__ */ jsx6(PopoverPrimitive.Trigger, { "data-slot": "popover-trigger", ...props });
}
function resolvePopoverScroller(target, content) {
  let node = target instanceof Node ? target : null;
  while (node && node !== content.parentNode) {
    if (node instanceof HTMLElement && node.scrollHeight > node.clientHeight) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        return node;
      }
    }
    node = node.parentNode;
  }
  return null;
}
function handlePopoverWheel(event, content) {
  if (event.defaultPrevented || consumerPreventedWheelEvents.has(event) || !(event.target instanceof Node) || !content.contains(event.target)) {
    return;
  }
  if (!content.classList.contains("popover-scroll-content") && !content.classList.contains("popover-wheel-scroll")) {
    return;
  }
  const el = resolvePopoverScroller(event.target, content);
  if (!el) {
    return;
  }
  const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? event.deltaY * el.clientHeight : event.deltaY;
  const maxScrollTop = el.scrollHeight - el.clientHeight;
  const nextScrollTop = Math.max(0, Math.min(maxScrollTop, el.scrollTop + delta));
  if (nextScrollTop !== el.scrollTop) {
    event.preventDefault();
    el.scrollTop = nextScrollTop;
  }
}
function attachPopoverContent(content, portalContainer, forwardedRef) {
  const wheelTarget = portalContainer ?? content.ownerDocument.body;
  const handleWheel = (event) => handlePopoverWheel(event, content);
  wheelTarget.addEventListener("wheel", handleWheel, { passive: false });
  const refCleanup = typeof forwardedRef === "function" ? forwardedRef(content) : void 0;
  if (forwardedRef && typeof forwardedRef !== "function") {
    forwardedRef.current = content;
  }
  return () => {
    wheelTarget.removeEventListener("wheel", handleWheel);
    if (typeof refCleanup === "function") {
      refCleanup();
    } else if (typeof forwardedRef === "function") {
      forwardedRef(null);
    } else if (forwardedRef) {
      forwardedRef.current = null;
    }
  };
}
function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  wheelScroll = false,
  portalContainer,
  style,
  onWheel,
  onWheelCapture,
  ref: forwardedRef,
  ...props
}) {
  const handleConsumerWheel = React2.useCallback(
    (event) => {
      onWheel?.(event);
      if (event.defaultPrevented) {
        consumerPreventedWheelEvents.add(event.nativeEvent);
      }
    },
    [onWheel]
  );
  const handleConsumerWheelCapture = React2.useCallback(
    (event) => {
      onWheelCapture?.(event);
      if (event.defaultPrevented) {
        consumerPreventedWheelEvents.add(event.nativeEvent);
      }
    },
    [onWheelCapture]
  );
  const setContentRef = React2.useCallback(
    (node) => {
      if (node) {
        return attachPopoverContent(node, portalContainer, forwardedRef);
      }
      if (typeof forwardedRef === "function") {
        forwardedRef(null);
      } else if (forwardedRef) {
        forwardedRef.current = null;
      }
      return void 0;
    },
    [forwardedRef, portalContainer]
  );
  return /* @__PURE__ */ jsx6(PopoverPrimitive.Portal, { container: portalContainer ?? void 0, children: /* @__PURE__ */ jsx6(
    PopoverPrimitive.Content,
    {
      "data-slot": "popover-content",
      align,
      sideOffset,
      className: cn(
        "z-[60] overflow-hidden rounded-md border border-black/14 bg-[rgba(255,255,255,0.82)] text-popover-foreground shadow-[0_16px_36px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl outline-none dark:border-white/14 dark:bg-[rgba(0,0,0,0.72)] dark:shadow-[0_20px_44px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        wheelScroll && "popover-wheel-scroll",
        className
      ),
      ref: setContentRef,
      style: {
        ...style,
        WebkitAppRegion: "no-drag"
      },
      onWheel: handleConsumerWheel,
      onWheelCapture: handleConsumerWheelCapture,
      ...props,
      onEscapeKeyDown: (event) => handleImeOverlayEscape(event, props.onEscapeKeyDown)
    }
  ) });
}

// src/renderer/lib/browser-history-match.ts
var TIER_RANK = {
  "host-prefix": 0,
  "host-substring": 1,
  title: 2,
  "url-tail": 3
};
var MAX_VISIT_COUNT_BONUS = 50;
var RECENCY_BONUS_HOURS = 24;
var NO_MATCHES = [];
var preparedHistoryCache = /* @__PURE__ */ new WeakMap();
function historyHost(url) {
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
function prepareBrowserHistoryEntries(entries) {
  const cached = preparedHistoryCache.get(entries);
  if (cached) {
    return cached;
  }
  const prepared = entries.map((entry) => ({
    entry,
    lowerUrl: entry.url.toLowerCase(),
    lowerTitle: entry.title.toLowerCase(),
    lowerHost: historyHost(entry.url),
    frecencyBase: Math.min(entry.visitCount, MAX_VISIT_COUNT_BONUS)
  }));
  preparedHistoryCache.set(entries, prepared);
  return prepared;
}
function matchTier(prepared, lowerQuery) {
  const prefixTarget = prepared.lowerHost === "" ? prepared.lowerUrl : prepared.lowerHost;
  if (prefixTarget.startsWith(lowerQuery) || prepared.lowerUrl.startsWith(lowerQuery)) {
    return "host-prefix";
  }
  if (prepared.lowerHost.includes(lowerQuery)) {
    return "host-substring";
  }
  if (prepared.lowerTitle.includes(lowerQuery)) {
    return "title";
  }
  return prepared.lowerUrl.includes(lowerQuery) ? "url-tail" : null;
}
function matchBrowserHistory({
  includeUrlTail = true,
  limit,
  now = Date.now(),
  prepared,
  query
}) {
  const lowerQuery = query.trim().toLowerCase();
  if (lowerQuery === "" || limit <= 0 || prepared.length === 0) {
    return NO_MATCHES;
  }
  const matches = [];
  for (const candidate of prepared) {
    const tier = matchTier(candidate, lowerQuery);
    if (tier === null || tier === "url-tail" && !includeUrlTail) {
      continue;
    }
    const ageHours = (now - candidate.entry.lastVisitedAt) / (1e3 * 60 * 60);
    matches.push({
      entry: candidate.entry,
      tier,
      // Clamped both ends: a future lastVisitedAt must not buy more than a fresh visit.
      score: candidate.frecencyBase + Math.min(RECENCY_BONUS_HOURS, Math.max(0, RECENCY_BONUS_HOURS - ageHours))
    });
  }
  if (matches.length === 0) {
    return NO_MATCHES;
  }
  matches.sort(
    (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.score - a.score || b.entry.lastVisitedAt - a.entry.lastVisitedAt || a.entry.normalizedUrl.localeCompare(b.entry.normalizedUrl)
  );
  return matches.slice(0, limit);
}

// src/shared/utf8-byte-limits.ts
function readUtf8CodePointAt(text, index) {
  const leadUnit = text.charCodeAt(index);
  if (leadUnit < 55296 || leadUnit > 56319 || index + 1 >= text.length) {
    return leadUnit;
  }
  const trailUnit = text.charCodeAt(index + 1);
  if (trailUnit < 56320 || trailUnit > 57343) {
    return leadUnit;
  }
  return (leadUnit - 55296) * 1024 + (trailUnit - 56320) + 65536;
}
function measureUtf8ByteLength(text, options = {}) {
  const stopAfterBytes = options.stopAfterBytes;
  let byteLength = 0;
  for (let index = 0; index < text.length; index += 1) {
    const codePoint = readUtf8CodePointAt(text, index);
    byteLength += getUtf8ByteLengthForCodePoint(codePoint);
    if (Number.isFinite(stopAfterBytes) && byteLength > (stopAfterBytes ?? 0)) {
      return { byteLength, exceededLimit: true };
    }
    if (codePoint > 65535) {
      index += 1;
    }
  }
  return { byteLength, exceededLimit: false };
}
var MAX_UTF8_SCRATCH_BYTES = 1024 * 1024;
var utf8Encoder = new TextEncoder();
var utf8Scratch = new Uint8Array(0);
function getUtf8ByteLengthForCodePoint(codePoint) {
  if (codePoint <= 127) {
    return 1;
  }
  if (codePoint <= 2047) {
    return 2;
  }
  if (codePoint <= 65535) {
    return 3;
  }
  return 4;
}

// src/shared/clipboard-text.ts
var CLIPBOARD_TEXT_READ_MAX_BYTES = 16 * 1024 * 1024;
var CLIPBOARD_TEXT_WRITE_MAX_BYTES = 16 * 1024 * 1024;
var CLIPBOARD_TEXT_MEASURE_YIELD_CODE_UNITS = 256 * 1024;
function measureClipboardTextByteLength(text, options = {}) {
  return measureUtf8ByteLength(text, options);
}
function isClipboardTextByteLengthOverLimit(text, maxBytes) {
  return text.length > maxBytes || measureClipboardTextByteLength(text, { stopAfterBytes: maxBytes }).exceededLimit;
}

// src/renderer/components/browser-pane/assemble-chrome/browser-address-bar-suggestions.ts
var MAX_BROWSER_ADDRESS_BAR_SUGGESTIONS = 8;
var BROWSER_ADDRESS_BAR_QUERY_MAX_BYTES = 2 * 1024;
function isBrowserAddressBarQueryTooLarge(query, maxBytes = BROWSER_ADDRESS_BAR_QUERY_MAX_BYTES) {
  return isClipboardTextByteLengthOverLimit(query, maxBytes);
}
function buildBrowserAddressBarSuggestions({
  browserUrlHistory,
  kagiSessionLink,
  searchEngine = DEFAULT_SEARCH_ENGINE,
  value
}) {
  if (isBrowserAddressBarQueryTooLarge(value)) {
    return [];
  }
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "about:blank" || trimmed.startsWith("data:")) {
    const recents = browserUrlHistory.map((entry) => ({
      ...entry,
      subtitle: entry.url,
      isSearch: false
    }));
    return recents.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt).slice(0, MAX_BROWSER_ADDRESS_BAR_SUGGESTIONS);
  }
  const rowByEntry = /* @__PURE__ */ new Map();
  for (const entry of browserUrlHistory) {
    rowByEntry.set(entry, { ...entry, subtitle: entry.url, isSearch: false });
  }
  const preparedHistory = prepareBrowserHistoryEntries(browserUrlHistory);
  const historySuggestions = matchBrowserHistory({
    prepared: preparedHistory,
    query: trimmed,
    limit: MAX_BROWSER_ADDRESS_BAR_SUGGESTIONS - 1
  }).map(({ entry }) => rowByEntry.get(entry)).filter((row) => row !== void 0);
  const isQuery = looksLikeSearchQuery(trimmed);
  let topAction;
  if (isQuery) {
    topAction = {
      url: buildSearchUrl(trimmed, searchEngine, { kagiSessionLink }),
      title: trimmed,
      subtitle: translate(
        "auto.components.browser.pane.browser.address.bar.suggestions.87fcdd0da9",
        "{{value0}} Search",
        { value0: SEARCH_ENGINE_LABELS[searchEngine] }
      ),
      lastVisitedAt: 0,
      visitCount: 0,
      isSearch: true
    };
  } else {
    const normalizedUrl = normalizeBrowserNavigationUrl(trimmed, searchEngine, {
      kagiSessionLink
    });
    topAction = normalizedUrl ? {
      url: normalizedUrl,
      title: trimmed,
      subtitle: "",
      lastVisitedAt: 0,
      visitCount: 0,
      isSearch: false
    } : null;
  }
  if (!topAction) {
    return historySuggestions.slice(0, MAX_BROWSER_ADDRESS_BAR_SUGGESTIONS);
  }
  const duplicateIdx = historySuggestions.findIndex((h) => h.url === topAction.url);
  if (duplicateIdx !== -1) {
    return historySuggestions.slice(0, MAX_BROWSER_ADDRESS_BAR_SUGGESTIONS);
  }
  return [topAction, ...historySuggestions].slice(0, MAX_BROWSER_ADDRESS_BAR_SUGGESTIONS);
}

// src/renderer/components/browser-pane/assemble-chrome/browser-address-bar-expansion.ts
var BROWSER_ADDRESS_BAR_MIN_INLINE_WIDTH = 220;
function isBrowserAddressBarCollapsed(inlineWidth) {
  return inlineWidth !== null && inlineWidth < BROWSER_ADDRESS_BAR_MIN_INLINE_WIDTH;
}
function shouldOverlayBrowserAddressBar({
  inlineWidth,
  focused
}) {
  return focused && isBrowserAddressBarCollapsed(inlineWidth);
}

// src/renderer/components/browser-pane/assemble-chrome/browser-address-bar-edit-session.ts
var editSessionsByPageId = /* @__PURE__ */ new Map();
function saveBrowserAddressBarEditSession(pageId, session) {
  editSessionsByPageId.set(pageId, session);
  queueMicrotask(() => {
    if (editSessionsByPageId.get(pageId) === session) {
      editSessionsByPageId.delete(pageId);
    }
  });
}

// src/renderer/components/browser-pane/assemble-chrome/use-browser-address-bar-click-select.ts
import { useCallback as useCallback3, useRef as useRef2 } from "react";
function useBrowserAddressBarClickSelect() {
  const pressFocusedRef = useRef2(false);
  const onMouseDown = useCallback3((event) => {
    const input = event.currentTarget;
    pressFocusedRef.current = event.button === 0 && document.activeElement !== input;
    if (pressFocusedRef.current) {
      input.focus();
      input.setSelectionRange(0, 0);
    } else if (event.detail === 2) {
      input.setSelectionRange(0, 0);
    }
  }, []);
  const onClick = useCallback3((event) => {
    const input = event.currentTarget;
    if (pressFocusedRef.current && input.selectionStart === input.selectionEnd) {
      input.select();
    }
    pressFocusedRef.current = false;
  }, []);
  return { onMouseDown, onClick };
}

// src/renderer/components/browser-pane/assemble-chrome/use-browser-address-bar-dismissal.ts
import { useEffect as useEffect4 } from "react";
function useBrowserAddressBarDismissal(open, dismissSuggestions) {
  useEffect4(() => {
    if (!open) {
      return;
    }
    const handleWindowBlur = () => {
      dismissSuggestions();
    };
    const handleFocusIn = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName !== "WEBVIEW") {
        return;
      }
      dismissSuggestions();
    };
    const handleEscape = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      dismissSuggestions();
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("focusin", handleFocusIn, true);
    window.addEventListener("keydown", handleEscape, true);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("focusin", handleFocusIn, true);
      window.removeEventListener("keydown", handleEscape, true);
    };
  }, [dismissSuggestions, open]);
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserAddressBarSuggestionList.tsx
import { Globe, Search } from "lucide-react";

// src/renderer/ui/command.tsx
import * as React3 from "react";
import { cva as cva2 } from "class-variance-authority";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import * as DialogPrimitive from "radix-ui/dialog";
import { jsx as jsx7, jsxs as jsxs3 } from "react/jsx-runtime";
var commandVariants = cva2("flex h-full w-full flex-col overflow-hidden rounded-md", {
  variants: {
    surface: {
      default: "bg-popover text-popover-foreground",
      inline: "bg-transparent text-foreground"
    },
    density: {
      default: "",
      // Why: matches DropdownMenuItem type so a searchable picker reads like its sibling menus.
      menu: "[&_[cmdk-empty]]:text-[12px] [&_[cmdk-input-wrapper]_svg]:size-3.5 [&_[cmdk-input]]:h-8 [&_[cmdk-input]]:text-[12px] [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:py-[4px] [&_[cmdk-item]]:text-[12px] [&_[cmdk-item]]:leading-[17px] [&_[cmdk-item]]:font-[450]"
    }
  },
  defaultVariants: { surface: "default", density: "default" }
});
function Command({
  className,
  surface,
  density,
  ...props
}) {
  return /* @__PURE__ */ jsx7(
    CommandPrimitive,
    {
      "data-slot": "command",
      className: cn(commandVariants({ surface, density }), className),
      ...props
    }
  );
}
var commandInputVariants = cva2("flex items-center bg-muted/30 px-3 py-1", {
  variants: {
    variant: {
      default: "border-b border-border",
      framed: "rounded-md border border-input"
    }
  },
  defaultVariants: { variant: "default" }
});
function CommandList({
  className,
  animateHeight = false,
  ref,
  ...props
}) {
  const internalRef = React3.useRef(null);
  React3.useEffect(() => {
    const el = internalRef.current;
    if (!el) {
      return;
    }
    const onWheel = (e) => {
      if (el.scrollHeight <= el.clientHeight) {
        return;
      }
      e.preventDefault();
      el.scrollTop += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const mergedRef = React3.useCallback(
    (node) => {
      internalRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );
  return /* @__PURE__ */ jsx7(
    CommandPrimitive.List,
    {
      ref: mergedRef,
      "data-slot": "command-list",
      className: cn(
        "max-h-[min(400px,60vh)] overflow-y-auto overflow-x-hidden scroll-pb-4 scroll-pt-4",
        animateHeight && "h-[min(var(--cmdk-list-height),400px,60vh)] transition-[height] duration-150 ease-out motion-reduce:transition-none",
        className
      ),
      ...props
    }
  );
}
function CommandGroup({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx7(
    CommandPrimitive.Group,
    {
      "data-slot": "command-group",
      className: cn(
        "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className
      ),
      ...props
    }
  );
}
var commandItemVariants = cva2("", {
  variants: { selection: { default: "", palette: "jump-palette-item" } },
  defaultVariants: { selection: "default" }
});
function CommandItem({
  className,
  selection,
  ref,
  ...props
}) {
  return /* @__PURE__ */ jsx7(
    CommandPrimitive.Item,
    {
      ref,
      "data-slot": "command-item",
      className: cn(
        'relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
        commandItemVariants({ selection }),
        className
      ),
      ...props
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserAddressBarSuggestionList.tsx
import { jsx as jsx8, jsxs as jsxs4 } from "react/jsx-runtime";
function BrowserAddressBarSuggestionList({
  suggestions,
  selectedValue,
  onSelectedValueChange,
  onSelect
}) {
  return /* @__PURE__ */ jsx8(Command, { shouldFilter: false, value: selectedValue, onValueChange: onSelectedValueChange, children: /* @__PURE__ */ jsx8(CommandList, { id: "browser-history-listbox", role: "listbox", children: /* @__PURE__ */ jsx8(CommandGroup, { children: suggestions.map((entry) => /* @__PURE__ */ jsxs4(
    CommandItem,
    {
      value: entry.url,
      onSelect: () => onSelect(entry.url),
      className: "flex items-center gap-2 px-3 py-2",
      children: [
        entry.isSearch ? /* @__PURE__ */ jsx8(Search, { className: "size-3.5 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsx8(Globe, { className: "size-3.5 shrink-0 text-muted-foreground" }),
        /* @__PURE__ */ jsxs4("div", { className: "flex min-w-0 flex-1 flex-col", children: [
          /* @__PURE__ */ jsx8("span", { className: "truncate text-sm", children: entry.title }),
          entry.subtitle ? /* @__PURE__ */ jsx8("span", { className: "truncate text-xs text-muted-foreground", children: entry.subtitle }) : null
        ] })
      ]
    },
    entry.url
  )) }) }) });
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserAddressBar.tsx
import { jsx as jsx9, jsxs as jsxs5 } from "react/jsx-runtime";
function BrowserAddressBar({
  value,
  onChange,
  onSubmit,
  onNavigate,
  inputRef,
  dismissSuggestionsRef,
  editSession,
  leadingIcon
}) {
  const [open, setOpen] = useState2(false);
  const [selectedValueOverride, setSelectedValueOverride] = useState2(null);
  const prePreviewValueRef = useRef4(null);
  const autocompleteQuery = prePreviewValueRef.current ?? value;
  const browserUrlHistory = useBrowserStore((s) => s.browserUrlHistory);
  const closingRef = useRef4(false);
  const addressBarClickSelect = useBrowserAddressBarClickSelect();
  const openedAtRef = useRef4(0);
  const blurCloseTimerRef = useRef4(null);
  const closingResetTimerRef = useRef4(null);
  const slotRef = useRef4(null);
  const [inlineWidth, setInlineWidth] = useState2(null);
  useEffect6(() => {
    const slot = slotRef.current;
    if (!slot || typeof ResizeObserver === "undefined") {
      return;
    }
    const syncWidth = () => setInlineWidth(slot.getBoundingClientRect().width);
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);
  const overlay = shouldOverlayBrowserAddressBar({ inlineWidth, focused: open });
  const editSessionPageId = editSession?.pageId ?? null;
  const resumedChrome = editSession?.resumed ?? null;
  const liveEditRef = useRef4({ value, open });
  useLayoutEffect2(() => {
    liveEditRef.current = { value, open };
  });
  useLayoutEffect2(() => {
    if (!resumedChrome) {
      return;
    }
    if (resumedChrome.preview) {
      prePreviewValueRef.current = resumedChrome.preview.typedQuery;
      setSelectedValueOverride(resumedChrome.preview.previewedUrl);
    }
    openedAtRef.current = Date.now();
    setOpen(resumedChrome.suggestionsOpen);
  }, [resumedChrome]);
  useLayoutEffect2(() => {
    const input = inputRef.current;
    if (!editSessionPageId || !input) {
      return;
    }
    return () => {
      if (document.activeElement !== input) {
        return;
      }
      const typedQuery = prePreviewValueRef.current;
      saveBrowserAddressBarEditSession(editSessionPageId, {
        draft: liveEditRef.current.value,
        selection: {
          start: input.selectionStart ?? input.value.length,
          end: input.selectionEnd ?? input.value.length,
          direction: input.selectionDirection ?? "none"
        },
        suggestionsOpen: liveEditRef.current.open,
        // Why the draft alone is not enough: mid-preview it holds the highlighted suggestion, and
        // dropping this would strand the user with no way back to what they actually typed.
        preview: typedQuery === null ? null : { typedQuery, previewedUrl: liveEditRef.current.value }
      });
    };
  }, [editSessionPageId, inputRef]);
  const clearAddressBarTimers = useCallback5(() => {
    if (blurCloseTimerRef.current !== null) {
      window.clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
    if (closingResetTimerRef.current !== null) {
      window.clearTimeout(closingResetTimerRef.current);
      closingResetTimerRef.current = null;
    }
  }, []);
  const setAddressBarFormRef = useCallback5(
    (node) => {
      if (node === null) {
        clearAddressBarTimers();
      }
    },
    [clearAddressBarTimers]
  );
  const suggestions = useMemo3(
    () => buildBrowserAddressBarSuggestions({
      browserUrlHistory,
      kagiSessionLink: null,
      searchEngine: DEFAULT_SEARCH_ENGINE,
      value: autocompleteQuery
    }),
    [browserUrlHistory, autocompleteQuery]
  );
  const clearSuggestionPreview = useCallback5(() => {
    prePreviewValueRef.current = null;
    setSelectedValueOverride(null);
  }, []);
  const previewSuggestion = useCallback5(
    (url) => {
      if (prePreviewValueRef.current === null) {
        prePreviewValueRef.current = autocompleteQuery;
      }
      setSelectedValueOverride(url);
      onChange(url);
    },
    [autocompleteQuery, onChange]
  );
  const selectSuggestionAtIndex = useCallback5(
    (index) => {
      const suggestion = suggestions[index];
      if (!suggestion) {
        return;
      }
      if (index === 0 && suggestion.isSearch) {
        prePreviewValueRef.current = null;
        setSelectedValueOverride(null);
        onChange(autocompleteQuery);
        return;
      }
      previewSuggestion(suggestion.url);
    },
    [autocompleteQuery, onChange, previewSuggestion, suggestions]
  );
  const restoreTypedQuery = useCallback5(() => {
    const typed = prePreviewValueRef.current;
    if (typed === null) {
      return;
    }
    prePreviewValueRef.current = null;
    setSelectedValueOverride(null);
    onChange(typed);
  }, [onChange]);
  const dismissSuggestions = useCallback5(() => {
    if (blurCloseTimerRef.current !== null) {
      window.clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
    restoreTypedQuery();
    setOpen(false);
  }, [restoreTypedQuery]);
  const cancelSuggestionPreview = useCallback5(() => {
    dismissSuggestions();
  }, [dismissSuggestions]);
  const selectedValue = selectedValueOverride && suggestions.some((suggestion) => suggestion.url === selectedValueOverride) ? selectedValueOverride : suggestions[0]?.url ?? "";
  const handleFocus = useCallback5(() => {
    if (closingRef.current) {
      return;
    }
    if (blurCloseTimerRef.current !== null) {
      window.clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
    inputRef.current?.select();
    openedAtRef.current = Date.now();
    setOpen(true);
  }, [inputRef]);
  const handleBlur = useCallback5(() => {
    const elapsed = Date.now() - openedAtRef.current;
    const grace = elapsed < 400;
    if (blurCloseTimerRef.current !== null) {
      window.clearTimeout(blurCloseTimerRef.current);
    }
    blurCloseTimerRef.current = window.setTimeout(() => {
      blurCloseTimerRef.current = null;
      if (grace && inputRef.current && document.activeElement === inputRef.current) {
        return;
      }
      restoreTypedQuery();
      setOpen(false);
    }, 200);
  }, [inputRef, restoreTypedQuery]);
  const handleSelect = useCallback5(
    (url) => {
      closingRef.current = true;
      setOpen(false);
      clearSuggestionPreview();
      onNavigate(url);
      if (closingResetTimerRef.current !== null) {
        window.clearTimeout(closingResetTimerRef.current);
      }
      closingResetTimerRef.current = window.setTimeout(() => {
        closingResetTimerRef.current = null;
        closingRef.current = false;
      }, 100);
    },
    [clearSuggestionPreview, onNavigate]
  );
  const handleKeyDown = useCallback5(
    (event) => {
      if (event.key === "Escape") {
        cancelSuggestionPreview();
        return;
      }
      if (event.key === "Enter" && open) {
        event.preventDefault();
        setOpen(false);
        clearSuggestionPreview();
        onSubmit();
        return;
      }
      if (!open || suggestions.length === 0) {
        return;
      }
      const isPreviewing = prePreviewValueRef.current !== null;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const idx = suggestions.findIndex((s) => s.url === selectedValue);
        const startIdx = Math.max(idx, 0);
        const next = startIdx < suggestions.length - 1 ? startIdx + 1 : 0;
        selectSuggestionAtIndex(next);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const idx = suggestions.findIndex((s) => s.url === selectedValue);
        const startIdx = Math.max(idx, 0);
        if (!isPreviewing) {
          const next = startIdx > 0 ? startIdx - 1 : suggestions.length - 1;
          selectSuggestionAtIndex(next);
          return;
        }
        if (startIdx <= 0) {
          restoreTypedQuery();
          return;
        }
        selectSuggestionAtIndex(startIdx - 1);
      }
    },
    [
      open,
      suggestions,
      selectedValue,
      selectSuggestionAtIndex,
      restoreTypedQuery,
      cancelSuggestionPreview,
      clearSuggestionPreview,
      onSubmit
    ]
  );
  useBrowserAddressBarDismissal(open, dismissSuggestions);
  useEffect6(() => {
    if (!dismissSuggestionsRef) {
      return;
    }
    dismissSuggestionsRef.current = dismissSuggestions;
    return () => {
      dismissSuggestionsRef.current = null;
    };
  }, [dismissSuggestions, dismissSuggestionsRef]);
  return (
    // Why: min-w-11 keeps the leading globe a real hit target once the toolbar
    // squeezes the bar away — without it neighbouring buttons overlap the only
    // affordance for reopening the URL field.
    // Why stretch: the toolbar row pins the address slot's height, and the bar must fill it rather
    // than size itself — otherwise it and the document chip drift apart again.
    /* @__PURE__ */ jsx9("div", { ref: slotRef, className: "flex min-w-11 flex-1 items-stretch", children: /* @__PURE__ */ jsxs5(
      Popover,
      {
        modal: false,
        open,
        onOpenChange: (next) => {
          if (!next && inputRef.current && document.activeElement === inputRef.current) {
            return;
          }
          if (!next) {
            restoreTypedQuery();
          }
          setOpen(next);
        },
        children: [
          /* @__PURE__ */ jsx9(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs5(
            "form",
            {
              ref: setAddressBarFormRef,
              "data-orca-browser-address-bar-overlay": overlay ? "true" : void 0,
              className: cn(
                "flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1 shadow-sm",
                // Why: the toolbar row is the positioned ancestor, so the overlay
                // spans it edge to edge (matching its px-3) instead of the few
                // pixels the squeezed slot has left.
                overlay ? "absolute inset-x-3 top-1/2 z-30 -translate-y-1/2 shadow-[0_10px_24px_rgba(0,0,0,0.18)]" : "min-w-0 flex-1"
              ),
              onClick: () => inputRef.current?.focus(),
              onSubmit: (event) => {
                event.preventDefault();
                setOpen(false);
                clearSuggestionPreview();
                onSubmit();
              },
              children: [
                leadingIcon ?? /* @__PURE__ */ jsx9(Globe2, { className: "size-4 shrink-0 text-muted-foreground" }),
                /* @__PURE__ */ jsx9(
                  Input,
                  {
                    ref: inputRef,
                    value,
                    onFocus: handleFocus,
                    onMouseDown: addressBarClickSelect.onMouseDown,
                    onClick: addressBarClickSelect.onClick,
                    onBlur: handleBlur,
                    onKeyDown: handleKeyDown,
                    "data-orca-browser-address-bar": "true",
                    className: "h-auto border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0",
                    spellCheck: false,
                    autoCapitalize: "none",
                    autoCorrect: "off",
                    onChange: (event) => {
                      const nextValue = event.target.value;
                      prePreviewValueRef.current = null;
                      setSelectedValueOverride(null);
                      onChange(nextValue);
                    },
                    role: "combobox",
                    "aria-expanded": open,
                    "aria-controls": "browser-history-listbox",
                    "aria-autocomplete": "list"
                  }
                )
              ]
            }
          ) }),
          suggestions.length > 0 && /* @__PURE__ */ jsx9(
            PopoverContent,
            {
              align: "start",
              sideOffset: 4,
              className: "w-[var(--radix-popover-trigger-width)] p-0",
              onOpenAutoFocus: (e) => {
                e.preventDefault();
              },
              children: /* @__PURE__ */ jsx9(
                BrowserAddressBarSuggestionList,
                {
                  suggestions,
                  selectedValue,
                  onSelectedValueChange: setSelectedValueOverride,
                  onSelect: handleSelect
                }
              )
            }
          )
        ]
      }
    ) })
  );
}

// src/renderer/components/browser-pane/assemble-chrome/browser-chrome-toolbar.tsx
import { useRef as useRef6 } from "react";
import { ExternalLink, SquareCode } from "lucide-react";

// src/renderer/ui/button.tsx
import * as React4 from "react";
import { cva as cva3 } from "class-variance-authority";
import * as Slot from "radix-ui/slot";
import { jsx as jsx10 } from "react/jsx-runtime";
var buttonVariants = cva3(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md cursor-pointer text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline: "border border-border bg-background text-foreground shadow-xs hover:border-muted-foreground/35 hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
var Button = React4.forwardRef(function Button2({ className, variant = "default", size = "default", asChild = false, ...props }, ref) {
  const Comp = asChild ? Slot.Root : "button";
  return /* @__PURE__ */ jsx10(
    Comp,
    {
      ref,
      "data-slot": "button",
      "data-variant": variant,
      "data-size": size,
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
});

// src/renderer/components/browser-pane/assemble-chrome/browser-navigation-control-row.tsx
import { ArrowLeft, ArrowRight, Loader2, RefreshCw } from "lucide-react";

// src/renderer/components/browser-pane/assemble-chrome/browser-chrome-address-slot.ts
var BROWSER_CHROME_ADDRESS_SLOT_HEIGHT_CLASS = "h-9.5";
var BROWSER_CHROME_ADDRESS_SLOT_ATTRIBUTE = "data-browser-chrome-address-slot";

// src/renderer/components/browser-pane/assemble-chrome/browser-navigation-control-row.tsx
import { jsx as jsx11, jsxs as jsxs6 } from "react/jsx-runtime";
function BrowserNavigationControlRow({
  controls,
  addressSlot,
  reloadControl,
  reloadLabel,
  showTourAnchors = true,
  rowRef,
  children
}) {
  return /* @__PURE__ */ jsxs6(
    "div",
    {
      ref: rowRef,
      className: "relative z-10 flex shrink-0 items-center gap-2 border-b border-border/70 bg-background/95 px-3 py-1.5",
      ...showTourAnchors ? { "data-contextual-tour-target": "browser-toolbar" } : {},
      children: [
        /* @__PURE__ */ jsx11(
          Button,
          {
            size: "icon",
            variant: "ghost",
            className: "h-7 w-7",
            onClick: controls.goBack,
            disabled: !controls.canGoBack,
            "aria-label": translate("browser.navigation.back", "Back"),
            children: /* @__PURE__ */ jsx11(ArrowLeft, { className: "size-4" })
          }
        ),
        /* @__PURE__ */ jsx11(
          Button,
          {
            size: "icon",
            variant: "ghost",
            className: "h-7 w-7",
            onClick: controls.goForward,
            disabled: !controls.canGoForward,
            "aria-label": translate("browser.navigation.forward", "Forward"),
            children: /* @__PURE__ */ jsx11(ArrowRight, { className: "size-4" })
          }
        ),
        reloadControl ?? /* @__PURE__ */ jsx11(
          Button,
          {
            size: "icon",
            variant: "ghost",
            className: "h-7 w-7",
            onClick: controls.reload,
            "aria-label": reloadLabel ?? translate("browser.navigation.reload", "Reload"),
            children: controls.loading ? /* @__PURE__ */ jsx11(Loader2, { className: "size-4 animate-spin" }) : /* @__PURE__ */ jsx11(RefreshCw, { className: "size-4" })
          }
        ),
        /* @__PURE__ */ jsx11(
          "div",
          {
            className: cn(
              "flex min-w-0 flex-1 items-stretch",
              BROWSER_CHROME_ADDRESS_SLOT_HEIGHT_CLASS
            ),
            ...{ [BROWSER_CHROME_ADDRESS_SLOT_ATTRIBUTE]: "true" },
            children: addressSlot
          }
        ),
        children
      ]
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/browser-chrome-folded-tools.tsx
import { Check, Ellipsis } from "lucide-react";

// src/renderer/ui/dropdown-menu.tsx
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import * as DropdownMenuPrimitive from "radix-ui/dropdown-menu";
import { jsx as jsx12, jsxs as jsxs7 } from "react/jsx-runtime";
function DropdownMenu({ ...props }) {
  return /* @__PURE__ */ jsx12(DropdownMenuPrimitive.Root, { "data-slot": "dropdown-menu", ...props });
}
function DropdownMenuTrigger({
  ...props
}) {
  return /* @__PURE__ */ jsx12(DropdownMenuPrimitive.Trigger, { "data-slot": "dropdown-menu-trigger", ...props });
}
function DropdownMenuContent({
  className,
  sideOffset = 4,
  style,
  ...props
}) {
  return /* @__PURE__ */ jsx12(DropdownMenuPrimitive.Portal, { children: /* @__PURE__ */ jsx12(
    DropdownMenuPrimitive.Content,
    {
      "data-slot": "dropdown-menu-content",
      sideOffset,
      className: cn(
        "z-[70] max-h-(--radix-dropdown-menu-content-available-height) min-w-[11rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-[11px] border border-black/14 bg-[rgba(255,255,255,0.82)] p-[4px] text-black dark:text-white shadow-[0_12px_28px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl dark:border-white/14 dark:bg-[rgba(0,0,0,0.72)] dark:shadow-[0_16px_34px_rgba(0,0,0,0.40),inset_0_1px_0_rgba(255,255,255,0.04)] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none data-[state=open]:fade-in-0 data-[state=open]:duration-150 data-[state=open]:zoom-in-[0.98]",
        className
      ),
      style: { ...style, WebkitAppRegion: "no-drag" },
      ...props,
      onEscapeKeyDown: (event) => handleImeOverlayEscape(event, props.onEscapeKeyDown)
    }
  ) });
}
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}) {
  return /* @__PURE__ */ jsx12(
    DropdownMenuPrimitive.Item,
    {
      "data-slot": "dropdown-menu-item",
      "data-inset": inset,
      "data-variant": variant,
      className: cn(
        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-[4px] text-[12px] leading-[17px] font-[450] outline-hidden select-none focus:bg-black/8 dark:focus:bg-white/14 focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      ),
      ...props
    }
  );
}
function DropdownMenuSeparator({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx12(
    DropdownMenuPrimitive.Separator,
    {
      "data-slot": "dropdown-menu-separator",
      className: cn("my-[3px] h-px bg-border/60", className),
      ...props
    }
  );
}
function DropdownMenuShortcut({ className, ...props }) {
  return /* @__PURE__ */ jsx12(
    "span",
    {
      "data-slot": "dropdown-menu-shortcut",
      className: cn(
        "ml-auto shrink-0 whitespace-nowrap text-[11px] tracking-normal text-muted-foreground/85",
        className
      ),
      ...props
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/browser-chrome-folded-tools.tsx
import { Fragment, jsx as jsx13, jsxs as jsxs8 } from "react/jsx-runtime";
function FoldedToolContent({ tool }) {
  const showActiveCheck = tool.active === true;
  const showTrailing = showActiveCheck || Boolean(tool.count) || Boolean(tool.shortcut);
  return /* @__PURE__ */ jsxs8(Fragment, { children: [
    /* @__PURE__ */ jsx13(tool.icon, { className: "size-3.5" }),
    tool.label,
    showTrailing ? (
      // Why: a leading check column would push these icon rows out of line with the plain rows.
      /* @__PURE__ */ jsxs8("span", { className: "ml-auto flex items-center gap-2", children: [
        showActiveCheck ? /* @__PURE__ */ jsx13(Check, { className: "size-3.5 text-foreground" }) : null,
        tool.count ? /* @__PURE__ */ jsx13("span", { className: "flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground", children: tool.count }) : tool.shortcut ? /* @__PURE__ */ jsx13(DropdownMenuShortcut, { children: tool.shortcut }) : null
      ] })
    ) : null
  ] });
}
function FoldedToolRow({
  tool,
  deferUntilClose
}) {
  const onSelect = () => tool.deferUntilMenuClose ? deferUntilClose(tool.onSelect) : tool.onSelect();
  return /* @__PURE__ */ jsx13(
    DropdownMenuItem,
    {
      disabled: tool.disabled,
      onSelect,
      ...tool.active === void 0 ? {} : { role: "menuitemcheckbox", "aria-checked": tool.active },
      children: /* @__PURE__ */ jsx13(FoldedToolContent, { tool })
    }
  );
}
function BrowserChromeFoldedMenuItems({
  tools,
  deferUntilClose,
  trailingSeparator = true
}) {
  if (tools.length === 0) {
    return null;
  }
  const toggleTools = tools.filter((tool) => tool.active !== void 0);
  const actionTools = tools.filter((tool) => tool.active === void 0);
  return /* @__PURE__ */ jsxs8(Fragment, { children: [
    toggleTools.map((tool) => /* @__PURE__ */ jsx13(FoldedToolRow, { tool, deferUntilClose }, tool.stage)),
    toggleTools.length > 0 && actionTools.length > 0 ? /* @__PURE__ */ jsx13(DropdownMenuSeparator, {}) : null,
    actionTools.map((tool) => /* @__PURE__ */ jsx13(FoldedToolRow, { tool, deferUntilClose }, tool.stage)),
    trailingSeparator ? /* @__PURE__ */ jsx13(DropdownMenuSeparator, {}) : null
  ] });
}
function BrowserChromeDefaultOverflowMenu({
  triggerRef,
  tools,
  deferUntilClose,
  onMenuCloseAutoFocus
}) {
  if (tools.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsxs8(DropdownMenu, { modal: false, children: [
    /* @__PURE__ */ jsx13(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx13(
      Button,
      {
        ref: triggerRef,
        size: "icon",
        variant: "ghost",
        className: "h-8 w-8",
        title: translate(
          "auto.components.browser.pane.BrowserToolbarMenu.7b838540c7",
          "Browser menu"
        ),
        children: /* @__PURE__ */ jsx13(Ellipsis, { className: "size-4" })
      }
    ) }),
    /* @__PURE__ */ jsx13(DropdownMenuContent, { align: "end", className: "w-56", onCloseAutoFocus: onMenuCloseAutoFocus, children: /* @__PURE__ */ jsx13(
      BrowserChromeFoldedMenuItems,
      {
        tools,
        deferUntilClose,
        trailingSeparator: false
      }
    ) })
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/use-browser-chrome-tool-fold.ts
import { useLayoutEffect as useLayoutEffect3, useRef as useRef5, useState as useState3 } from "react";
var BROWSER_CHROME_FOLD_ORDER = [
  "import-label",
  "external",
  "devtools",
  "share",
  "import",
  "draw",
  "grab",
  "annotate"
];
var BROWSER_CHROME_ADDRESS_MIN_WIDTH_PX = 120;
function measureRow(row) {
  const slot = row?.querySelector(`[${BROWSER_CHROME_ADDRESS_SLOT_ATTRIBUTE}]`);
  if (!row || !slot || row.clientWidth === 0) {
    return null;
  }
  return {
    address: slot.getBoundingClientRect().width,
    overflow: Math.max(0, row.scrollWidth - row.clientWidth)
  };
}
function useBrowserChromeToolFold(rowRef, stages) {
  const stagesKey = stages.join(",");
  const [foldedCount, setFoldedCount] = useState3(0);
  const level = Math.min(foldedCount, stages.length);
  const freedRef = useRef5({ stagesKey, widths: [] });
  const pendingRef = useRef5(null);
  const checkRef = useRef5(() => {
  });
  checkRef.current = () => {
    if (freedRef.current.stagesKey !== stagesKey) {
      freedRef.current = { stagesKey, widths: [] };
      pendingRef.current = null;
    }
    const measure = measureRow(rowRef.current);
    if (!measure) {
      return;
    }
    const freed = freedRef.current.widths;
    const pending = pendingRef.current;
    if (pending && pending.level === level) {
      freed[level - 1] = measure.address - pending.address + (pending.overflow - measure.overflow);
      pendingRef.current = null;
    }
    const shortfall = Math.max(0, BROWSER_CHROME_ADDRESS_MIN_WIDTH_PX - measure.address) + measure.overflow;
    if (shortfall > 0.5 && level < stages.length) {
      pendingRef.current = { ...measure, level: level + 1 };
      setFoldedCount(level + 1);
      return;
    }
    const slack = measure.address - BROWSER_CHROME_ADDRESS_MIN_WIDTH_PX;
    if (shortfall <= 0.5 && level > 0 && slack >= (freed[level - 1] ?? 0)) {
      setFoldedCount(level - 1);
    }
  };
  useLayoutEffect3(() => {
    checkRef.current();
  }, [level, stagesKey]);
  useLayoutEffect3(() => {
    const row = rowRef.current;
    const slot = row?.querySelector(`[${BROWSER_CHROME_ADDRESS_SLOT_ATTRIBUTE}]`);
    if (!row || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => checkRef.current());
    observer.observe(row);
    if (slot) {
      observer.observe(slot);
    }
    return () => observer.disconnect();
  }, [rowRef]);
  return new Set(stages.slice(0, level));
}

// src/renderer/components/browser-pane/assemble-chrome/browser-chrome-toolbar.tsx
import { jsx as jsx14, jsxs as jsxs9 } from "react/jsx-runtime";
function BrowserChromeActionButton({
  action,
  icon: Icon
}) {
  return /* @__PURE__ */ jsx14(
    Button,
    {
      size: "icon",
      variant: "ghost",
      className: "h-7 w-7",
      onClick: action.onSelect,
      title: action.label,
      "aria-label": action.label,
      disabled: action.disabled,
      children: /* @__PURE__ */ jsx14(Icon, { className: "size-4" })
    }
  );
}
function BrowserChromeToolbar({
  controls,
  addressSlot,
  reloadControl,
  reloadLabel,
  importControl = null,
  viewSource,
  openExternal,
  overflowMenu = null,
  showTourAnchors = false,
  pinnedStage
}) {
  const rowRef = useRef6(null);
  const overflowTriggerRef = useRef6(null);
  const present = {
    "import-label": importControl != null,
    import: importControl != null,
    external: openExternal !== null,
    devtools: viewSource !== null,
    share: false,
    draw: false,
    grab: false,
    annotate: false
  };
  const stages = BROWSER_CHROME_FOLD_ORDER.filter(
    (stage) => present[stage] && stage !== pinnedStage
  );
  const folded = useBrowserChromeToolFold(rowRef, stages);
  const afterMenuCloseRef = useRef6(null);
  const foldedTools = [];
  if (viewSource && folded.has("devtools") && !viewSource.alreadyInOverflowMenu) {
    foldedTools.push({ stage: "devtools", icon: SquareCode, ...viewSource });
  }
  if (openExternal && folded.has("external") && !openExternal.alreadyInOverflowMenu) {
    foldedTools.push({ stage: "external", icon: ExternalLink, ...openExternal });
  }
  const runAfterMenuClose = (action) => {
    afterMenuCloseRef.current = action;
  };
  const onMenuCloseAutoFocus = (event) => {
    const action = afterMenuCloseRef.current;
    if (!action) {
      return;
    }
    afterMenuCloseRef.current = null;
    event.preventDefault();
    action();
  };
  const overflowProps = {
    triggerRef: overflowTriggerRef,
    tools: foldedTools,
    deferUntilClose: runAfterMenuClose,
    onMenuCloseAutoFocus
  };
  return /* @__PURE__ */ jsxs9(
    BrowserNavigationControlRow,
    {
      rowRef,
      controls,
      addressSlot,
      reloadControl,
      reloadLabel,
      showTourAnchors,
      children: [
        folded.has("import") ? null : importControl?.(folded.has("import-label")),
        viewSource && !folded.has("devtools") ? /* @__PURE__ */ jsx14(BrowserChromeActionButton, { action: viewSource, icon: SquareCode }) : null,
        openExternal && !folded.has("external") ? /* @__PURE__ */ jsx14(BrowserChromeActionButton, { action: openExternal, icon: ExternalLink }) : null,
        /* @__PURE__ */ jsx14("span", { className: "relative inline-flex", children: overflowMenu ? (
          // oxlint-disable-next-line react/refs -- Intentional: overflowProps carries a ref object and closures that touch refs only from event handlers.
          overflowMenu(overflowProps)
        ) : /* @__PURE__ */ jsx14(BrowserChromeDefaultOverflowMenu, { ...overflowProps }) })
      ]
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/browser-reload-control.tsx
import { Loader2 as Loader22, RefreshCw as RefreshCw2 } from "lucide-react";
import { jsx as jsx15, jsxs as jsxs10 } from "react/jsx-runtime";
function BrowserReloadControl({
  menuOpen,
  onMenuOpenChange,
  label,
  loading,
  showShortcutHint,
  reloadShortcut,
  hardReloadShortcut,
  onPrimary,
  onReload,
  onHardReload
}) {
  return /* @__PURE__ */ jsxs10(DropdownMenu, { modal: false, open: menuOpen, onOpenChange: onMenuOpenChange, children: [
    /* @__PURE__ */ jsxs10(Tooltip, { open: menuOpen ? false : void 0, children: [
      /* @__PURE__ */ jsx15(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx15(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx15(
        Button,
        {
          size: "icon",
          variant: "ghost",
          className: "h-7 w-7",
          "aria-label": label,
          onPointerDown: (e) => {
            if (e.button === 0) {
              e.preventDefault();
            }
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPrimary();
            }
          },
          onClick: onPrimary,
          onContextMenu: (e) => {
            e.preventDefault();
            onMenuOpenChange(true);
          },
          children: loading ? /* @__PURE__ */ jsx15(Loader22, { className: "size-4 animate-spin" }) : /* @__PURE__ */ jsx15(RefreshCw2, { className: "size-4" })
        }
      ) }) }),
      /* @__PURE__ */ jsxs10(TooltipContent, { side: "bottom", sideOffset: 4, children: [
        label,
        reloadShortcut && showShortcutHint ? ` \xB7 ${reloadShortcut}` : ""
      ] })
    ] }),
    /* @__PURE__ */ jsxs10(DropdownMenuContent, { align: "start", alignOffset: -4, children: [
      /* @__PURE__ */ jsxs10(DropdownMenuItem, { onClick: onReload, children: [
        translate("auto.components.browser.pane.BrowserPane.0e080d820e", "Reload"),
        /* @__PURE__ */ jsx15(DropdownMenuShortcut, { children: reloadShortcut })
      ] }),
      /* @__PURE__ */ jsxs10(DropdownMenuItem, { onClick: onHardReload, children: [
        translate("auto.components.browser.pane.BrowserPane.a1f3c2e4b5", "Hard Reload"),
        /* @__PURE__ */ jsx15(DropdownMenuShortcut, { children: hardReloadShortcut })
      ] })
    ] })
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-toolbar.tsx
import { jsx as jsx16 } from "react/jsx-runtime";
function BrowserPageToolbar({
  browserPageId,
  canGoBack,
  canGoForward,
  loading,
  currentUrl,
  webviewRef,
  reloadMenuOpen,
  setReloadMenuOpen,
  reloadButtonLabel,
  reloadButtonLabelKind,
  reloadShortcut,
  hardReloadShortcut,
  runReloadTrigger,
  addressBarValue,
  setAddressBarValue,
  submitAddressBar,
  navigateToUrl,
  addressBarInputRef,
  dismissAddressBarSuggestionsRef
}) {
  const externalUrl = getOpenableExternalUrl(currentUrl);
  return /* @__PURE__ */ jsx16(TooltipProvider, { children: /* @__PURE__ */ jsx16(
    BrowserChromeToolbar,
    {
      controls: {
        canGoBack,
        canGoForward,
        loading,
        goBack: () => webviewRef.current?.goBack(),
        goForward: () => webviewRef.current?.goForward(),
        reload: () => runReloadTrigger("button"),
        navigate: navigateToUrl
      },
      addressSlot: /* @__PURE__ */ jsx16(
        BrowserAddressBar,
        {
          value: addressBarValue,
          onChange: setAddressBarValue,
          onSubmit: submitAddressBar,
          onNavigate: navigateToUrl,
          inputRef: addressBarInputRef,
          dismissSuggestionsRef: dismissAddressBarSuggestionsRef
        }
      ),
      reloadControl: /* @__PURE__ */ jsx16(
        BrowserReloadControl,
        {
          menuOpen: reloadMenuOpen,
          onMenuOpenChange: setReloadMenuOpen,
          label: reloadButtonLabel,
          loading,
          showShortcutHint: reloadButtonLabelKind === "reload",
          reloadShortcut,
          hardReloadShortcut,
          onPrimary: () => runReloadTrigger("button"),
          onReload: () => runReloadTrigger("reload"),
          onHardReload: () => runReloadTrigger("hard-reload")
        }
      ),
      viewSource: {
        onSelect: () => void window.browserAPI.openDevTools({ browserPageId }),
        label: translate(
          "auto.components.browser.pane.BrowserPane.ec75d0c412",
          "Open browser devtools"
        )
      },
      openExternal: {
        onSelect: () => {
          if (!externalUrl) {
            return;
          }
          void window.browserAPI.openExternal({ url: externalUrl });
        },
        label: translate(
          "auto.components.browser.pane.BrowserPane.0f41bf80c7",
          "Open in default browser"
        ),
        disabled: !externalUrl
      }
    }
  ) });
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-chrome-header.tsx
import { jsx as jsx17 } from "react/jsx-runtime";
function BrowserPageChromeHeader({
  chromeHeaderRef,
  browserTab,
  webviewRef,
  addressBarInputRef,
  dismissAddressBarSuggestionsRef,
  reload,
  addressBarValue,
  setAddressBarValue,
  submitAddressBar,
  navigateToUrl,
  currentUrl
}) {
  return /* @__PURE__ */ jsx17("div", { ref: chromeHeaderRef, className: "pointer-events-auto shrink-0", children: /* @__PURE__ */ jsx17(
    BrowserPageToolbar,
    {
      browserPageId: browserTab.id,
      canGoBack: browserTab.canGoBack,
      canGoForward: browserTab.canGoForward,
      loading: browserTab.loading,
      currentUrl,
      webviewRef,
      reloadMenuOpen: reload.reloadMenuOpen,
      setReloadMenuOpen: reload.setReloadMenuOpen,
      reloadButtonLabel: reload.reloadButtonLabel,
      reloadButtonLabelKind: reload.reloadButtonLabelKind,
      reloadShortcut: reload.reloadShortcut,
      hardReloadShortcut: reload.hardReloadShortcut,
      runReloadTrigger: reload.runReloadTrigger,
      addressBarValue,
      setAddressBarValue,
      submitAddressBar,
      navigateToUrl,
      addressBarInputRef,
      dismissAddressBarSuggestionsRef
    }
  ) });
}

// src/renderer/components/browser-pane/assemble-chrome/use-browser-page-chrome-focus.ts
import { useCallback as useCallback6, useEffect as useEffect7, useRef as useRef7 } from "react";

// src/renderer/components/browser-pane/host-guest/browser-focus.ts
var ORCA_BROWSER_FOCUS_REQUEST_EVENT = "orca:browser-focus-request";
var pendingBrowserFocusByPageId = /* @__PURE__ */ new Map();
var expiredRequestCleanupTimer = null;
function clearExpiredRequestCleanupTimerIfIdle() {
  if (pendingBrowserFocusByPageId.size > 0 || expiredRequestCleanupTimer === null) {
    return;
  }
  clearTimeout(expiredRequestCleanupTimer);
  expiredRequestCleanupTimer = null;
}
function purgeExpiredFocusRequests(now = Date.now()) {
  for (const [pageId, request] of pendingBrowserFocusByPageId) {
    if (request.expiresAt <= now) {
      pendingBrowserFocusByPageId.delete(pageId);
    }
  }
  clearExpiredRequestCleanupTimerIfIdle();
}
function consumeBrowserFocusRequest(pageId) {
  purgeExpiredFocusRequests();
  const pending = pendingBrowserFocusByPageId.get(pageId) ?? null;
  if (!pending) {
    return null;
  }
  pendingBrowserFocusByPageId.delete(pageId);
  clearExpiredRequestCleanupTimerIfIdle();
  return pending.target;
}

// src/renderer/components/browser-pane/assemble-chrome/use-browser-page-chrome-focus.ts
var ADDRESS_BAR_FOCUS_FRAMES = 6;
function useBrowserPageChromeFocus({
  browserTabId,
  workspaceId,
  isActive,
  chromeShortcutScope,
  addressBarInputRef,
  guestFocus
}) {
  const consumeAddressBarFocusRequest = useBrowserStore((s) => s.consumeAddressBarFocusRequest);
  const keepAddressBarFocusRef = useRef7(false);
  const addressBarFocusGrabRef = useRef7(null);
  const cancelAddressBarFocusGrab = useCallback6(() => {
    addressBarFocusGrabRef.current?.();
  }, []);
  const focusAddressBarNow = useCallback6(
    (selection) => {
      const input = addressBarInputRef.current;
      if (!input) {
        return false;
      }
      guestFocus.blur();
      input.focus();
      if (selection) {
        input.setSelectionRange(selection.start, selection.end, selection.direction);
      } else {
        input.select();
      }
      return document.activeElement === input;
    },
    [addressBarInputRef, guestFocus]
  );
  const focusGuestNow = useCallback6(() => {
    if (!guestFocus.isAttached()) {
      return false;
    }
    addressBarInputRef.current?.blur();
    return guestFocus.focus();
  }, [addressBarInputRef, guestFocus]);
  const startAddressBarFocusGrab = useCallback6(
    (selection) => {
      cancelAddressBarFocusGrab();
      let cancelled = false;
      let frameId = 0;
      let attempts = 0;
      const cancel = () => {
        if (addressBarFocusGrabRef.current !== cancel) {
          return;
        }
        addressBarFocusGrabRef.current = null;
        cancelled = true;
        window.cancelAnimationFrame(frameId);
        keepAddressBarFocusRef.current = false;
      };
      const focusAddressBar = () => {
        if (cancelled) {
          return;
        }
        if (attempts === 0 || document.activeElement !== addressBarInputRef.current) {
          focusAddressBarNow(selection);
        }
        attempts += 1;
        if (attempts < ADDRESS_BAR_FOCUS_FRAMES) {
          frameId = window.requestAnimationFrame(focusAddressBar);
        } else {
          addressBarFocusGrabRef.current = null;
          keepAddressBarFocusRef.current = false;
        }
      };
      addressBarFocusGrabRef.current = cancel;
      keepAddressBarFocusRef.current = true;
      focusAddressBar();
      return cancel;
    },
    [addressBarInputRef, cancelAddressBarFocusGrab, focusAddressBarNow]
  );
  useEffect7(() => {
    if (!isActive) {
      return;
    }
    if (!consumeAddressBarFocusRequest(browserTabId)) {
      return;
    }
    return startAddressBarFocusGrab();
  }, [browserTabId, consumeAddressBarFocusRequest, isActive, startAddressBarFocusGrab]);
  useEffect7(() => {
    if (!isActive) {
      return;
    }
    return window.browserAPI.onFocusAddressBar(({ browserPageId }) => {
      if (browserPageId === browserTabId) {
        focusAddressBarNow();
      }
    });
  }, [browserTabId, focusAddressBarNow, isActive]);
  useEffect7(() => {
    if (chromeShortcutScope === "inactive") {
      return;
    }
    const handleKeyDown = (event) => {
      if (matchBrowserShortcutEvent(event) !== "browser.focusAddressBar") {
        return;
      }
      if (!browserChromeShortcutOwnsEvent(chromeShortcutScope, event, workspaceId)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      focusAddressBarNow();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [chromeShortcutScope, focusAddressBarNow, workspaceId]);
  useEffect7(() => {
    if (!isActive) {
      return;
    }
    const focusTarget = consumeBrowserFocusRequest(browserTabId);
    if (!focusTarget) {
      return;
    }
    if (focusTarget === "address-bar") {
      return startAddressBarFocusGrab();
    }
    cancelAddressBarFocusGrab();
    let cancelled = false;
    let frameId = 0;
    let attempts = 0;
    const runFocus = () => {
      if (cancelled) {
        return;
      }
      attempts += 1;
      if (!focusGuestNow() && attempts < ADDRESS_BAR_FOCUS_FRAMES) {
        frameId = window.requestAnimationFrame(runFocus);
      }
    };
    frameId = window.requestAnimationFrame(runFocus);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [browserTabId, cancelAddressBarFocusGrab, focusGuestNow, isActive, startAddressBarFocusGrab]);
  useEffect7(() => {
    if (!isActive) {
      return;
    }
    const handleBrowserFocusRequest = (event) => {
      const detail = event.detail;
      if (!detail || detail.pageId !== browserTabId) {
        return;
      }
      const focusTarget = consumeBrowserFocusRequest(browserTabId);
      if (!focusTarget) {
        return;
      }
      if (focusTarget === "address-bar") {
        startAddressBarFocusGrab();
        return;
      }
      cancelAddressBarFocusGrab();
      focusGuestNow();
    };
    window.addEventListener(ORCA_BROWSER_FOCUS_REQUEST_EVENT, handleBrowserFocusRequest);
    return () => {
      window.removeEventListener(ORCA_BROWSER_FOCUS_REQUEST_EVENT, handleBrowserFocusRequest);
      cancelAddressBarFocusGrab();
    };
  }, [browserTabId, cancelAddressBarFocusGrab, focusGuestNow, isActive, startAddressBarFocusGrab]);
  return { focusAddressBarNow, focusGuestNow, startAddressBarFocusGrab, keepAddressBarFocusRef };
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-guest-focus.ts
import { useMemo as useMemo4 } from "react";
function useWebviewGuestFocus(webviewRef) {
  return useMemo4(
    () => ({
      blur: () => webviewRef.current?.blur(),
      isAttached: () => webviewRef.current !== null,
      focus: () => {
        const webview = webviewRef.current;
        if (!webview) {
          return false;
        }
        try {
          webview.focus();
        } catch {
          return false;
        }
        return document.activeElement === webview;
      }
    }),
    [webviewRef]
  );
}

// src/renderer/components/browser-pane/host-guest/browser-page-paintability.ts
function isBrowserPagePanePaintable({ isActive }) {
  return isActive;
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-slot-viewport.ts
import { useCallback as useCallback7, useSyncExternalStore as useSyncExternalStore2 } from "react";
function useBrowserPageSlotViewport(workspaceId) {
  const subscribe = useCallback7(
    (listener) => subscribeBrowserOverlaySlotViewport(workspaceId, listener),
    [workspaceId]
  );
  const getSnapshot = useCallback7(() => getBrowserOverlaySlotViewport(workspaceId), [workspaceId]);
  return useSyncExternalStore2(subscribe, getSnapshot, () => null);
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-webview-lifecycle.ts
import {
  useCallback as useCallback8,
  useEffect as useEffect8,
  useLayoutEffect as useLayoutEffect4,
  useRef as useRef8,
  useState as useState4
} from "react";

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
  const [guestRecoveryGeneration, setGuestRecoveryGeneration] = useState4(0);
  const guestRecoveryPendingRef = useRef8(false);
  const validateVisibleGuestRegistrationRef = useRef8(() => {
  });
  const wasPaintableForGuestValidationRef = useRef8(isPaintable);
  const browserTabLoadingRef = useRef8(browserTabLoading);
  const inputLockedRef = useRef8(inputLocked);
  const faviconUrlRef = useRef8(faviconUrl);
  const initialBrowserUrlRef = useRef8(browserTabUrl);
  const addBrowserHistoryEntry = useBrowserStore((s) => s.addBrowserHistoryEntry);
  const addBrowserHistoryEntryRef = useRef8(addBrowserHistoryEntry);
  const isPaintableRef = useRef8(isPaintable);
  useLayoutEffect4(() => {
    browserTabLoadingRef.current = browserTabLoading;
    inputLockedRef.current = inputLocked;
    isPaintableRef.current = isPaintable;
  }, [browserTabLoading, inputLocked, isPaintable]);
  useLayoutEffect4(() => {
    const webview = webviewRef.current;
    if (webview) {
      setBrowserPageWebviewInputLock(webview, inputLocked);
    }
  }, [inputLocked, webviewRef]);
  useEffect8(() => {
    initialBrowserUrlRef.current = browserTabUrl;
  }, [browserTabId, browserTabUrl]);
  useEffect8(() => {
    browserTabUrlRef.current = browserTabUrl;
  }, [browserTabUrl, browserTabUrlRef]);
  useEffect8(() => {
    activeLoadFailureRef.current = browserTabLoadError;
  }, [activeLoadFailureRef, browserTabLoadError]);
  useEffect8(() => {
    onUpdatePageStateRef.current = onUpdatePageState;
    onSetUrlRef.current = onSetUrl;
    addBrowserHistoryEntryRef.current = addBrowserHistoryEntry;
  }, [onSetUrl, onUpdatePageState, addBrowserHistoryEntry, onSetUrlRef, onUpdatePageStateRef]);
  const syncNavigationState = useCallback8(
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
  useEffect8(() => {
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
  useEffect8(() => {
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
import { jsx as jsx18 } from "react/jsx-runtime";
function BrowserPagePane({
  browserTab,
  workspaceId,
  scopeId,
  sessionProfileId,
  sessionPartition,
  isActive,
  chromeShortcutScope,
  inputLocked,
  onUpdatePageState,
  onSetUrl
}) {
  const isPaintable = isBrowserPagePanePaintable({ isActive });
  const slotViewport = useBrowserPageSlotViewport(workspaceId);
  ensureBrowserPageViewport(browserTab.id, workspaceId);
  const chromeHeaderRef = useRef9(null);
  const webviewRef = useRef9(null);
  const addressBarInputRef = useRef9(null);
  const dismissAddressBarSuggestionsRef = useRef9(null);
  const addressBarValueRef = useRef9(toDisplayUrl(browserTab.url));
  const browserTabUrlRef = useRef9(browserTab.url);
  const lastKnownWebviewUrlRef = useRef9(null);
  const trackNextLoadingEventRef = useRef9(false);
  const recoveryNavigationValidationRef = useRef9(
    null
  );
  const activeLoadFailureRef = useRef9(browserTab.loadError);
  const retryGuestRecoveryRef = useRef9(() => {
  });
  const onUpdatePageStateRef = useRef9(onUpdatePageState);
  const onSetUrlRef = useRef9(onSetUrl);
  const isActiveRef = useRef9(isActive);
  useLayoutEffect5(() => {
    isActiveRef.current = isActive;
  }, [isActive]);
  const paneZoomLevelRef = useRef9(DEFAULT_BROWSER_PAGE_ZOOM_LEVEL);
  const handleInternalFileDragOverRef = useRef9(() => {
  });
  const handleInternalFileDropRef = useRef9(() => {
  });
  const setFindOpen = useCallback9(() => {
  }, []);
  const setBrowserZoomPercent = useCallback9(() => {
  }, []);
  const setBrowserDefaultZoomLevel = useCallback9(() => {
  }, []);
  const showBrowserZoomFeedback = useCallback9(() => {
  }, []);
  const setResourceNotice = useCallback9(() => {
  }, []);
  const [addressBarValue, setAddressBarValue] = useState5(() => toDisplayUrl(browserTab.url));
  useEffect9(() => {
    if (document.activeElement === addressBarInputRef.current) {
      return;
    }
    setAddressBarValue(toDisplayUrl(browserTab.url));
  }, [browserTab.url]);
  useEffect9(() => {
    addressBarValueRef.current = addressBarValue;
  }, [addressBarValue]);
  const guestFocus = useWebviewGuestFocus(webviewRef);
  const {
    focusAddressBarNow,
    focusGuestNow: focusWebviewNow,
    keepAddressBarFocusRef
  } = useBrowserPageChromeFocus({
    browserTabId: browserTab.id,
    workspaceId,
    isActive,
    chromeShortcutScope,
    addressBarInputRef,
    guestFocus
  });
  const navigateToUrl = useCallback9(
    (url) => {
      navigateBrowserPageToUrl({
        url,
        browserTabId: browserTab.id,
        activeLoadFailureRef,
        lastKnownWebviewUrlRef,
        trackNextLoadingEventRef,
        recoveryNavigationValidationRef,
        webviewRef,
        onSetUrlRef,
        onUpdatePageStateRef,
        setAddressBarValue,
        setResourceNotice,
        focusWebviewNow
      });
    },
    [browserTab.id, focusWebviewNow, setResourceNotice]
  );
  const submitAddressBar = () => {
    keepAddressBarFocusRef.current = false;
    const submission = resolveBrowserAddressBarSubmission(addressBarValue);
    if (submission.status === "invalid") {
      onUpdatePageStateRef.current(browserTab.id, { loadError: submission.loadError });
      return;
    }
    navigateToUrl(submission.url);
  };
  const webviewPartition = useBrowserPageWebviewPartition({ sessionProfileId, sessionPartition });
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
  useBrowserPageWebviewUrlSync({
    browserTabId: browserTab.id,
    browserTabUrl: browserTab.url,
    browserTabLoading: browserTab.loading,
    isActive,
    isPaintable,
    slotViewport,
    webviewRef,
    chromeHeaderRef,
    lastKnownWebviewUrlRef,
    trackNextLoadingEventRef,
    keepAddressBarFocusRef,
    addressBarInputRef,
    browserTabUrlRef,
    addressBarValueRef,
    onUpdatePageStateRef,
    focusWebviewNow
  });
  const reload = useBrowserPageReloadActions({
    browserTab,
    webviewRef,
    trackNextLoadingEventRef,
    retryGuestRecoveryRef,
    onUpdatePageStateRef
  });
  useBrowserPageKeyboardShortcuts({
    browserTabId: browserTab.id,
    workspaceId,
    isActive,
    chromeShortcutScope,
    isActiveRef,
    webviewRef,
    paneZoomLevelRef,
    setBrowserDefaultZoomLevel,
    showBrowserZoomFeedback,
    reloadWebviewOrRecoverGuest: reload.reloadWebviewOrRecoverGuest
  });
  const liveBrowserUrl = getLiveBrowserUrl(browserTab.id) ?? browserTab.url;
  return /* @__PURE__ */ jsx18(
    "div",
    {
      "data-browser-page-pane-id": browserTab.id,
      className: cn(
        "absolute inset-0 flex min-h-0 flex-1 flex-col",
        isActive ? "pointer-events-none z-10" : isPaintable ? "pointer-events-none z-0 opacity-0" : "pointer-events-none hidden"
      ),
      inert: !isActive,
      "aria-hidden": !isActive,
      children: /* @__PURE__ */ jsx18(
        BrowserPageChromeHeader,
        {
          chromeHeaderRef,
          browserTab,
          webviewRef,
          addressBarInputRef,
          dismissAddressBarSuggestionsRef,
          reload,
          addressBarValue,
          setAddressBarValue,
          submitAddressBar,
          navigateToUrl,
          currentUrl: liveBrowserUrl
        }
      )
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/DeferredBrowserContent.tsx
import { useLayoutEffect as useLayoutEffect6, useState as useState6 } from "react";
import { Fragment as Fragment2, jsx as jsx19 } from "react/jsx-runtime";
function DeferredBrowserContent({
  mountEligible,
  retainMounted = true,
  children
}) {
  const [hasCommittedMount, setHasCommittedMount] = useState6(false);
  useLayoutEffect6(() => {
    if (!retainMounted) {
      setHasCommittedMount(false);
    } else if (mountEligible && !hasCommittedMount) {
      setHasCommittedMount(true);
    }
  }, [hasCommittedMount, mountEligible, retainMounted]);
  return mountEligible || retainMounted && hasCommittedMount ? /* @__PURE__ */ jsx19(Fragment2, { children }) : null;
}

// src/renderer/components/browser-pane/assemble-chrome/browser-workspace-pane.tsx
import { jsx as jsx20, jsxs as jsxs11 } from "react/jsx-runtime";
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
  const browserPageIds = useMemo5(() => browserPages.map((page) => page.id), [browserPages]);
  const hasAdmittedPage = useAnyBrowserPageMountAdmission(browserPageIds);
  return /* @__PURE__ */ jsxs11("div", { className: "relative flex h-full min-h-0 flex-1 flex-col", children: [
    browserPages.length >= 2 ? /* @__PURE__ */ jsx20(
      BrowserPageStrip,
      {
        pages: browserPages,
        activePageId: activeBrowserPage?.id ?? null,
        onSelect: (pageId) => setActiveBrowserPage(scopeId, pageId),
        onClose: closeBrowserPage
      }
    ) : null,
    /* @__PURE__ */ jsx20("div", { className: "relative flex min-h-0 flex-1", children: browserPages.map((page) => /* @__PURE__ */ jsx20(
      DeferredBrowserContent,
      {
        retainMounted: isActive,
        mountEligible: isBrowserPagePanePaintable({
          isActive: isActive && page.id === activeBrowserPage?.id || hasAdmittedPage && isBrowserPageMountAdmitted(page.id)
        }),
        children: /* @__PURE__ */ jsx20(
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
import { Fragment as Fragment3, jsx as jsx21, jsxs as jsxs12 } from "react/jsx-runtime";
var BrowserOverlaySlot = memo(function BrowserOverlaySlot2({
  scopeId
}) {
  const isActive = useBrowserStore((state) => state.paneMountByScope[scopeId]?.active === true);
  const setSlotViewportRef = useCallback10(
    (node) => {
      registerBrowserOverlaySlotViewport(scopeId, node);
    },
    [scopeId]
  );
  const anchorName = browserScopeAnchorName(scopeId);
  const style = useMemo6(
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
  return /* @__PURE__ */ jsxs12(
    "div",
    {
      style,
      className: "min-h-0 flex-col",
      "data-orca-browser-scope-slot": scopeId,
      "data-orca-browser-anchor": anchorName,
      "data-browser-overlay-tab-id": scopeId,
      children: [
        /* @__PURE__ */ jsx21("div", { ref: setSlotViewportRef, className: "absolute inset-0 flex min-h-0 flex-col" }),
        /* @__PURE__ */ jsx21(DeferredBrowserContent, { mountEligible: isActive, children: /* @__PURE__ */ jsx21(browser_workspace_pane_default, { scopeId, isActive }) })
      ]
    }
  );
});
var BrowserPaneOverlayLayer = memo(function BrowserPaneOverlayLayer2() {
  const scopeIds = useBrowserStore(useShallow((state) => Object.keys(state.pagesByScope)));
  return /* @__PURE__ */ jsx21(Fragment3, { children: scopeIds.map((scopeId) => /* @__PURE__ */ jsx21(BrowserOverlaySlot, { scopeId }, scopeId)) });
});

// src/renderer/ipc/browser-state-ipc-bridge.ts
import { useEffect as useEffect10 } from "react";
function useBrowserStateIpcBridge() {
  useEffect10(() => {
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
  useEffect10(() => {
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
import { jsx as jsx22, jsxs as jsxs13 } from "react/jsx-runtime";
function BrowserPluginProvider(props) {
  const { host, children } = props;
  setBrowserRendererHost(host);
  useEffect11(() => {
    setBrowserRendererHost(host);
    return () => clearBrowserRendererHost(host);
  }, [host]);
  useBrowserStateIpcBridge();
  const hasBrowserApi = typeof window !== "undefined" && window.browserAPI !== void 0;
  return /* @__PURE__ */ jsxs13(BrowserRendererHostContext.Provider, { value: host, children: [
    children,
    hasBrowserApi ? /* @__PURE__ */ jsx22(BrowserPaneOverlayLayer, {}) : null
  ] });
}
export {
  BrowserPane,
  BrowserPluginProvider,
  useBrowserRendererHost
};
