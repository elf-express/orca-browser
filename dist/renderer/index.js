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
import { create as create2 } from "zustand";
import { persist } from "zustand/middleware";

// src/shared/constants.ts
var ORCA_BROWSER_PARTITION = "persist:orca-browser";
var ORCA_BROWSER_BLANK_URL = "data:text/html,";
var BROWSER_FAMILY_LABELS = {
  chrome: "Google Chrome",
  chromium: "Chromium",
  comet: "Comet",
  helium: "Helium",
  arc: "Arc",
  edge: "Microsoft Edge",
  brave: "Brave",
  firefox: "Firefox",
  safari: "Safari",
  manual: "File"
};

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
function isIpv4Loopback(hostname) {
  const octets = hostname.split(".");
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) {
    return false;
  }
  const values = octets.map(Number);
  return values[0] === 127 && values.every((value, index) => value >= 0 && value <= 255 && octets[index] === String(value));
}
function isEligibleLocalCertificateHost(hostname) {
  const normalized = normalizeCertificateHostname(hostname);
  if (normalized === "::1" || isIpv4Loopback(normalized)) {
    return true;
  }
  if (!isValidDnsName(normalized)) {
    return false;
  }
  return normalized === "localhost" || normalized.endsWith(".localhost");
}
function toHttpsRecoveryUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" || !isEligibleLocalCertificateHost(parsed.hostname)) {
      return null;
    }
    parsed.protocol = "https:";
    return parsed.toString();
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
function isFileUrl(url) {
  return url.trim().toLowerCase().startsWith("file:");
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
function scrollBrowserPageViewport(browserPageId, deltaX, deltaY) {
  const scroller = browserPageViewports.get(browserPageId)?.scroller;
  if (!scroller) {
    return;
  }
  scroller.scrollLeft += deltaX;
  scroller.scrollTop += deltaY;
}
function getBrowserPageViewportScrollState(browserPageId) {
  const scroller = browserPageViewports.get(browserPageId)?.scroller;
  if (!scroller) {
    return null;
  }
  return {
    scrollLeft: Math.max(0, scroller.scrollLeft),
    scrollTop: Math.max(0, scroller.scrollTop),
    maxScrollLeft: Math.max(0, scroller.scrollWidth - scroller.clientWidth),
    maxScrollTop: Math.max(0, scroller.scrollHeight - scroller.clientHeight)
  };
}
function subscribeBrowserPageViewportScroll(scroller, listener) {
  if (!scroller) {
    return () => {
    };
  }
  scroller.addEventListener("scroll", listener, { passive: true });
  return () => scroller.removeEventListener("scroll", listener);
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
function getExplicitBrowserPageZoomLevel(browserPageId) {
  return explicitPaneZoomLevels.get(browserPageId) ?? null;
}
function rememberExplicitBrowserPageZoomLevel(browserPageId, level) {
  explicitPaneZoomLevels.set(browserPageId, level);
}
function forgetExplicitBrowserPageZoomLevel(browserPageId) {
  explicitPaneZoomLevels.delete(browserPageId);
}
function getBrowserPageZoomIndicatorState({
  feedbackVisible
}) {
  return {
    ariaHidden: !feedbackVisible,
    opacityClassName: feedbackVisible ? "opacity-100" : "opacity-0"
  };
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

// src/renderer/store/browser-annotation-store.ts
import { create } from "zustand";

// src/shared/agent-payload.ts
var BROWSER_AGENT_IMAGE_NAMES = {
  grab: "browser-grab.png",
  markup: "browser-markup.png"
};
var SAFE_AGENT_URL_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:", "file:"]);
var PNG_DATA_URL_PREFIX = "data:image/png;base64,";
function sanitizeAgentPageUrl(rawUrl) {
  if (!rawUrl) {
    return "";
  }
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "about:") {
      return url.toString() === "about:blank" ? "about:blank" : "";
    }
    if (!SAFE_AGENT_URL_PROTOCOLS.has(url.protocol)) {
      return "";
    }
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}
function pngDataUrlToAgentImage(name, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    return null;
  }
  return { name, mimeType: "image/png", dataBase64: dataUrl.slice(PNG_DATA_URL_PREFIX.length) };
}

// src/shared/browser-grab-types.ts
var GRAB_BUDGET = {
  textSnippetMaxLength: 200,
  nearbyTextEntryMaxLength: 200,
  nearbyTextMaxEntries: 10,
  htmlSnippetMaxLength: 4096,
  ancestorPathMaxEntries: 10,
  nearbyElementsMaxEntries: 6,
  nearbyElementMaxLength: 160,
  selectorMaxLength: 700,
  pathMaxLength: 900,
  cssClassesMaxLength: 500,
  selectedTextMaxLength: 500,
  sourceFileMaxLength: 500,
  reactComponentsMaxLength: 500,
  annotationCommentMaxLength: 2e3,
  annotationsMaxPerPage: 20,
  /** Hard byte budget for screenshot PNG data URL before we omit the screenshot. */
  screenshotMaxBytes: 2 * 1024 * 1024
};

// src/renderer/store/browser-annotation-store.ts
function sanitizeBrowserPageAnnotation(annotation) {
  return {
    ...annotation,
    comment: annotation.comment.length > GRAB_BUDGET.annotationCommentMaxLength ? annotation.comment.slice(0, GRAB_BUDGET.annotationCommentMaxLength) : annotation.comment,
    payload: {
      ...annotation.payload,
      page: {
        ...annotation.payload.page,
        // The agent text embeds this URL, so a stored note never keeps a query or fragment.
        sanitizedUrl: sanitizeAgentPageUrl(annotation.payload.page.sanitizedUrl)
      },
      // Saved notes must not retain transient screenshot bytes.
      screenshot: null
    }
  };
}
function retainBrowserAnnotationMarkerIds(markersByPageId, pageId, annotations, addedId) {
  const existingIds = markersByPageId[pageId] ?? [];
  const retainedIds = new Set(annotations.map((annotation) => annotation.id));
  const nextIds = [...new Set(addedId ? [...existingIds, addedId] : existingIds)].filter(
    (id) => retainedIds.has(id)
  );
  if (nextIds.length === existingIds.length && nextIds.every((id, i) => id === existingIds[i])) {
    return markersByPageId;
  }
  const nextByPageId = { ...markersByPageId };
  if (nextIds.length > 0) {
    nextByPageId[pageId] = nextIds;
  } else {
    delete nextByPageId[pageId];
  }
  return nextByPageId;
}
function omitPageKey(record, pageId) {
  if (!Object.hasOwn(record, pageId)) {
    return record;
  }
  const next = { ...record };
  delete next[pageId];
  return next;
}
var useBrowserAnnotationStore = create()((set) => ({
  browserAnnotationsByPageId: {},
  browserAnnotationMarkerIdsByPageId: {},
  addBrowserPageAnnotation: (annotation) => set((s) => {
    const existing = s.browserAnnotationsByPageId[annotation.browserPageId] ?? [];
    const next = [...existing, sanitizeBrowserPageAnnotation(annotation)].slice(
      -GRAB_BUDGET.annotationsMaxPerPage
    );
    return {
      browserAnnotationsByPageId: {
        ...s.browserAnnotationsByPageId,
        [annotation.browserPageId]: next
      },
      browserAnnotationMarkerIdsByPageId: retainBrowserAnnotationMarkerIds(
        s.browserAnnotationMarkerIdsByPageId,
        annotation.browserPageId,
        next,
        annotation.id
      )
    };
  }),
  updateBrowserPageAnnotation: (pageId, annotationId, patch) => set((s) => {
    const existing = s.browserAnnotationsByPageId[pageId] ?? [];
    const target = existing.find((annotation) => annotation.id === annotationId);
    if (!target) {
      return s;
    }
    const updated = sanitizeBrowserPageAnnotation({ ...target, ...patch });
    return {
      browserAnnotationsByPageId: {
        ...s.browserAnnotationsByPageId,
        [pageId]: existing.map(
          (annotation) => annotation.id === annotationId ? updated : annotation
        )
      }
    };
  }),
  deleteBrowserPageAnnotation: (pageId, annotationId) => set((s) => {
    const existing = s.browserAnnotationsByPageId[pageId] ?? [];
    const next = existing.filter((annotation) => annotation.id !== annotationId);
    if (next.length === existing.length) {
      return s;
    }
    const nextByPageId = { ...s.browserAnnotationsByPageId };
    if (next.length > 0) {
      nextByPageId[pageId] = next;
    } else {
      delete nextByPageId[pageId];
    }
    return {
      browserAnnotationsByPageId: nextByPageId,
      browserAnnotationMarkerIdsByPageId: retainBrowserAnnotationMarkerIds(
        s.browserAnnotationMarkerIdsByPageId,
        pageId,
        next
      )
    };
  }),
  clearBrowserPageAnnotations: (pageId) => set((s) => {
    const notes = omitPageKey(s.browserAnnotationsByPageId, pageId);
    const markers = omitPageKey(s.browserAnnotationMarkerIdsByPageId, pageId);
    if (notes === s.browserAnnotationsByPageId && markers === s.browserAnnotationMarkerIdsByPageId) {
      return s;
    }
    return { browserAnnotationsByPageId: notes, browserAnnotationMarkerIdsByPageId: markers };
  }),
  invalidateBrowserPageAnnotationGeometry: (pageId) => set((s) => {
    const markers = omitPageKey(s.browserAnnotationMarkerIdsByPageId, pageId);
    return markers === s.browserAnnotationMarkerIdsByPageId ? s : { browserAnnotationMarkerIdsByPageId: markers };
  }),
  // Identity matching preserves edits and additions made during delivery.
  removeDeliveredBrowserPageAnnotations: (pageId, deliveredAnnotations) => set((s) => {
    const existing = s.browserAnnotationsByPageId[pageId] ?? [];
    const delivered = new Set(deliveredAnnotations);
    const remaining = existing.filter((note) => !delivered.has(note));
    if (remaining.length === existing.length) {
      return s;
    }
    const nextByPageId = { ...s.browserAnnotationsByPageId };
    if (remaining.length > 0) {
      nextByPageId[pageId] = remaining;
    } else {
      delete nextByPageId[pageId];
    }
    return {
      browserAnnotationsByPageId: nextByPageId,
      browserAnnotationMarkerIdsByPageId: retainBrowserAnnotationMarkerIds(
        s.browserAnnotationMarkerIdsByPageId,
        pageId,
        remaining
      )
    };
  }),
  disposeBrowserPageAnnotations: (pageId) => set((s) => {
    const notes = omitPageKey(s.browserAnnotationsByPageId, pageId);
    const markers = omitPageKey(s.browserAnnotationMarkerIdsByPageId, pageId);
    if (notes === s.browserAnnotationsByPageId && markers === s.browserAnnotationMarkerIdsByPageId) {
      return s;
    }
    return { browserAnnotationsByPageId: notes, browserAnnotationMarkerIdsByPageId: markers };
  })
}));

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
    title: url === ORCA_BROWSER_BLANK_URL ? translate("auto.components.browser.pane.BrowserPane.366bf5d62c", "New Tab") : url,
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: Date.now(),
    sessionProfileId: null,
    sessionPartition: null,
    viewportPresetId: null
  };
}
var useBrowserStore = create2()(
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
          releaseBrowserPageMount(pageId);
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
          useBrowserAnnotationStore.getState().disposeBrowserPageAnnotations(pageId);
        },
        setActiveBrowserPage: (scopeId, pageId) => {
          const pages = get().pagesByScope[scopeId] ?? [];
          if (!pages.some((page) => page.id === pageId)) {
            return;
          }
          set((state) => ({
            activePageIdByScope: {
              ...state.activePageIdByScope,
              [scopeId]: pageId
            }
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
            return {
              browserUrlHistory: [entry, ...others].slice(0, MAX_BROWSER_HISTORY_ENTRIES)
            };
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
        switchBrowserTabProfile: (pageId, profileId, partition) => {
          updatePage(pageId, (page) => ({
            ...page,
            sessionProfileId: profileId,
            sessionPartition: partition
          }));
        },
        setBrowserPageViewportPreset: (pageId, presetId) => {
          updatePage(pageId, (page) => ({ ...page, viewportPresetId: presetId }));
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
            return {
              paneMountByScope: { ...state.paneMountByScope, [scopeId]: mount }
            };
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
import { useEffect as useEffect30 } from "react";

// src/renderer/components/browser-pane/assemble-chrome/BrowserPaneOverlayLayer.tsx
import { memo, useCallback as useCallback23, useMemo as useMemo10 } from "react";
import { useShallow } from "zustand/react/shallow";

// src/renderer/components/browser-pane/assemble-chrome/browser-workspace-pane.tsx
import { useMemo as useMemo9 } from "react";

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
import { useCallback as useCallback22, useEffect as useEffect28, useLayoutEffect as useLayoutEffect10, useRef as useRef21, useState as useState23 } from "react";
import { createPortal as createPortal3 } from "react-dom";

// src/renderer/store/browser-session-store.ts
import { create as create3 } from "zustand";

// src/shared/browser-plugin-settings.ts
var DEFAULT_BROWSER_PLUGIN_SETTINGS = {
  searchEngine: DEFAULT_SEARCH_ENGINE,
  importHintHidden: false
};

// src/renderer/store/browser-session-store.ts
function errorReason(error) {
  return String(error?.message ?? error);
}
var useBrowserSessionStore = create3()((set, get) => {
  const runImport = async (profileId, run, options) => {
    set({ browserSessionImportState: { profileId, status: "importing" } });
    try {
      const result = await run();
      if (result.ok) {
        set({
          browserSessionImportState: { profileId, status: "success", summary: result.summary }
        });
        await get().fetchBrowserSessionProfiles().catch(() => {
        });
      } else if (options.canceledIsSilent && result.reason === "canceled") {
        set({ browserSessionImportState: null });
      } else {
        set({
          browserSessionImportState: { profileId, status: "error", error: result.reason }
        });
      }
      return result;
    } catch (error) {
      const reason = errorReason(error);
      set({ browserSessionImportState: { profileId, status: "error", error: reason } });
      return { ok: false, reason };
    }
  };
  return {
    browserSessionProfiles: [],
    detectedBrowsers: [],
    detectedBrowsersLoaded: false,
    browserSessionImportState: null,
    settings: { ...DEFAULT_BROWSER_PLUGIN_SETTINGS },
    settingsLoaded: false,
    identity: null,
    fetchBrowserSessionProfiles: async () => {
      try {
        const profiles = await window.browserAPI.session.listProfiles();
        set({ browserSessionProfiles: profiles });
      } catch {
      }
    },
    createBrowserSessionProfile: async (scope, label) => {
      try {
        const profile = await window.browserAPI.session.createProfile({ scope, label });
        if (profile) {
          set((state) => ({ browserSessionProfiles: [...state.browserSessionProfiles, profile] }));
        }
        return profile;
      } catch {
        return null;
      }
    },
    deleteBrowserSessionProfile: async (profileId) => {
      try {
        const deleted = await window.browserAPI.session.deleteProfile({ profileId });
        if (deleted) {
          set((state) => ({
            browserSessionProfiles: state.browserSessionProfiles.filter(
              (profile) => profile.id !== profileId
            )
          }));
        }
        return deleted;
      } catch {
        return false;
      }
    },
    fetchDetectedBrowsers: async () => {
      if (get().detectedBrowsersLoaded) {
        return;
      }
      try {
        const browsers = await window.browserAPI.session.detectBrowsers();
        set({ detectedBrowsers: browsers, detectedBrowsersLoaded: true });
      } catch {
        set({ detectedBrowsers: [], detectedBrowsersLoaded: true });
      }
    },
    importCookiesFromBrowser: (profileId, browserFamily, browserProfile) => runImport(
      profileId,
      () => window.browserAPI.session.importFromBrowser({
        profileId,
        browserFamily,
        browserProfile
      }),
      { canceledIsSilent: false }
    ),
    importCookiesToProfile: (profileId) => runImport(profileId, () => window.browserAPI.session.importCookies({ profileId }), {
      canceledIsSilent: true
    }),
    clearDefaultSessionCookies: async () => {
      try {
        const cleared = await window.browserAPI.session.clearDefaultCookies();
        if (cleared) {
          await get().fetchBrowserSessionProfiles();
        }
        return cleared;
      } catch {
        return false;
      }
    },
    loadSettings: async () => {
      try {
        const settings = await window.browserAPI.settings.get();
        set({ settings, settingsLoaded: true });
      } catch {
      }
    },
    updateSettings: async (patch) => {
      const previous = get().settings;
      set({ settings: { ...previous, ...patch } });
      try {
        const next = await window.browserAPI.settings.set(patch);
        set({ settings: next ?? previous });
      } catch {
        set({ settings: previous });
      }
    },
    loadIdentity: async () => {
      try {
        const identity = await window.browserAPI.identity.get();
        set({ identity });
      } catch {
      }
    },
    setIdentityMode: async (mode) => {
      const result = await window.browserAPI.identity.set(mode);
      if (result?.ok) {
        set({ identity: { identity: result.identity, migrationNotice: null } });
      }
      return result;
    }
  };
});

// src/renderer/components/browser-pane/navigate/browser-address-bar-navigation.ts
function resolveBrowserAddressBarSubmission(rawValue, options) {
  const url = normalizeBrowserNavigationUrl(
    rawValue,
    useBrowserSessionStore.getState().settings.searchEngine
  );
  const fileUrlUnsupported = options?.allowFileUrls !== true && Boolean(url) && url.startsWith("file:");
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
  if (!retryUrl || isFileUrl(retryUrl)) {
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
    if (isFileUrl(targetUrl)) {
      return;
    }
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
  // Fixed chord, not user-rebindable.
  "browser.annotateElement": {
    darwin: [{ mod: true, shift: true, key: "c" }],
    other: [{ alt: true, shift: true, key: "n" }]
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
    if (!normalizedUrl || isFileUrl(normalizedUrl)) {
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

// src/renderer/components/browser-pane/host-guest/use-browser-page-keyboard-shortcuts.ts
import { useEffect as useEffect4 } from "react";

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
import { useEffect as useEffect3 } from "react";
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
    const handleKeyDown = (e) => {
      const action = matchBrowserShortcutEvent(e);
      const direction = action === "zoom.in" ? "in" : action === "zoom.out" ? "out" : action === "zoom.reset" ? "reset" : null;
      if (direction === null || chromeShortcutScope === "inactive" || !browserChromeShortcutOwnsEvent(chromeShortcutScope, e, workspaceId)) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      applyActivePageZoom(direction);
    };
    const removeGuestListener = window.browserAPI.onZoomPage(handleZoom);
    const removeLocalListener = addBrowserPageZoomEventListener(handleZoom);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      removeGuestListener();
      removeLocalListener();
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    browserTabId,
    chromeShortcutScope,
    isActive,
    isActiveRef,
    paneZoomLevelRef,
    setBrowserDefaultZoomLevel,
    showBrowserZoomFeedback,
    webviewRef,
    workspaceId
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
  reloadWebviewOrRecoverGuest,
  grabIsInteractive = false,
  handleGrabActionShortcut
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
  useEffect4(() => {
    if (!isActive || !grabIsInteractive || !handleGrabActionShortcut) {
      return;
    }
    const handleKeyDown = (e) => {
      if (isEditableKeyboardTarget(e.target)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "s") {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      handleGrabActionShortcut(key);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [grabIsInteractive, handleGrabActionShortcut, isActive]);
  useEffect4(() => {
    if (!isActive || !grabIsInteractive || !handleGrabActionShortcut) {
      return;
    }
    return window.browserAPI.onGrabActionShortcut(({ browserPageId, key }) => {
      if (browserPageId === browserTabId) {
        handleGrabActionShortcut(key);
      }
    });
  }, [browserTabId, grabIsInteractive, handleGrabActionShortcut, isActive]);
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
import { useCallback as useCallback5, useEffect as useEffect7, useLayoutEffect as useLayoutEffect2, useMemo as useMemo3, useRef as useRef4, useState as useState2 } from "react";
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
function ImeTextarea(props) {
  const imeProps = useImeTextFieldProps(props);
  return /* @__PURE__ */ jsx4("textarea", { ...props, ...imeProps });
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
function PopoverAnchor(props) {
  return /* @__PURE__ */ jsx6(PopoverPrimitive.Anchor, { "data-slot": "popover-anchor", ...props });
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
import { useEffect as useEffect5 } from "react";
function useBrowserAddressBarDismissal(open, dismissSuggestions) {
  useEffect5(() => {
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
  const searchEngine = useBrowserSessionStore((s) => s.settings.searchEngine);
  const closingRef = useRef4(false);
  const addressBarClickSelect = useBrowserAddressBarClickSelect();
  const openedAtRef = useRef4(0);
  const blurCloseTimerRef = useRef4(null);
  const closingResetTimerRef = useRef4(null);
  const slotRef = useRef4(null);
  const [inlineWidth, setInlineWidth] = useState2(null);
  useEffect7(() => {
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
      searchEngine,
      value: autocompleteQuery
    }),
    [browserUrlHistory, autocompleteQuery, searchEngine]
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
  useEffect7(() => {
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
import { useRef as useRef7 } from "react";
import { Crosshair as Crosshair2, ExternalLink, MessageSquarePlus as MessageSquarePlus2, PenTool as PenTool2, SquareCode } from "lucide-react";

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
function DropdownMenuPortal({
  ...props
}) {
  return /* @__PURE__ */ jsx12(DropdownMenuPrimitive.Portal, { "data-slot": "dropdown-menu-portal", ...props });
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
function DropdownMenuRadioGroup({
  ...props
}) {
  return /* @__PURE__ */ jsx12(DropdownMenuPrimitive.RadioGroup, { "data-slot": "dropdown-menu-radio-group", ...props });
}
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs7(
    DropdownMenuPrimitive.RadioItem,
    {
      "data-slot": "dropdown-menu-radio-item",
      className: cn(
        "relative flex cursor-default items-center gap-2 rounded-md py-[4px] pr-2 pl-7 text-[12px] leading-[17px] font-[450] outline-hidden select-none focus:bg-black/8 dark:focus:bg-white/14 focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx12("span", { className: "pointer-events-none absolute left-2 flex size-3.5 items-center justify-center", children: /* @__PURE__ */ jsx12(DropdownMenuPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx12(CircleIcon, { className: "size-2 fill-current" }) }) }),
        children
      ]
    }
  );
}
function DropdownMenuLabel({
  className,
  inset,
  ...props
}) {
  return /* @__PURE__ */ jsx12(
    DropdownMenuPrimitive.Label,
    {
      "data-slot": "dropdown-menu-label",
      "data-inset": inset,
      className: cn(
        "px-2 py-[4px] text-[11px] font-semibold text-muted-foreground data-[inset]:pl-7",
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
function DropdownMenuSub({ ...props }) {
  return /* @__PURE__ */ jsx12(DropdownMenuPrimitive.Sub, { "data-slot": "dropdown-menu-sub", ...props });
}
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  hideChevron,
  ...props
}) {
  return /* @__PURE__ */ jsxs7(
    DropdownMenuPrimitive.SubTrigger,
    {
      "data-slot": "dropdown-menu-sub-trigger",
      "data-inset": inset,
      className: cn(
        "flex cursor-default items-center gap-2 rounded-md px-2 py-[4px] text-[12px] leading-[17px] font-[450] outline-hidden select-none focus:bg-black/8 dark:focus:bg-white/14 focus:text-accent-foreground data-[inset]:pl-7 data-[state=open]:bg-black/8 dark:data-[state=open]:bg-white/14 data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      ),
      ...props,
      children: [
        children,
        hideChevron ? null : /* @__PURE__ */ jsx12(ChevronRightIcon, { className: "ml-auto size-4" })
      ]
    }
  );
}
function DropdownMenuSubContent({
  className,
  style,
  ...props
}) {
  return /* @__PURE__ */ jsx12(DropdownMenuPrimitive.Portal, { children: /* @__PURE__ */ jsx12(
    DropdownMenuPrimitive.SubContent,
    {
      "data-slot": "dropdown-menu-sub-content",
      className: cn(
        "z-[70] min-w-[11rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-[11px] border border-black/14 bg-[rgba(255,255,255,0.82)] p-[4px] text-black dark:text-white shadow-[0_12px_28px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl dark:border-white/14 dark:bg-[rgba(0,0,0,0.72)] dark:shadow-[0_16px_34px_rgba(0,0,0,0.40),inset_0_1px_0_rgba(255,255,255,0.04)] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none data-[state=open]:fade-in-0 data-[state=open]:duration-150 data-[state=open]:zoom-in-[0.98]",
        className
      ),
      style: { ...style, WebkitAppRegion: "no-drag" },
      ...props,
      onEscapeKeyDown: (event) => handleImeOverlayEscape(event, props.onEscapeKeyDown)
    }
  ) });
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
        "aria-label": translate("auto.components.browser.toolbar.moreTools", "More tools"),
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

// src/renderer/components/browser-pane/assemble-chrome/browser-chrome-element-tool-buttons.tsx
import { Crosshair, MessageSquarePlus } from "lucide-react";
import { Fragment as Fragment2, jsx as jsx14, jsxs as jsxs9 } from "react/jsx-runtime";
function BrowserChromeElementToolButtons({
  tools,
  showGrab,
  showAnnotate
}) {
  return /* @__PURE__ */ jsxs9(Fragment2, { children: [
    showGrab ? /* @__PURE__ */ jsxs9(Tooltip, { children: [
      /* @__PURE__ */ jsx14(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx14("span", { className: "inline-flex", children: /* @__PURE__ */ jsx14(
        Button,
        {
          size: "icon",
          variant: tools.activeIntent === "copy" ? "default" : "ghost",
          className: cn(
            "h-8 w-8",
            tools.activeIntent === "copy" && "bg-foreground/80 text-background hover:bg-foreground/90"
          ),
          onClick: () => tools.onStartIntent("copy"),
          disabled: tools.disabled,
          "aria-label": translate(
            "auto.components.browser.pane.BrowserPane.fdfc7fe0ef",
            "Grab page element"
          ),
          children: /* @__PURE__ */ jsx14(Crosshair, { className: "size-4" })
        }
      ) }) }),
      /* @__PURE__ */ jsx14(TooltipContent, { side: "bottom", sideOffset: 4, children: translate(
        "auto.components.browser.pane.BrowserPane.acbe79fd01",
        "Grab page element ({{value0}})",
        { value0: tools.grabShortcutLabel }
      ) })
    ] }) : null,
    showAnnotate ? /* @__PURE__ */ jsxs9(Tooltip, { children: [
      /* @__PURE__ */ jsx14(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx14("span", { className: "inline-flex", children: /* @__PURE__ */ jsxs9(
        Button,
        {
          size: "icon",
          variant: tools.activeIntent === "annotate" ? "default" : "ghost",
          className: cn(
            "relative h-8 w-8",
            tools.activeIntent === "annotate" && "bg-foreground/80 text-background hover:bg-foreground/90"
          ),
          onClick: () => tools.onStartIntent("annotate"),
          disabled: tools.disabled,
          "aria-label": translate(
            "auto.components.browser.pane.BrowserPane.fc9be38f6f",
            "Annotate page element"
          ),
          children: [
            /* @__PURE__ */ jsx14(MessageSquarePlus, { className: "size-4" }),
            tools.annotationCount > 0 ? /* @__PURE__ */ jsx14("span", { className: "absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground", children: tools.annotationCount }) : null
          ]
        }
      ) }) }),
      /* @__PURE__ */ jsx14(TooltipContent, { side: "bottom", sideOffset: 4, children: tools.annotateShortcutLabel ? translate(
        "auto.components.browser.pane.BrowserPane.cc4a071d3a",
        "Annotate page element ({{value0}})",
        { value0: tools.annotateShortcutLabel }
      ) : translate(
        "auto.components.browser.pane.BrowserPane.fc9be38f6f",
        "Annotate page element"
      ) })
    ] }) : null
  ] });
}

// src/renderer/components/browser-pane/annotate/MarkupDrawButton.tsx
import { useEffect as useEffect8 } from "react";
import { PenTool } from "lucide-react";

// src/renderer/ui/badge.tsx
import { cva as cva4 } from "class-variance-authority";
import * as Slot2 from "radix-ui/slot";
import { jsx as jsx15 } from "react/jsx-runtime";
var badgeVariants = cva4(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        dot: "bg-background text-foreground border-border shadow-xs dark:bg-secondary dark:border-white/20",
        destructive: "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline: "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        /** The chip naming the machine a workspace runs on — quieter and squarer than `secondary`,
         *  so it reads as context beside a workspace name rather than as a status of its own. */
        hostContext: "h-4 rounded border-border bg-accent px-1.5 text-[10px] leading-none text-muted-foreground dark:border-border/50 dark:bg-accent/80",
        /** A skill or file sitting inline in the chat message box, ringed while selected. */
        promptPill: "max-w-full border-border bg-secondary px-1.5 py-0 align-baseline text-muted-foreground data-[selected=true]:ring-1 data-[selected=true]:ring-ring"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);
function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot2.Root : "span";
  return /* @__PURE__ */ jsx15(
    Comp,
    {
      "data-slot": "badge",
      "data-variant": variant,
      className: cn(badgeVariants({ variant }), className),
      ...props
    }
  );
}

// src/renderer/components/browser-pane/annotate/use-markup-draw-hint.ts
import { useCallback as useCallback6, useRef as useRef6, useSyncExternalStore as useSyncExternalStore2 } from "react";
var MARKUP_DRAW_HINT_SEEN_KEY = "orca.browser.markup-draw-hint-seen";
function claimFirstView() {
  try {
    if (window.localStorage.getItem(MARKUP_DRAW_HINT_SEEN_KEY) === "true") {
      return false;
    }
    window.localStorage.setItem(MARKUP_DRAW_HINT_SEEN_KEY, "true");
    return true;
  } catch {
    return false;
  }
}
function useMarkupDrawHint(eligible) {
  const hintOpenRef = useRef6(false);
  const notifyRef = useRef6(() => {
  });
  const subscribe = useCallback6(
    (notify) => {
      notifyRef.current = notify;
      const nextOpen = eligible && (hintOpenRef.current || claimFirstView());
      if (hintOpenRef.current !== nextOpen) {
        hintOpenRef.current = nextOpen;
        notify();
      }
      return () => {
        if (notifyRef.current === notify) {
          notifyRef.current = () => {
          };
        }
      };
    },
    [eligible]
  );
  const getSnapshot = useCallback6(() => hintOpenRef.current && eligible, [eligible]);
  const hintOpen = useSyncExternalStore2(subscribe, getSnapshot, () => false);
  const dismissHint = useCallback6(() => {
    hintOpenRef.current = false;
    notifyRef.current();
  }, []);
  return { hintOpen, dismissHint };
}

// src/renderer/components/browser-pane/annotate/MarkupDrawButton.tsx
import { jsx as jsx16, jsxs as jsxs10 } from "react/jsx-runtime";
function MarkupDrawButton({
  onClick,
  disabled,
  active,
  surfaceActive,
  className
}) {
  const label = translate("auto.components.browser-pane.markup.drawButton", "Draw on screenshot");
  const { hintOpen, dismissHint } = useMarkupDrawHint(surfaceActive && !disabled && !active);
  const showHint = hintOpen && surfaceActive;
  useEffect8(() => {
    if (!showHint) {
      return;
    }
    window.addEventListener("blur", dismissHint);
    return () => window.removeEventListener("blur", dismissHint);
  }, [dismissHint, showHint]);
  const startMarkup = () => {
    dismissHint();
    onClick();
  };
  const button = /* @__PURE__ */ jsx16(
    Button,
    {
      size: "icon",
      variant: active ? "default" : "ghost",
      className: cn(
        className ?? "h-8 w-8",
        active && "bg-foreground/80 text-background hover:bg-foreground/90",
        // Why: soft ring while the discovery callout is open — points at the
        // control without the harsh solid highlight of a force-open tooltip.
        showHint && "ring-2 ring-ring/45 ring-offset-1 ring-offset-background"
      ),
      onClick: startMarkup,
      disabled,
      "aria-label": label,
      "aria-pressed": active,
      children: /* @__PURE__ */ jsx16(PenTool, { className: "size-4" })
    }
  );
  return /* @__PURE__ */ jsxs10(
    Popover,
    {
      modal: false,
      open: showHint,
      onOpenChange: (open) => {
        if (!open) {
          dismissHint();
        }
      },
      children: [
        /* @__PURE__ */ jsxs10(Tooltip, { children: [
          /* @__PURE__ */ jsx16(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx16(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsx16("span", { className: "inline-flex", children: button }) }) }),
          /* @__PURE__ */ jsx16(TooltipContent, { side: "bottom", sideOffset: 4, children: label })
        ] }),
        /* @__PURE__ */ jsx16(
          PopoverContent,
          {
            side: "bottom",
            align: "center",
            sideOffset: 6,
            className: "w-72 p-3",
            onOpenAutoFocus: (event) => {
              event.preventDefault();
            },
            children: /* @__PURE__ */ jsxs10("div", { className: "space-y-3", children: [
              /* @__PURE__ */ jsxs10("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ jsxs10("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx16(
                    Badge,
                    {
                      variant: "secondary",
                      className: "h-5 shrink-0 px-1.5 text-[10px] font-semibold tracking-wider uppercase",
                      children: translate("auto.components.browser-pane.markup.drawHintBadge", "New")
                    }
                  ),
                  /* @__PURE__ */ jsx16("div", { className: "text-sm font-medium text-foreground", children: label })
                ] }),
                /* @__PURE__ */ jsx16("p", { className: "text-xs leading-5 text-muted-foreground", children: translate(
                  "auto.components.browser-pane.markup.drawHint",
                  "Draw on the page, then copy the markup to paste into your agent."
                ) })
              ] }),
              /* @__PURE__ */ jsxs10("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsxs10(
                  Button,
                  {
                    type: "button",
                    size: "sm",
                    className: "h-7 gap-1.5 px-2.5 text-xs",
                    onClick: startMarkup,
                    children: [
                      /* @__PURE__ */ jsx16(PenTool, { className: "size-3.5" }),
                      translate("auto.components.browser-pane.markup.drawHintTry", "Try it")
                    ]
                  }
                ),
                /* @__PURE__ */ jsx16(
                  "button",
                  {
                    type: "button",
                    onClick: dismissHint,
                    className: "rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                    children: translate("auto.components.browser-pane.markup.drawHintDismiss", "Got it")
                  }
                )
              ] })
            ] })
          }
        )
      ]
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/browser-chrome-toolbar.tsx
import { jsx as jsx17, jsxs as jsxs11 } from "react/jsx-runtime";
function BrowserChromeActionButton({
  action,
  icon: Icon2
}) {
  return /* @__PURE__ */ jsx17(
    Button,
    {
      size: "icon",
      variant: "ghost",
      className: "h-7 w-7",
      onClick: action.onSelect,
      title: action.label,
      "aria-label": action.label,
      disabled: action.disabled,
      children: /* @__PURE__ */ jsx17(Icon2, { className: "size-4" })
    }
  );
}
function BrowserChromeToolbar({
  controls,
  addressSlot,
  reloadControl,
  reloadLabel,
  importControl = null,
  elementTools = null,
  markup = null,
  viewSource,
  openExternal,
  overflowMenu = null,
  showTourAnchors = false,
  pinnedStage
}) {
  const rowRef = useRef7(null);
  const overflowTriggerRef = useRef7(null);
  const present = {
    "import-label": importControl != null,
    import: importControl != null,
    external: openExternal !== null,
    devtools: viewSource !== null,
    share: false,
    draw: markup !== null,
    grab: elementTools !== null,
    annotate: elementTools !== null
  };
  const stages = BROWSER_CHROME_FOLD_ORDER.filter(
    (stage) => present[stage] && stage !== pinnedStage
  );
  const folded = useBrowserChromeToolFold(rowRef, stages);
  const afterMenuCloseRef = useRef7(null);
  const foldedTools = [];
  if (elementTools && folded.has("grab")) {
    foldedTools.push({
      stage: "grab",
      label: translate("auto.components.browser.pane.BrowserPane.fdfc7fe0ef", "Grab page element"),
      icon: Crosshair2,
      onSelect: () => elementTools.onStartIntent("copy"),
      disabled: elementTools.disabled,
      shortcut: elementTools.grabShortcutLabel,
      active: elementTools.activeIntent === "copy"
    });
  }
  if (elementTools && folded.has("annotate")) {
    foldedTools.push({
      stage: "annotate",
      label: translate(
        "auto.components.browser.pane.BrowserPane.fc9be38f6f",
        "Annotate page element"
      ),
      icon: MessageSquarePlus2,
      onSelect: () => elementTools.onStartIntent("annotate"),
      disabled: elementTools.disabled,
      shortcut: elementTools.annotateShortcutLabel,
      count: elementTools.annotationCount,
      active: elementTools.activeIntent === "annotate"
    });
  }
  if (markup && folded.has("draw")) {
    foldedTools.push({
      stage: "draw",
      label: translate("auto.components.browser-pane.markup.drawButton", "Draw on screenshot"),
      icon: PenTool2,
      onSelect: markup.onToggle,
      disabled: markup.disabled,
      active: markup.active
    });
  }
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
  const showFoldedAnnotationDot = folded.has("annotate") && (elementTools?.annotationCount ?? 0) > 0;
  const overflowProps = {
    triggerRef: overflowTriggerRef,
    tools: foldedTools,
    deferUntilClose: runAfterMenuClose,
    onMenuCloseAutoFocus
  };
  return /* @__PURE__ */ jsxs11(
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
        elementTools ? /* @__PURE__ */ jsx17(
          BrowserChromeElementToolButtons,
          {
            tools: elementTools,
            showGrab: !folded.has("grab"),
            showAnnotate: !folded.has("annotate")
          }
        ) : null,
        markup && !folded.has("draw") ? /* @__PURE__ */ jsx17(
          MarkupDrawButton,
          {
            onClick: markup.onToggle,
            disabled: markup.disabled,
            active: markup.active,
            surfaceActive: markup.canShowDiscoveryHint
          }
        ) : null,
        viewSource && !folded.has("devtools") ? /* @__PURE__ */ jsx17(BrowserChromeActionButton, { action: viewSource, icon: SquareCode }) : null,
        openExternal && !folded.has("external") ? /* @__PURE__ */ jsx17(BrowserChromeActionButton, { action: openExternal, icon: ExternalLink }) : null,
        /* @__PURE__ */ jsxs11("span", { className: "relative inline-flex", children: [
          overflowMenu ? (
            // oxlint-disable-next-line react/refs -- Intentional: overflowProps carries a ref object and closures that touch refs only from event handlers.
            overflowMenu(overflowProps)
          ) : /* @__PURE__ */ jsx17(BrowserChromeDefaultOverflowMenu, { ...overflowProps }),
          showFoldedAnnotationDot ? /* @__PURE__ */ jsx17("span", { className: "pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-primary ring-2 ring-background" }) : null
        ] })
      ]
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/browser-reload-control.tsx
import { Loader2 as Loader22, RefreshCw as RefreshCw2 } from "lucide-react";
import { jsx as jsx18, jsxs as jsxs12 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs12(DropdownMenu, { modal: false, open: menuOpen, onOpenChange: onMenuOpenChange, children: [
    /* @__PURE__ */ jsxs12(Tooltip, { open: menuOpen ? false : void 0, children: [
      /* @__PURE__ */ jsx18(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx18(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx18(
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
          children: loading ? /* @__PURE__ */ jsx18(Loader22, { className: "size-4 animate-spin" }) : /* @__PURE__ */ jsx18(RefreshCw2, { className: "size-4" })
        }
      ) }) }),
      /* @__PURE__ */ jsxs12(TooltipContent, { side: "bottom", sideOffset: 4, children: [
        label,
        reloadShortcut && showShortcutHint ? ` \xB7 ${reloadShortcut}` : ""
      ] })
    ] }),
    /* @__PURE__ */ jsxs12(DropdownMenuContent, { align: "start", alignOffset: -4, children: [
      /* @__PURE__ */ jsxs12(DropdownMenuItem, { onClick: onReload, children: [
        translate("auto.components.browser.pane.BrowserPane.0e080d820e", "Reload"),
        /* @__PURE__ */ jsx18(DropdownMenuShortcut, { children: reloadShortcut })
      ] }),
      /* @__PURE__ */ jsxs12(DropdownMenuItem, { onClick: onHardReload, children: [
        translate("auto.components.browser.pane.BrowserPane.a1f3c2e4b5", "Hard Reload"),
        /* @__PURE__ */ jsx18(DropdownMenuShortcut, { children: hardReloadShortcut })
      ] })
    ] })
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserImportHintButton.tsx
import { useCallback as useCallback7, useEffect as useEffect11, useMemo as useMemo4, useState as useState8 } from "react";
import { Import as Import2 } from "lucide-react";
import { toast as toast4 } from "sonner";

// src/renderer/lib/browser-cookie-import-toast.ts
import { toast } from "sonner";

// src/shared/handled-wire-discriminant.ts
function isHandledWireDiscriminant(value, handled) {
  return typeof value === "string" && Object.hasOwn(handled, value);
}

// src/renderer/lib/browser-cookie-import-toast.ts
var HANDLED_WARNING_CODES = {
  "restart-fallback-unavailable": true,
  "cookies-undecryptable": true
};
var HANDLED_UNDECRYPTABLE_REASONS = {
  "app-bound-encryption": true,
  "linux-keyring-unavailable": true,
  unknown: true
};
function formatCookieImportWarning(warning) {
  const code = warning.code;
  if (!isHandledWireDiscriminant(code, HANDLED_WARNING_CODES)) {
    return translate(
      "auto.lib.browser.cookie.import.toast.unrecognizedWarning",
      "The cookie import finished with a warning this version of Orca does not recognize. Update Orca to see the details, then check this profile before relying on its cookies."
    );
  }
  switch (warning.code) {
    case "restart-fallback-unavailable":
      return warning.loadedCookies === 0 ? translate(
        "auto.lib.browser.cookie.import.toast.restartFallbackUnavailableNone",
        "None of the {{value0}} cookies could be loaded, and the restart fallback was unavailable. The previous cookies for this profile were replaced. Try the import again.",
        { value0: warning.failedCookies }
      ) : translate(
        "auto.lib.browser.cookie.import.toast.restartFallbackUnavailablePartial",
        "Imported {{value0}} of {{value1}} cookies. The rest could not be loaded, and the restart fallback was unavailable. Try the import again.",
        {
          value0: warning.loadedCookies,
          value1: warning.loadedCookies + warning.failedCookies
        }
      );
    case "cookies-undecryptable": {
      const reason = warning.reason;
      if (!isHandledWireDiscriminant(reason, HANDLED_UNDECRYPTABLE_REASONS)) {
        return translate(
          "auto.lib.browser.cookie.import.toast.undecryptableUnrecognizedReason",
          "{{value0}} cookies could not be decrypted and were skipped for a reason this version of Orca does not recognize. Update Orca to see the details, then try the import again.",
          { value0: warning.failedCookies }
        );
      }
      switch (warning.reason) {
        case "app-bound-encryption":
          return warning.otherFailedCookies ? translate(
            "auto.lib.browser.cookie.import.toast.undecryptableAppBoundMixed",
            "Orca cannot decrypt {{value0}} of this browser's cookies because they use app-bound encryption; {{value1}} more could not be decrypted for another reason. You can import cookies from a file using \u201CFrom File\u2026\u201D.",
            { value0: warning.failedCookies, value1: warning.otherFailedCookies }
          ) : translate(
            "auto.lib.browser.cookie.import.toast.undecryptableAppBound",
            "Orca cannot decrypt {{value0}} of this browser's cookies because they use app-bound encryption. You can import cookies from a file using \u201CFrom File\u2026\u201D.",
            { value0: warning.failedCookies }
          );
        case "linux-keyring-unavailable":
          return warning.otherFailedCookies ? translate(
            "auto.lib.browser.cookie.import.toast.undecryptableKeyringMixed",
            "{{value0}} cookies could not be decrypted because the system keyring was unavailable; {{value1}} more could not be decrypted for another reason. Unlock your login keyring (or install a Secret Service provider such as gnome-keyring) and import again.",
            { value0: warning.failedCookies, value1: warning.otherFailedCookies }
          ) : translate(
            "auto.lib.browser.cookie.import.toast.undecryptableKeyring",
            "{{value0}} cookies could not be decrypted because the system keyring was unavailable. Unlock your login keyring (or install a Secret Service provider such as gnome-keyring) and import again.",
            { value0: warning.failedCookies }
          );
        case "unknown":
          return translate(
            "auto.lib.browser.cookie.import.toast.undecryptableUnknown",
            "{{value0}} cookies could not be decrypted and were skipped. Close the source browser completely and try the import again.",
            { value0: warning.failedCookies }
          );
      }
    }
  }
}
function emitGoogleCookieImportWarning(summary) {
  if (!summary.googleCookiesSkipped) {
    return;
  }
  toast.warning(
    translate(
      "auto.lib.browser.cookie.import.toast.googleCookiesSkippedLocal",
      "Google cookies were not imported. Open a browser in Orca with this profile, then sign into Google."
    ),
    { duration: 12e3 }
  );
}
function emitPartitionSkippedImportWarning(summary) {
  if (!summary.partitionSkippedCookies) {
    return;
  }
  toast.warning(
    translate(
      "auto.lib.browser.cookie.import.toast.partitionSkipped",
      "{{value0}} cookies were not imported because their site-partition could not be read. Sign in to those sites again in Orca.",
      { value0: summary.partitionSkippedCookies }
    ),
    { duration: 12e3 }
  );
}
function emitBrowserCookieImportToast(summary, successMessage) {
  const warning = summary.warning;
  if (warning) {
    toast.warning(formatCookieImportWarning(warning));
  } else {
    toast.success(successMessage);
  }
  emitGoogleCookieImportWarning(summary);
  emitPartitionSkippedImportWarning(summary);
}

// src/renderer/components/BrowserCookieImportDisclosure.tsx
import { Info } from "lucide-react";
import { Fragment as Fragment3, jsx as jsx19, jsxs as jsxs13 } from "react/jsx-runtime";
function BrowserCookieImportDisclosure() {
  return /* @__PURE__ */ jsxs13(Fragment3, { children: [
    /* @__PURE__ */ jsx19(DropdownMenuSeparator, {}),
    /* @__PURE__ */ jsxs13(DropdownMenuLabel, { className: "flex max-w-64 items-start gap-2 whitespace-normal py-2 font-normal", children: [
      /* @__PURE__ */ jsx19(Info, { "aria-hidden": true, className: "mt-0.5 size-3.5 shrink-0" }),
      /* @__PURE__ */ jsxs13("span", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx19("span", { className: "block font-medium leading-4 text-foreground", children: translate(
          "auto.components.BrowserCookieImportDisclosure.title",
          "Google logins aren't imported"
        ) }),
        /* @__PURE__ */ jsx19("span", { className: "block leading-4 text-muted-foreground", children: translate(
          "auto.components.BrowserCookieImportDisclosure.description",
          "Sign in to Google directly in Orca."
        ) })
      ] })
    ] })
  ] });
}

// src/renderer/ui/dialog.tsx
import { cva as cva5 } from "class-variance-authority";
import { Minus, XIcon } from "lucide-react";
import * as DialogPrimitive2 from "radix-ui/dialog";
import { jsx as jsx20, jsxs as jsxs14 } from "react/jsx-runtime";
function Dialog({ ...props }) {
  return /* @__PURE__ */ jsx20(DialogPrimitive2.Root, { "data-slot": "dialog", ...props });
}
function DialogPortal({ ...props }) {
  return /* @__PURE__ */ jsx20(DialogPrimitive2.Portal, { "data-slot": "dialog-portal", ...props });
}
function DialogOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx20(
    DialogPrimitive2.Overlay,
    {
      "data-slot": "dialog-overlay",
      className: cn(
        "fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      ),
      ...props
    }
  );
}
var dialogContentSurfaceVariants = cva5("", {
  variants: {
    surface: {
      default: "",
      /** The tinted, edge-to-edge panel of the two-column feature tip dialogs. */
      "feature-tip": "gap-0 bg-[color-mix(in_srgb,var(--foreground)_8%,var(--background))] p-0 dark:bg-[color-mix(in_srgb,var(--foreground)_16%,var(--background))]"
    }
  },
  defaultVariants: { surface: "default" }
});
function DialogContentCloseButton({ variant }) {
  const label = variant === "minimize" ? translate("auto.components.ui.dialog.minimize", "Minimize") : translate("auto.components.ui.dialog.f26c4baeda", "Close");
  const button = /* @__PURE__ */ jsxs14(
    DialogPrimitive2.Close,
    {
      "data-slot": "dialog-close",
      className: "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      children: [
        variant === "minimize" ? /* @__PURE__ */ jsx20(Minus, { className: "size-3.5" }) : /* @__PURE__ */ jsx20(XIcon, {}),
        /* @__PURE__ */ jsx20("span", { className: "sr-only", children: label })
      ]
    }
  );
  return variant === "minimize" ? /* @__PURE__ */ jsxs14(Tooltip, { children: [
    /* @__PURE__ */ jsx20(TooltipTrigger, { asChild: true, children: button }),
    /* @__PURE__ */ jsx20(TooltipContent, { side: "top", sideOffset: 4, children: label })
  ] }) : button;
}
function DialogContent({
  className,
  children,
  overlayClassName,
  showCloseButton = true,
  closeButtonVariant = "close",
  surface,
  ...props
}) {
  return /* @__PURE__ */ jsxs14(DialogPortal, { "data-slot": "dialog-portal", children: [
    /* @__PURE__ */ jsx20(DialogOverlay, { className: overlayClassName }),
    /* @__PURE__ */ jsxs14(
      DialogPrimitive2.Content,
      {
        "data-slot": "dialog-content",
        className: cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] grid-cols-[minmax(0,1fr)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-black/14 bg-background/96 p-6 text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl duration-200 outline-none dark:border-white/14 dark:bg-[rgba(23,23,23,0.96)] dark:shadow-[0_24px_72px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          dialogContentSurfaceVariants({ surface }),
          className
        ),
        ...props,
        onEscapeKeyDown: (event) => handleImeOverlayEscape(event, props.onEscapeKeyDown),
        children: [
          children,
          showCloseButton && /* @__PURE__ */ jsx20(DialogContentCloseButton, { variant: closeButtonVariant })
        ]
      }
    )
  ] });
}
function DialogHeader({ className, ...props }) {
  return /* @__PURE__ */ jsx20(
    "div",
    {
      "data-slot": "dialog-header",
      className: cn("flex flex-col gap-2 text-center sm:text-left", className),
      ...props
    }
  );
}
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs14(
    "div",
    {
      "data-slot": "dialog-footer",
      className: cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className),
      ...props,
      children: [
        children,
        showCloseButton && /* @__PURE__ */ jsx20(DialogPrimitive2.Close, { asChild: true, children: /* @__PURE__ */ jsx20(Button, { variant: "outline", children: translate("auto.components.ui.dialog.f26c4baeda", "Close") }) })
      ]
    }
  );
}
function DialogTitle({
  className,
  size = "default",
  ...props
}) {
  return /* @__PURE__ */ jsx20(
    DialogPrimitive2.Title,
    {
      "data-slot": "dialog-title",
      "data-size": size,
      className: cn(
        "text-lg leading-snug font-semibold break-words data-[size=display]:text-2xl data-[size=display]:leading-tight data-[size=display]:tracking-tight md:data-[size=display]:text-[1.75rem]",
        className
      ),
      ...props
    }
  );
}
function DialogDescription({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx20(
    DialogPrimitive2.Description,
    {
      "data-slot": "dialog-description",
      className: cn("text-sm text-muted-foreground", className),
      ...props
    }
  );
}

// src/renderer/components/settings/BrowserSettingsPanel.tsx
import { useEffect as useEffect10, useState as useState7 } from "react";

// src/renderer/components/settings/BrowserNewProfileDialog.tsx
import { useState as useState4 } from "react";
import { toast as toast2 } from "sonner";

// src/renderer/hooks/useMountedRef.ts
import { useEffect as useEffect9, useRef as useRef8 } from "react";
function useMountedRef() {
  const mountedRef = useRef8(true);
  useEffect9(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}

// src/renderer/components/settings/BrowserNewProfileDialog.tsx
import { jsx as jsx21, jsxs as jsxs15 } from "react/jsx-runtime";
function BrowserNewProfileDialog({
  open,
  onOpenChange
}) {
  const mountedRef = useMountedRef();
  const [newProfileName, setNewProfileName] = useState4("");
  const [isCreatingProfile, setIsCreatingProfile] = useState4(false);
  const handleClose = () => {
    onOpenChange(false);
    setNewProfileName("");
  };
  return /* @__PURE__ */ jsx21(
    Dialog,
    {
      open,
      onOpenChange: (nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      },
      children: /* @__PURE__ */ jsxs15(DialogContent, { className: "sm:max-w-sm", showCloseButton: false, children: [
        /* @__PURE__ */ jsx21(DialogHeader, { children: /* @__PURE__ */ jsx21(DialogTitle, { className: "text-base", children: translate("auto.components.settings.BrowserPane.8481ee0331", "New Browser Profile") }) }),
        /* @__PURE__ */ jsxs15(
          "form",
          {
            onSubmit: async (e) => {
              e.preventDefault();
              const trimmed = newProfileName.trim();
              if (!trimmed) {
                return;
              }
              setIsCreatingProfile(true);
              try {
                const profile = await useBrowserSessionStore.getState().createBrowserSessionProfile("isolated", trimmed);
                if (!mountedRef.current) {
                  return;
                }
                if (profile) {
                  handleClose();
                  toast2.success(
                    translate(
                      "auto.components.settings.BrowserPane.8f22b7580d",
                      'Profile "{{value0}}" created.',
                      { value0: profile.label }
                    )
                  );
                } else {
                  toast2.error(
                    translate(
                      "auto.components.settings.BrowserPane.612f7f6861",
                      "Failed to create profile."
                    )
                  );
                }
              } finally {
                if (mountedRef.current) {
                  setIsCreatingProfile(false);
                }
              }
            },
            children: [
              /* @__PURE__ */ jsx21(
                Input,
                {
                  value: newProfileName,
                  onChange: (e) => setNewProfileName(e.target.value),
                  placeholder: translate(
                    "auto.components.settings.BrowserPane.7d4c0a2aa4",
                    "Profile name"
                  ),
                  autoFocus: true,
                  maxLength: 50,
                  className: "mb-3"
                }
              ),
              /* @__PURE__ */ jsxs15(DialogFooter, { children: [
                /* @__PURE__ */ jsx21(Button, { type: "button", variant: "outline", size: "sm", onClick: handleClose, children: translate("auto.components.settings.BrowserPane.81ff774667", "Cancel") }),
                /* @__PURE__ */ jsx21(Button, { type: "submit", size: "sm", disabled: !newProfileName.trim() || isCreatingProfile, children: isCreatingProfile ? translate("auto.components.settings.BrowserPane.7b649a578a", "Creating\u2026") : translate("auto.components.settings.BrowserPane.64898ecdab", "Create") })
              ] })
            ]
          }
        )
      ] })
    }
  );
}

// src/renderer/ui/label.tsx
import * as LabelPrimitive from "radix-ui/label";
import { jsx as jsx22 } from "react/jsx-runtime";
function Label2({ className, ...props }) {
  return /* @__PURE__ */ jsx22(
    LabelPrimitive.Root,
    {
      "data-slot": "label",
      className: cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      ),
      ...props
    }
  );
}

// src/renderer/ui/select.tsx
import { CheckIcon as CheckIcon2, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import * as SelectPrimitive from "radix-ui/select";
import { jsx as jsx23, jsxs as jsxs16 } from "react/jsx-runtime";
function Select({ ...props }) {
  return /* @__PURE__ */ jsx23(SelectPrimitive.Root, { "data-slot": "select", ...props });
}
function SelectValue({ ...props }) {
  return /* @__PURE__ */ jsx23(SelectPrimitive.Value, { "data-slot": "select-value", ...props });
}
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs16(
    SelectPrimitive.Trigger,
    {
      "data-slot": "select-trigger",
      "data-size": size,
      className: cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      ),
      ...props,
      children: [
        children,
        /* @__PURE__ */ jsx23(SelectPrimitive.Icon, { asChild: true, children: /* @__PURE__ */ jsx23(ChevronDownIcon, { className: "size-4 opacity-50" }) })
      ]
    }
  );
}
function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  portalContainer,
  ...props
}) {
  return /* @__PURE__ */ jsx23(SelectPrimitive.Portal, { container: portalContainer ?? void 0, children: /* @__PURE__ */ jsxs16(
    SelectPrimitive.Content,
    {
      "data-slot": "select-content",
      className: cn(
        "relative z-[70] max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border border-black/14 bg-[rgba(255,255,255,0.82)] text-popover-foreground shadow-[0_16px_36px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl dark:border-white/14 dark:bg-[rgba(0,0,0,0.72)] dark:shadow-[0_20px_44px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      ),
      position,
      align,
      ...props,
      children: [
        /* @__PURE__ */ jsx23(SelectScrollUpButton, {}),
        /* @__PURE__ */ jsx23(
          SelectPrimitive.Viewport,
          {
            className: cn(
              "p-1",
              position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
            ),
            children
          }
        ),
        /* @__PURE__ */ jsx23(SelectScrollDownButton, {})
      ]
    }
  ) });
}
function SelectItem({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs16(
    SelectPrimitive.Item,
    {
      "data-slot": "select-item",
      className: cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx23(
          "span",
          {
            "data-slot": "select-item-indicator",
            className: "absolute right-2 flex size-3.5 items-center justify-center",
            children: /* @__PURE__ */ jsx23(SelectPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx23(CheckIcon2, { className: "size-4" }) })
          }
        ),
        /* @__PURE__ */ jsx23(SelectPrimitive.ItemText, { children })
      ]
    }
  );
}
function SelectScrollUpButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx23(
    SelectPrimitive.ScrollUpButton,
    {
      "data-slot": "select-scroll-up-button",
      className: cn("flex cursor-default items-center justify-center py-1", className),
      ...props,
      children: /* @__PURE__ */ jsx23(ChevronUpIcon, { className: "size-4" })
    }
  );
}
function SelectScrollDownButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx23(
    SelectPrimitive.ScrollDownButton,
    {
      "data-slot": "select-scroll-down-button",
      className: cn("flex cursor-default items-center justify-center py-1", className),
      ...props,
      children: /* @__PURE__ */ jsx23(ChevronDownIcon, { className: "size-4" })
    }
  );
}

// src/renderer/components/settings/BrowserSearchEngineSetting.tsx
import { jsx as jsx24, jsxs as jsxs17 } from "react/jsx-runtime";
function BrowserSearchEngineSetting({
  selectedSearchEngine,
  onSearchEngineChange
}) {
  return /* @__PURE__ */ jsxs17("div", { className: "flex items-start justify-between gap-4 py-2", children: [
    /* @__PURE__ */ jsxs17("div", { className: "space-y-0.5", children: [
      /* @__PURE__ */ jsx24(Label2, { children: translate("auto.components.settings.BrowserPane.0d9c987f21", "Default Search Engine") }),
      /* @__PURE__ */ jsx24("p", { className: "text-xs text-muted-foreground", children: translate(
        "auto.components.settings.BrowserPane.3e46903ad4",
        "Used when typing non-URL text in the address bar."
      ) })
    ] }),
    /* @__PURE__ */ jsxs17(
      Select,
      {
        value: selectedSearchEngine,
        onValueChange: (value) => onSearchEngineChange(value),
        children: [
          /* @__PURE__ */ jsx24(SelectTrigger, { className: "h-7 w-36 text-xs", children: /* @__PURE__ */ jsx24(SelectValue, {}) }),
          /* @__PURE__ */ jsx24(SelectContent, { children: Object.keys(SEARCH_ENGINE_LABELS).map((engine) => /* @__PURE__ */ jsx24(SelectItem, { value: engine, className: "text-xs", children: SEARCH_ENGINE_LABELS[engine] }, engine)) })
        ]
      }
    )
  ] });
}

// src/renderer/components/settings/BrowserSessionCookiesSection.tsx
import { Plus } from "lucide-react";

// src/renderer/components/settings/BrowserProfileRow.tsx
import { useState as useState5 } from "react";
import { Import, Loader2 as Loader23, Trash2 } from "lucide-react";
import { toast as toast3 } from "sonner";
import { jsx as jsx25, jsxs as jsxs18 } from "react/jsx-runtime";
function BrowserProfileRow({
  profile,
  inUse,
  isDefault
}) {
  const detectedBrowsers = useBrowserSessionStore((s) => s.detectedBrowsers);
  const importState = useBrowserSessionStore((s) => s.browserSessionImportState);
  const fetchDetectedBrowsers = useBrowserSessionStore((s) => s.fetchDetectedBrowsers);
  const [confirmingDelete, setConfirmingDelete] = useState5(false);
  const isImporting = importState?.profileId === profile.id && importState.status === "importing";
  const handleImportFromBrowser = async (browserFamily, browserProfile) => {
    const result = await useBrowserSessionStore.getState().importCookiesFromBrowser(profile.id, browserFamily, browserProfile);
    if (result.ok) {
      const browser = detectedBrowsers.find((b) => b.family === browserFamily);
      emitBrowserCookieImportToast(
        result.summary,
        browserProfile ? translate(
          "auto.components.settings.BrowserProfileRow.a3f8c2d1e0b4",
          "Imported {{value0}} cookies from {{value1}} ({{value2}}) into {{value3}}.",
          {
            value0: result.summary.importedCookies,
            value1: browser?.label ?? browserFamily,
            value2: browserProfile,
            value3: profile.label
          }
        ) : translate(
          "auto.components.settings.BrowserProfileRow.b4e9d3f2a1c5",
          "Imported {{value0}} cookies from {{value1}} into {{value2}}.",
          {
            value0: result.summary.importedCookies,
            value1: browser?.label ?? browserFamily,
            value2: profile.label
          }
        )
      );
    } else {
      toast3.error(result.reason);
    }
  };
  const handleImportFromFile = async () => {
    const result = await useBrowserSessionStore.getState().importCookiesToProfile(profile.id);
    if (result.ok) {
      emitBrowserCookieImportToast(
        result.summary,
        translate(
          "auto.components.settings.BrowserProfileRow.b4c167764d",
          "Imported {{value0}} cookies from file into {{value1}}.",
          { value0: result.summary.importedCookies, value1: profile.label }
        )
      );
    } else if (result.reason !== "canceled") {
      toast3.error(result.reason);
    }
  };
  const handleDelete = async () => {
    setConfirmingDelete(false);
    const ok = await useBrowserSessionStore.getState().deleteBrowserSessionProfile(profile.id);
    if (ok) {
      toast3.success(
        translate(
          "auto.components.settings.BrowserProfileRow.8e636cae25",
          'Profile "{{value0}}" removed.',
          { value0: profile.label }
        )
      );
    }
  };
  const sourceLabel = profile.source ? `${BROWSER_FAMILY_LABELS[profile.source.browserFamily] ?? profile.source.browserFamily}${profile.source.profileName ? ` (${profile.source.profileName})` : ""}` : translate("auto.components.settings.BrowserProfileRow.796d846483", "No cookies imported");
  return /* @__PURE__ */ jsxs18(
    "div",
    {
      "data-profile-id": profile.id,
      className: `flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left ${inUse ? "border-foreground/20 bg-accent/15" : "border-border/70"}`,
      children: [
        /* @__PURE__ */ jsxs18("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsxs18("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx25("span", { className: "truncate text-sm font-medium", children: profile.label }),
            inUse ? /* @__PURE__ */ jsx25("span", { className: "shrink-0 rounded border border-border/50 px-1.5 text-[10px] font-medium leading-4 text-foreground/80", children: translate("auto.components.browser.settings.currentProfile", "In use") }) : null
          ] }),
          /* @__PURE__ */ jsx25("p", { className: "truncate text-[11px] text-muted-foreground", children: sourceLabel })
        ] }),
        /* @__PURE__ */ jsxs18("div", { className: "flex shrink-0 items-center gap-1", children: [
          /* @__PURE__ */ jsxs18(
            DropdownMenu,
            {
              onOpenChange: (open) => {
                if (open) {
                  void fetchDetectedBrowsers();
                }
              },
              children: [
                /* @__PURE__ */ jsx25(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs18(
                  Button,
                  {
                    variant: "ghost",
                    size: "xs",
                    className: "h-6 gap-1 px-1.5 text-[11px] text-muted-foreground",
                    disabled: isImporting,
                    children: [
                      isImporting ? /* @__PURE__ */ jsx25(Loader23, { className: "size-3 animate-spin" }) : /* @__PURE__ */ jsx25(Import, { className: "size-3" }),
                      translate("auto.components.settings.BrowserProfileRow.cdec84552f", "Import Cookies")
                    ]
                  }
                ) }),
                /* @__PURE__ */ jsxs18(DropdownMenuContent, { align: "end", children: [
                  detectedBrowsers.map(
                    (browser) => browser.profiles.length > 1 ? /* @__PURE__ */ jsxs18(DropdownMenuSub, { children: [
                      /* @__PURE__ */ jsx25(DropdownMenuSubTrigger, { children: translate(
                        "auto.components.settings.BrowserProfileRow.c5a273a809",
                        "From {{value0}}",
                        { value0: browser.label }
                      ) }),
                      /* @__PURE__ */ jsx25(DropdownMenuPortal, { children: /* @__PURE__ */ jsx25(DropdownMenuSubContent, { children: browser.profiles.map((bp) => /* @__PURE__ */ jsx25(
                        DropdownMenuItem,
                        {
                          onSelect: () => void handleImportFromBrowser(browser.family, bp.directory),
                          children: bp.name
                        },
                        bp.directory
                      )) }) })
                    ] }, browser.family) : /* @__PURE__ */ jsx25(
                      DropdownMenuItem,
                      {
                        onSelect: () => void handleImportFromBrowser(browser.family),
                        children: translate(
                          "auto.components.settings.BrowserProfileRow.c5a273a809",
                          "From {{value0}}",
                          { value0: browser.label }
                        )
                      },
                      browser.family
                    )
                  ),
                  detectedBrowsers.length > 0 && /* @__PURE__ */ jsx25(DropdownMenuSeparator, {}),
                  /* @__PURE__ */ jsx25(DropdownMenuItem, { onSelect: () => void handleImportFromFile(), children: translate("auto.components.settings.BrowserProfileRow.ebb78dfd6f", "From File\u2026") }),
                  /* @__PURE__ */ jsx25(BrowserCookieImportDisclosure, {})
                ] })
              ]
            }
          ),
          isDefault ? /* @__PURE__ */ jsx25(
            Button,
            {
              variant: "ghost",
              size: "icon",
              className: "size-7 text-muted-foreground hover:text-destructive",
              disabled: !profile.source,
              "aria-label": translate("auto.components.browser.settings.clearCookies", "Clear cookies"),
              onClick: async () => {
                const ok = await useBrowserSessionStore.getState().clearDefaultSessionCookies();
                if (ok) {
                  toast3.success(
                    translate(
                      "auto.components.settings.BrowserProfileRow.2d4bea7f35",
                      "Default cookies cleared."
                    )
                  );
                }
              },
              children: /* @__PURE__ */ jsx25(Trash2, { className: "size-3" })
            }
          ) : /* @__PURE__ */ jsx25(
            Button,
            {
              variant: "ghost",
              size: "icon",
              className: "size-7 text-muted-foreground hover:text-destructive",
              "aria-label": translate(
                "auto.components.browser.settings.deleteProfile",
                "Delete profile"
              ),
              onClick: () => setConfirmingDelete(true),
              children: /* @__PURE__ */ jsx25(Trash2, { className: "size-3" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx25(Dialog, { open: confirmingDelete, onOpenChange: setConfirmingDelete, children: /* @__PURE__ */ jsxs18(DialogContent, { className: "sm:max-w-sm", showCloseButton: false, children: [
          /* @__PURE__ */ jsxs18(DialogHeader, { children: [
            /* @__PURE__ */ jsx25(DialogTitle, { className: "text-base", children: translate(
              "auto.components.browser.settings.deleteProfileTitle",
              "Delete this profile?"
            ) }),
            /* @__PURE__ */ jsx25(DialogDescription, { className: "text-xs", children: translate(
              "auto.components.browser.settings.deleteProfileDescription",
              'Cookies and logins stored in "{{value0}}" will be removed.',
              { value0: profile.label }
            ) })
          ] }),
          /* @__PURE__ */ jsxs18(DialogFooter, { children: [
            /* @__PURE__ */ jsx25(Button, { variant: "outline", size: "sm", onClick: () => setConfirmingDelete(false), children: translate("auto.components.settings.BrowserPane.81ff774667", "Cancel") }),
            /* @__PURE__ */ jsx25(Button, { variant: "destructive", size: "sm", onClick: () => void handleDelete(), children: translate("auto.components.browser.settings.deleteConfirm", "Delete") })
          ] })
        ] }) })
      ]
    }
  );
}

// src/renderer/components/settings/BrowserSessionCookiesSection.tsx
import { jsx as jsx26, jsxs as jsxs19 } from "react/jsx-runtime";
function BrowserSessionCookiesSection({
  inUseProfileId,
  onAddProfile
}) {
  const profiles = useBrowserSessionStore((s) => s.browserSessionProfiles);
  const defaultProfile = profiles.find((profile) => profile.id === "default");
  const nonDefaultProfiles = profiles.filter((profile) => profile.id !== "default");
  return /* @__PURE__ */ jsxs19("div", { className: "space-y-3 py-2", children: [
    /* @__PURE__ */ jsxs19("div", { className: "flex items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs19("div", { className: "space-y-0.5", children: [
        /* @__PURE__ */ jsx26(Label2, { children: translate("auto.components.settings.BrowserPane.2d66a6efb5", "Session & Cookies") }),
        /* @__PURE__ */ jsx26("p", { className: "text-xs text-muted-foreground", children: translate(
          "auto.components.browser.settings.profilesHint",
          "Import cookies into a profile, and switch profiles per tab from the toolbar menu."
        ) })
      ] }),
      /* @__PURE__ */ jsxs19(Button, { variant: "outline", size: "xs", onClick: onAddProfile, className: "shrink-0 gap-1.5", children: [
        /* @__PURE__ */ jsx26(Plus, { className: "size-3" }),
        translate("auto.components.settings.BrowserPane.6f2584b39e", "Add Profile")
      ] })
    ] }),
    /* @__PURE__ */ jsxs19("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx26(
        BrowserProfileRow,
        {
          profile: defaultProfile ?? {
            id: "default",
            scope: "default",
            partition: "",
            label: translate("auto.components.settings.BrowserPane.4399c77caa", "Default"),
            source: null
          },
          inUse: inUseProfileId === "default",
          isDefault: true
        }
      ),
      nonDefaultProfiles.map((profile) => /* @__PURE__ */ jsx26(
        BrowserProfileRow,
        {
          profile,
          inUse: inUseProfileId === profile.id
        },
        profile.id
      ))
    ] })
  ] });
}

// src/renderer/components/settings/BrowserUserAgentSetting.tsx
import { useState as useState6 } from "react";
import { jsx as jsx27, jsxs as jsxs20 } from "react/jsx-runtime";
function BrowserUserAgentSetting() {
  const status = useBrowserSessionStore((s) => s.identity);
  const setIdentityMode = useBrowserSessionStore((s) => s.setIdentityMode);
  const [error, setError] = useState6(null);
  const [saving, setSaving] = useState6(false);
  const title = translate("settings.browser.userAgent.title", "Browser identity");
  const description = translate(
    "settings.browser.userAgent.description",
    "Choose the user agent for every browser profile and page. Native mode disables Google sign-in. Changes take effect after a restart."
  );
  const setMode = (mode) => {
    setSaving(true);
    setError(null);
    setIdentityMode(mode).then((result) => {
      if (!result) {
        setError(
          translate("settings.browser.userAgent.unavailable", "Browser identity is unavailable.")
        );
      } else if (!result.ok) {
        setError(result.error.message);
      }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason))).finally(() => setSaving(false));
  };
  let control;
  if (!status) {
    control = /* @__PURE__ */ jsx27("span", { className: "text-xs text-muted-foreground", children: translate("settings.browser.userAgent.loading", "Loading\u2026") });
  } else if (status.identity.configuredMode === null) {
    control = /* @__PURE__ */ jsx27("div", { className: "text-xs text-destructive", children: translate(
      "settings.browser.userAgent.resetRequired",
      "Identity data must be reset explicitly before it can be changed."
    ) });
  } else {
    const configuredMode = status.identity.configuredMode;
    const options = [
      {
        value: "clean",
        label: translate("settings.browser.userAgent.optionClean", "Cleaned"),
        tooltip: translate(
          "settings.browser.userAgent.optionCleanTooltip",
          "Removes Orca and Electron tokens to match imported Chrome sessions."
        )
      },
      {
        value: "native",
        label: translate("settings.browser.userAgent.optionNative", "Native"),
        tooltip: translate(
          "settings.browser.userAgent.optionNativeTooltip",
          "Keeps Electron's built-in identity for sites that reject the cleaned identity. Google sign-in is unavailable in Native mode."
        )
      }
    ];
    control = /* @__PURE__ */ jsxs20("div", { className: "space-y-1 text-right", children: [
      /* @__PURE__ */ jsx27("div", { role: "radiogroup", "aria-label": title, className: "inline-flex gap-1", children: options.map((option) => /* @__PURE__ */ jsx27(
        Button,
        {
          type: "button",
          role: "radio",
          "aria-checked": configuredMode === option.value,
          size: "sm",
          variant: configuredMode === option.value ? "secondary" : "outline",
          className: "h-7 text-xs",
          title: option.tooltip,
          disabled: saving,
          onClick: () => setMode(option.value),
          children: option.label
        },
        option.value
      )) }),
      status.identity.restartRequired ? /* @__PURE__ */ jsx27("div", { className: "text-[11px] text-muted-foreground", children: translate("settings.browser.userAgent.restartRequired", "Restart required") }) : null,
      error ? /* @__PURE__ */ jsx27("div", { className: "text-[11px] text-destructive", children: error }) : null
    ] });
  }
  return /* @__PURE__ */ jsxs20("div", { className: "flex items-start justify-between gap-4 py-2", children: [
    /* @__PURE__ */ jsxs20("div", { className: "space-y-0.5", children: [
      /* @__PURE__ */ jsx27(Label2, { children: title }),
      /* @__PURE__ */ jsx27("p", { className: "text-xs text-muted-foreground", children: description })
    ] }),
    /* @__PURE__ */ jsx27("div", { className: "shrink-0", children: control })
  ] });
}

// src/renderer/components/settings/BrowserSettingsPanel.tsx
import { jsx as jsx28, jsxs as jsxs21 } from "react/jsx-runtime";
function BrowserSettingsPanel(props) {
  const { scopeId } = props;
  const searchEngine = useBrowserSessionStore((s) => s.settings.searchEngine);
  const updateSettings = useBrowserSessionStore((s) => s.updateSettings);
  const [newProfileDialogOpen, setNewProfileDialogOpen] = useState7(false);
  const inUseProfileId = useBrowserStore((s) => {
    if (scopeId === void 0) {
      return void 0;
    }
    const activePageId = s.activePageIdByScope[scopeId];
    const activePage = s.pagesByScope[scopeId]?.find((page) => page.id === activePageId);
    return activePage ? activePage.sessionProfileId ?? "default" : void 0;
  });
  useEffect10(() => {
    const state = useBrowserSessionStore.getState();
    if (!state.settingsLoaded) {
      void state.loadSettings();
    }
    if (state.browserSessionProfiles.length === 0) {
      void state.fetchBrowserSessionProfiles();
    }
    if (state.identity === null) {
      void state.loadIdentity();
    }
  }, []);
  return /* @__PURE__ */ jsxs21("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx28(
      BrowserSearchEngineSetting,
      {
        selectedSearchEngine: searchEngine,
        onSearchEngineChange: (engine) => void updateSettings({ searchEngine: engine })
      }
    ),
    /* @__PURE__ */ jsx28(BrowserUserAgentSetting, {}),
    /* @__PURE__ */ jsx28(
      BrowserSessionCookiesSection,
      {
        inUseProfileId,
        onAddProfile: () => setNewProfileDialogOpen(true)
      }
    ),
    /* @__PURE__ */ jsx28(BrowserNewProfileDialog, { open: newProfileDialogOpen, onOpenChange: setNewProfileDialogOpen })
  ] });
}

// src/renderer/components/settings/BrowserSettingsDialog.tsx
import { jsx as jsx29, jsxs as jsxs22 } from "react/jsx-runtime";
function BrowserSettingsDialog(props) {
  const { open, onOpenChange, scopeId } = props;
  return /* @__PURE__ */ jsx29(Dialog, { open, onOpenChange, children: /* @__PURE__ */ jsxs22(DialogContent, { className: "max-h-[85vh] overflow-y-auto sm:max-w-xl", children: [
    /* @__PURE__ */ jsx29(DialogHeader, { children: /* @__PURE__ */ jsx29(DialogTitle, { className: "text-base", children: translate(
      "auto.components.browser.pane.BrowserToolbarMenu.a771c2b6c8",
      "Browser Settings\u2026"
    ) }) }),
    open ? /* @__PURE__ */ jsx29(BrowserSettingsPanel, { scopeId }) : null
  ] }) });
}

// src/shared/browser-cookie-import-sources.ts
var CHROMIUM_COOKIE_IMPORT_SOURCES = [
  { label: "Google Chrome", mac: true, win: true, linux: true },
  { label: "Microsoft Edge", mac: true, win: true, linux: true },
  { label: "Arc", mac: true, win: false, linux: false },
  { label: "Brave", mac: true, win: true, linux: true },
  { label: "Comet", mac: true, win: true, linux: false },
  { label: "Helium", mac: true, win: false, linux: false }
];
function getBrowserCookieImportSourceLabels(platform) {
  const labels = [];
  for (const source of CHROMIUM_COOKIE_IMPORT_SOURCES) {
    if (platform === "darwin" && source.mac) {
      labels.push(source.label);
    } else if (platform === "win32" && source.win) {
      labels.push(source.label);
    } else if (platform === "linux" && source.linux) {
      labels.push(source.label);
    }
  }
  labels.push("Firefox");
  if (platform === "darwin") {
    labels.push("Safari");
  }
  return labels;
}

// src/renderer/components/browser-pane/assemble-chrome/browser-import-hint-visibility.ts
function shouldShowBrowserImportHint({
  settingsLoaded,
  browserImportHintHidden
}) {
  return settingsLoaded && !browserImportHintHidden;
}

// src/renderer/components/browser-pane/assemble-chrome/browser-detected-browsers-summary.ts
function formatLabelList(prefix, labels, maxNamed) {
  if (labels.length === 0) {
    return `${prefix} file.`;
  }
  if (labels.length <= maxNamed) {
    return `${prefix}: ${labels.join(", ")}.`;
  }
  const named = labels.slice(0, maxNamed);
  const remaining = labels.length - maxNamed;
  return `${prefix}: ${named.join(", ")}, +${remaining} more.`;
}
function formatBrowserImportSummary({
  detectedBrowsers,
  detectedBrowsersLoaded,
  supportedImportLabels,
  maxNamed = 4
}) {
  if (detectedBrowsersLoaded && detectedBrowsers.length > 0) {
    return formatLabelList(
      "Detected",
      detectedBrowsers.map((browser) => browser.label),
      maxNamed
    );
  }
  return formatLabelList("Import from", supportedImportLabels, maxNamed);
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserImportHintButton.tsx
import { Fragment as Fragment4, jsx as jsx30, jsxs as jsxs23 } from "react/jsx-runtime";
function BrowserImportHintButton({
  profileId,
  compact = false
}) {
  const [open, setOpen] = useState8(false);
  const [importMenuOpen, setImportMenuOpen] = useState8(false);
  const [settingsOpen, setSettingsOpen] = useState8(false);
  const browserSessionImportState = useBrowserSessionStore((s) => s.browserSessionImportState);
  const browserImportHintHidden = useBrowserSessionStore((s) => s.settings.importHintHidden);
  const settingsLoaded = useBrowserSessionStore((s) => s.settingsLoaded);
  const detectedBrowsers = useBrowserSessionStore((s) => s.detectedBrowsers);
  const detectedBrowsersLoaded = useBrowserSessionStore((s) => s.detectedBrowsersLoaded);
  const fetchDetectedBrowsers = useBrowserSessionStore((s) => s.fetchDetectedBrowsers);
  const importCookiesFromBrowser = useBrowserSessionStore((s) => s.importCookiesFromBrowser);
  const importCookiesToProfile = useBrowserSessionStore((s) => s.importCookiesToProfile);
  const updateSettings = useBrowserSessionStore((s) => s.updateSettings);
  const effectiveProfileId = profileId ?? "default";
  const shouldShow = shouldShowBrowserImportHint({
    settingsLoaded,
    browserImportHintHidden
  });
  const supportedImportLabels = useMemo4(() => {
    return getBrowserCookieImportSourceLabels(getRendererPlatform());
  }, []);
  const importSummary = useMemo4(
    () => formatBrowserImportSummary({
      detectedBrowsers,
      detectedBrowsersLoaded,
      supportedImportLabels
    }),
    [detectedBrowsers, detectedBrowsersLoaded, supportedImportLabels]
  );
  const handleOpenChange = useCallback7(
    (nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setImportMenuOpen(false);
      }
      if (nextOpen) {
        void fetchDetectedBrowsers();
      }
    },
    [fetchDetectedBrowsers]
  );
  const handleImportFromBrowser = useCallback7(
    async (browserFamily, browserProfile) => {
      setOpen(false);
      setImportMenuOpen(false);
      const result = await importCookiesFromBrowser(
        effectiveProfileId,
        browserFamily,
        browserProfile
      );
      if (result.ok) {
        const browser = detectedBrowsers.find((entry) => entry.family === browserFamily);
        emitBrowserCookieImportToast(
          result.summary,
          translate(
            "auto.components.browser.pane.BrowserImportHintButton.02e89014c5",
            "Imported {{value0}} cookies from {{value1}}{{value2}}.",
            {
              value0: result.summary.importedCookies,
              value1: browser?.label ?? browserFamily,
              value2: browserProfile ? ` (${browserProfile})` : ""
            }
          )
        );
        return;
      }
      toast4.error(result.reason);
    },
    [detectedBrowsers, effectiveProfileId, importCookiesFromBrowser]
  );
  const handleImportFromFile = useCallback7(async () => {
    setOpen(false);
    setImportMenuOpen(false);
    const result = await importCookiesToProfile(effectiveProfileId);
    if (result.ok) {
      emitBrowserCookieImportToast(
        result.summary,
        translate(
          "auto.components.browser.pane.BrowserImportHintButton.d40d584769",
          "Imported {{value0}} cookies from file.",
          { value0: result.summary.importedCookies }
        )
      );
      return;
    }
    if (result.reason !== "canceled") {
      toast4.error(result.reason);
    }
  }, [effectiveProfileId, importCookiesToProfile]);
  const handleOpenBrowserSettings = useCallback7(() => {
    setSettingsOpen(true);
    setOpen(false);
  }, []);
  const handleHideHint = useCallback7(() => {
    void updateSettings({ importHintHidden: true });
    setOpen(false);
  }, [updateSettings]);
  useEffect11(() => {
    if (!open) {
      return;
    }
    const dismiss = () => {
      handleOpenChange(false);
    };
    window.addEventListener("blur", dismiss);
    return () => window.removeEventListener("blur", dismiss);
  }, [handleOpenChange, open]);
  if (!shouldShow) {
    return null;
  }
  return /* @__PURE__ */ jsxs23(Fragment4, { children: [
    /* @__PURE__ */ jsxs23(Popover, { modal: false, open, onOpenChange: handleOpenChange, children: [
      /* @__PURE__ */ jsx30(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs23(
        Button,
        {
          type: "button",
          variant: "secondary",
          size: "sm",
          className: "h-7 shrink-0 rounded-full px-2.5 text-xs",
          "aria-label": translate(
            "auto.components.browser.pane.BrowserImportHintButton.4f5ffaa6a1",
            "Import browser data"
          ),
          children: [
            /* @__PURE__ */ jsx30(Import2, { className: "size-3.5" }),
            compact ? null : translate(
              "auto.components.browser.pane.BrowserImportHintButton.b24fef25be",
              "Import"
            )
          ]
        }
      ) }),
      /* @__PURE__ */ jsx30(PopoverContent, { align: "end", side: "bottom", sideOffset: 6, className: "w-80 p-3", children: /* @__PURE__ */ jsxs23("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsxs23("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx30("div", { className: "text-sm font-medium text-foreground", children: translate(
            "auto.components.browser.pane.BrowserImportHintButton.4f5ffaa6a1",
            "Import browser data"
          ) }),
          /* @__PURE__ */ jsx30("p", { className: "text-xs leading-5 text-muted-foreground", children: importSummary }),
          /* @__PURE__ */ jsx30("p", { className: "text-[11px] leading-4 text-muted-foreground/80", children: translate(
            "auto.components.browser.pane.BrowserImportHintButton.e52a955e6f",
            "You can always find this in Settings > Browser."
          ) })
        ] }),
        /* @__PURE__ */ jsxs23("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsxs23(DropdownMenu, { modal: false, open: importMenuOpen, onOpenChange: setImportMenuOpen, children: [
            /* @__PURE__ */ jsx30(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx30(
              Button,
              {
                type: "button",
                size: "sm",
                variant: "secondary",
                className: "h-7 px-2.5 text-xs",
                disabled: browserSessionImportState?.status === "importing",
                children: translate(
                  "auto.components.browser.pane.BrowserImportHintButton.244266c122",
                  "Import\u2026"
                )
              }
            ) }),
            /* @__PURE__ */ jsxs23(DropdownMenuContent, { align: "start", className: "w-52", children: [
              detectedBrowsers.map(
                (browser) => browser.profiles.length > 1 ? /* @__PURE__ */ jsxs23(DropdownMenuSub, { children: [
                  /* @__PURE__ */ jsx30(DropdownMenuSubTrigger, { children: translate(
                    "auto.components.browser.pane.BrowserImportHintButton.0c6d254eca",
                    "From {{value0}}",
                    { value0: browser.label }
                  ) }),
                  /* @__PURE__ */ jsx30(DropdownMenuPortal, { children: /* @__PURE__ */ jsx30(DropdownMenuSubContent, { children: browser.profiles.map((profile) => /* @__PURE__ */ jsx30(
                    DropdownMenuItem,
                    {
                      onSelect: () => void handleImportFromBrowser(browser.family, profile.directory),
                      children: profile.name
                    },
                    profile.directory
                  )) }) })
                ] }, browser.family) : /* @__PURE__ */ jsx30(
                  DropdownMenuItem,
                  {
                    onSelect: () => void handleImportFromBrowser(browser.family),
                    children: translate(
                      "auto.components.browser.pane.BrowserImportHintButton.0c6d254eca",
                      "From {{value0}}",
                      { value0: browser.label }
                    )
                  },
                  browser.family
                )
              ),
              detectedBrowsers.length > 0 ? /* @__PURE__ */ jsx30(DropdownMenuSeparator, {}) : null,
              /* @__PURE__ */ jsx30(DropdownMenuItem, { onSelect: () => void handleImportFromFile(), children: translate(
                "auto.components.browser.pane.BrowserImportHintButton.e0e125e074",
                "From File\u2026"
              ) }),
              /* @__PURE__ */ jsx30(BrowserCookieImportDisclosure, {})
            ] })
          ] }),
          /* @__PURE__ */ jsx30(
            "button",
            {
              type: "button",
              onClick: handleOpenBrowserSettings,
              className: "rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              children: translate(
                "auto.components.browser.pane.BrowserImportHintButton.77351d22f5",
                "Browser Settings"
              )
            }
          ),
          /* @__PURE__ */ jsx30(
            "button",
            {
              type: "button",
              onClick: handleHideHint,
              className: "ml-auto rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              children: translate(
                "auto.components.browser.pane.BrowserImportHintButton.05e675fe96",
                "Hide Hint"
              )
            }
          )
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx30(BrowserSettingsDialog, { open: settingsOpen, onOpenChange: setSettingsOpen })
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserToolbarMenu.tsx
import { useState as useState9 } from "react";
import { toast as toast5 } from "sonner";

// src/shared/browser-viewport-presets.ts
var BROWSER_VIEWPORT_PRESETS = [
  {
    id: "mobile-s",
    label: "Mobile S \u2014 320 \xD7 568",
    width: 320,
    height: 568,
    deviceScaleFactor: 2,
    mobile: true
  },
  {
    id: "mobile-m",
    label: "Mobile M \u2014 375 \xD7 667",
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true
  },
  {
    id: "mobile-l",
    label: "Mobile L \u2014 425 \xD7 812",
    width: 425,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true
  },
  {
    id: "tablet",
    label: "Tablet \u2014 768 \xD7 1024",
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    mobile: true
  },
  {
    id: "laptop",
    label: "Laptop \u2014 1024 \xD7 768",
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false
  },
  {
    id: "laptop-l",
    label: "Laptop L \u2014 1440 \xD7 900",
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  },
  {
    id: "desktop",
    label: "Desktop \u2014 1920 \xD7 1080",
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  }
];
function getBrowserViewportPreset(id) {
  if (!id) {
    return null;
  }
  return BROWSER_VIEWPORT_PRESETS.find((p) => p.id === id) ?? null;
}
function browserViewportPresetToOverride(preset) {
  return {
    width: preset.width,
    height: preset.height,
    deviceScaleFactor: preset.deviceScaleFactor,
    mobile: preset.mobile
  };
}

// src/renderer/components/browser-pane/assemble-chrome/browser-toolbar-menu-dropdown.tsx
import { Check as Check2, Ellipsis as Ellipsis2, Import as Import3, Monitor, Plus as Plus2, Settings } from "lucide-react";
import { jsx as jsx31, jsxs as jsxs24 } from "react/jsx-runtime";
function BrowserToolbarMenuDropdown({
  onOpenSettings,
  allProfiles,
  effectiveProfileId,
  onSwitchProfile,
  onNewProfile,
  detectedBrowsers,
  onFetchDetectedBrowsers,
  browserSessionImportState,
  onImportFromBrowser,
  onImportFromFile,
  viewportPresetId,
  onApplyViewportPreset,
  overflow
}) {
  return /* @__PURE__ */ jsxs24(DropdownMenu, { modal: false, children: [
    /* @__PURE__ */ jsx31(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx31(
      Button,
      {
        ref: overflow.triggerRef,
        size: "icon",
        variant: "ghost",
        className: "h-8 w-8",
        title: translate(
          "auto.components.browser.pane.BrowserToolbarMenu.7b838540c7",
          "Browser menu"
        ),
        children: /* @__PURE__ */ jsx31(Ellipsis2, { className: "size-4" })
      }
    ) }),
    /* @__PURE__ */ jsxs24(
      DropdownMenuContent,
      {
        align: "end",
        className: "w-56",
        onCloseAutoFocus: overflow.onMenuCloseAutoFocus,
        children: [
          /* @__PURE__ */ jsx31(
            BrowserChromeFoldedMenuItems,
            {
              tools: overflow.tools,
              deferUntilClose: overflow.deferUntilClose
            }
          ),
          allProfiles.map((profile) => {
            const isSelectedProfile = profile.id === effectiveProfileId;
            return /* @__PURE__ */ jsxs24(
              DropdownMenuItem,
              {
                onSelect: () => onSwitchProfile(profile.id === "default" ? null : profile.id),
                children: [
                  /* @__PURE__ */ jsx31(
                    Check2,
                    {
                      className: `mr-2 size-3.5 shrink-0 ${isSelectedProfile ? "opacity-100" : "opacity-0"}`
                    }
                  ),
                  /* @__PURE__ */ jsx31("span", { className: "truncate", children: profile.label }),
                  profile.source?.browserFamily && /* @__PURE__ */ jsx31("span", { className: "ml-auto pl-2 text-[11px] text-muted-foreground", children: BROWSER_FAMILY_LABELS[profile.source.browserFamily] ?? profile.source.browserFamily })
                ]
              },
              profile.id
            );
          }),
          /* @__PURE__ */ jsx31(DropdownMenuSeparator, {}),
          /* @__PURE__ */ jsxs24(DropdownMenuItem, { onSelect: onNewProfile, children: [
            /* @__PURE__ */ jsx31(Plus2, { className: "mr-2 size-3.5" }),
            translate("auto.components.browser.pane.BrowserToolbarMenu.cf7cdc67ef", "New Profile\u2026")
          ] }),
          /* @__PURE__ */ jsx31(DropdownMenuSeparator, {}),
          /* @__PURE__ */ jsxs24(
            DropdownMenuSub,
            {
              onOpenChange: (open) => {
                if (open) {
                  onFetchDetectedBrowsers();
                }
              },
              children: [
                /* @__PURE__ */ jsxs24(
                  DropdownMenuSubTrigger,
                  {
                    disabled: browserSessionImportState?.profileId === effectiveProfileId && browserSessionImportState.status === "importing",
                    children: [
                      /* @__PURE__ */ jsx31(Import3, { className: "mr-2 size-3.5" }),
                      translate(
                        "auto.components.browser.pane.BrowserToolbarMenu.2293adf620",
                        "Import Cookies"
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ jsx31(DropdownMenuPortal, { children: /* @__PURE__ */ jsxs24(DropdownMenuSubContent, { children: [
                  detectedBrowsers.map(
                    (browser) => browser.profiles.length > 1 ? /* @__PURE__ */ jsxs24(DropdownMenuSub, { children: [
                      /* @__PURE__ */ jsx31(DropdownMenuSubTrigger, { children: translate(
                        "auto.components.browser.pane.BrowserToolbarMenu.eb280bfb11",
                        "From {{value0}}",
                        { value0: browser.label }
                      ) }),
                      /* @__PURE__ */ jsx31(DropdownMenuPortal, { children: /* @__PURE__ */ jsx31(DropdownMenuSubContent, { children: browser.profiles.map((profile) => /* @__PURE__ */ jsx31(
                        DropdownMenuItem,
                        {
                          onSelect: () => onImportFromBrowser(browser.family, profile.directory),
                          children: profile.name
                        },
                        profile.directory
                      )) }) })
                    ] }, browser.family) : /* @__PURE__ */ jsx31(
                      DropdownMenuItem,
                      {
                        onSelect: () => onImportFromBrowser(browser.family),
                        children: translate(
                          "auto.components.browser.pane.BrowserToolbarMenu.eb280bfb11",
                          "From {{value0}}",
                          { value0: browser.label }
                        )
                      },
                      browser.family
                    )
                  ),
                  detectedBrowsers.length > 0 && /* @__PURE__ */ jsx31(DropdownMenuSeparator, {}),
                  /* @__PURE__ */ jsx31(DropdownMenuItem, { onSelect: onImportFromFile, children: translate(
                    "auto.components.browser.pane.BrowserToolbarMenu.56f94f4ffa",
                    "From File\u2026"
                  ) }),
                  /* @__PURE__ */ jsx31(BrowserCookieImportDisclosure, {})
                ] }) })
              ]
            }
          ),
          /* @__PURE__ */ jsx31(DropdownMenuSeparator, {}),
          /* @__PURE__ */ jsxs24(DropdownMenuSub, { children: [
            /* @__PURE__ */ jsxs24(DropdownMenuSubTrigger, { children: [
              /* @__PURE__ */ jsx31(Monitor, { className: "mr-2 size-3.5" }),
              translate(
                "auto.components.browser.pane.BrowserToolbarMenu.e5d31de1a9",
                "Viewport Size"
              )
            ] }),
            /* @__PURE__ */ jsx31(DropdownMenuPortal, { children: /* @__PURE__ */ jsx31(DropdownMenuSubContent, { children: /* @__PURE__ */ jsxs24(
              DropdownMenuRadioGroup,
              {
                value: viewportPresetId ?? "default",
                onValueChange: (v) => onApplyViewportPreset(v === "default" ? null : v),
                children: [
                  /* @__PURE__ */ jsx31(DropdownMenuRadioItem, { value: "default", children: translate(
                    "auto.components.browser.pane.BrowserToolbarMenu.ed8f54509d",
                    "Default"
                  ) }),
                  /* @__PURE__ */ jsx31(DropdownMenuSeparator, {}),
                  BROWSER_VIEWPORT_PRESETS.map((preset) => /* @__PURE__ */ jsx31(DropdownMenuRadioItem, { value: preset.id, children: /* @__PURE__ */ jsx31("span", { className: "truncate", children: preset.label }) }, preset.id))
                ]
              }
            ) }) })
          ] }),
          /* @__PURE__ */ jsx31(DropdownMenuSeparator, {}),
          /* @__PURE__ */ jsxs24(DropdownMenuItem, { onSelect: onOpenSettings, children: [
            /* @__PURE__ */ jsx31(Settings, { className: "mr-2 size-3.5" }),
            translate(
              "auto.components.browser.pane.BrowserToolbarMenu.a771c2b6c8",
              "Browser Settings\u2026"
            )
          ] })
        ]
      }
    )
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/browser-toolbar-profile-dialogs.tsx
import { Fragment as Fragment5, jsx as jsx32, jsxs as jsxs25 } from "react/jsx-runtime";
function BrowserToolbarProfileDialogs({
  pendingSwitchProfileId,
  onPendingSwitchChange,
  onConfirmSwitch,
  newProfileDialogOpen,
  onNewProfileDialogOpenChange,
  newProfileName,
  onNewProfileNameChange,
  isCreatingProfile,
  onCreateProfile,
  onCancelNewProfile
}) {
  return /* @__PURE__ */ jsxs25(Fragment5, { children: [
    /* @__PURE__ */ jsx32(
      Dialog,
      {
        open: pendingSwitchProfileId !== void 0,
        onOpenChange: (open) => {
          if (!open) {
            onPendingSwitchChange(false);
          }
        },
        children: /* @__PURE__ */ jsxs25(DialogContent, { className: "sm:max-w-sm", showCloseButton: false, children: [
          /* @__PURE__ */ jsxs25(DialogHeader, { children: [
            /* @__PURE__ */ jsx32(DialogTitle, { className: "text-base", children: translate(
              "auto.components.browser.pane.BrowserToolbarMenu.fe683eb3b4",
              "Switch Profile"
            ) }),
            /* @__PURE__ */ jsx32(DialogDescription, { className: "text-xs", children: translate(
              "auto.components.browser.pane.BrowserToolbarMenu.a38f217b46",
              "Switching profiles will reload this page. Any unsaved form data will be lost."
            ) })
          ] }),
          /* @__PURE__ */ jsxs25(DialogFooter, { children: [
            /* @__PURE__ */ jsx32(Button, { variant: "outline", size: "sm", onClick: () => onPendingSwitchChange(false), children: translate("auto.components.browser.pane.BrowserToolbarMenu.429ef481f9", "Cancel") }),
            /* @__PURE__ */ jsx32(Button, { size: "sm", onClick: onConfirmSwitch, children: translate("auto.components.browser.pane.BrowserToolbarMenu.58f2c81542", "Switch") })
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsx32(Dialog, { open: newProfileDialogOpen, onOpenChange: onNewProfileDialogOpenChange, children: /* @__PURE__ */ jsxs25(DialogContent, { className: "sm:max-w-sm", showCloseButton: false, children: [
      /* @__PURE__ */ jsx32(DialogHeader, { children: /* @__PURE__ */ jsx32(DialogTitle, { className: "text-base", children: translate(
        "auto.components.browser.pane.BrowserToolbarMenu.67e9b9fcd6",
        "New Browser Profile"
      ) }) }),
      /* @__PURE__ */ jsxs25(
        "form",
        {
          onSubmit: (e) => {
            e.preventDefault();
            onCreateProfile();
          },
          children: [
            /* @__PURE__ */ jsx32(
              Input,
              {
                value: newProfileName,
                onChange: (e) => onNewProfileNameChange(e.target.value),
                placeholder: translate(
                  "auto.components.browser.pane.BrowserToolbarMenu.64f448fb6e",
                  "Profile name"
                ),
                autoFocus: true,
                maxLength: 50,
                className: "mb-3"
              }
            ),
            /* @__PURE__ */ jsxs25(DialogFooter, { children: [
              /* @__PURE__ */ jsx32(Button, { type: "button", variant: "outline", size: "sm", onClick: onCancelNewProfile, children: translate("auto.components.browser.pane.BrowserToolbarMenu.429ef481f9", "Cancel") }),
              /* @__PURE__ */ jsx32(
                Button,
                {
                  type: "submit",
                  size: "sm",
                  disabled: !newProfileName.trim() || isCreatingProfile,
                  children: isCreatingProfile ? translate(
                    "auto.components.browser.pane.BrowserToolbarMenu.bf648471c5",
                    "Creating\u2026"
                  ) : translate(
                    "auto.components.browser.pane.BrowserToolbarMenu.569bce8eb1",
                    "Create"
                  )
                }
              )
            ] })
          ]
        }
      )
    ] }) })
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserToolbarMenu.tsx
import { Fragment as Fragment6, jsx as jsx33, jsxs as jsxs26 } from "react/jsx-runtime";
function BrowserToolbarMenu({
  currentProfileId,
  scopeId,
  browserPageId,
  viewportPresetId,
  onDestroyWebview,
  overflow
}) {
  const browserSessionProfiles = useBrowserSessionStore((s) => s.browserSessionProfiles);
  const detectedBrowsers = useBrowserSessionStore((s) => s.detectedBrowsers);
  const createBrowserSessionProfile = useBrowserSessionStore((s) => s.createBrowserSessionProfile);
  const importCookiesFromBrowser = useBrowserSessionStore((s) => s.importCookiesFromBrowser);
  const importCookiesToProfile = useBrowserSessionStore((s) => s.importCookiesToProfile);
  const fetchDetectedBrowsers = useBrowserSessionStore((s) => s.fetchDetectedBrowsers);
  const browserSessionImportState = useBrowserSessionStore((s) => s.browserSessionImportState);
  const switchBrowserTabProfile = useBrowserStore((s) => s.switchBrowserTabProfile);
  const setBrowserPageViewportPreset = useBrowserStore((s) => s.setBrowserPageViewportPreset);
  const applyViewportPreset = (nextId) => {
    setBrowserPageViewportPreset(browserPageId, nextId);
    const preset = getBrowserViewportPreset(nextId);
    const override = preset ? browserViewportPresetToOverride(preset) : null;
    void window.browserAPI.setViewportOverride({ browserPageId, override });
  };
  const [newProfileDialogOpen, setNewProfileDialogOpen] = useState9(false);
  const [newProfileName, setNewProfileName] = useState9("");
  const [isCreatingProfile, setIsCreatingProfile] = useState9(false);
  const [pendingSwitchProfileId, setPendingSwitchProfileId] = useState9(
    void 0
  );
  const [settingsOpen, setSettingsOpen] = useState9(false);
  const mountedRef = useMountedRef();
  const handleNewProfileDialogOpenChange = (open) => {
    setNewProfileDialogOpen(open);
    if (!open) {
      setNewProfileName("");
    }
  };
  const effectiveProfileId = currentProfileId ?? "default";
  const defaultProfile = browserSessionProfiles.find((p) => p.id === "default");
  const allProfiles = defaultProfile ? [defaultProfile, ...browserSessionProfiles.filter((p) => p.id !== "default")] : browserSessionProfiles;
  const handleSwitchProfile = (profileId) => {
    const targetId = profileId ?? "default";
    if (targetId === effectiveProfileId) {
      return;
    }
    setPendingSwitchProfileId(profileId);
  };
  const confirmSwitchProfile = () => {
    if (pendingSwitchProfileId === void 0) {
      return;
    }
    const targetId = pendingSwitchProfileId ?? "default";
    const profile = browserSessionProfiles.find((p) => p.id === targetId);
    onDestroyWebview();
    switchBrowserTabProfile(browserPageId, pendingSwitchProfileId, profile?.partition ?? null);
    toast5.success(
      translate(
        "auto.components.browser.pane.BrowserToolbarMenu.3ccd29d771",
        "Switched to {{value0}} profile",
        { value0: profile?.label ?? "Default" }
      )
    );
    setPendingSwitchProfileId(void 0);
  };
  const handleCreateProfile = async () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      return;
    }
    setIsCreatingProfile(true);
    try {
      const profile = await createBrowserSessionProfile("isolated", trimmed);
      if (!profile) {
        if (mountedRef.current) {
          toast5.error(
            translate(
              "auto.components.browser.pane.BrowserToolbarMenu.4d2f9f13a7",
              "Failed to create profile."
            )
          );
        }
        return;
      }
      if (!mountedRef.current) {
        return;
      }
      setNewProfileDialogOpen(false);
      setNewProfileName("");
      onDestroyWebview();
      switchBrowserTabProfile(browserPageId, profile.id, profile.partition);
      toast5.success(
        translate(
          "auto.components.browser.pane.BrowserToolbarMenu.a7a86702b3",
          "Created and switched to {{value0}} profile",
          { value0: profile.label }
        )
      );
    } finally {
      if (mountedRef.current) {
        setIsCreatingProfile(false);
      }
    }
  };
  const handleImportFromBrowser = async (browserFamily, browserProfile) => {
    const result = await importCookiesFromBrowser(effectiveProfileId, browserFamily, browserProfile);
    if (result.ok) {
      const browser = detectedBrowsers.find((b) => b.family === browserFamily);
      emitBrowserCookieImportToast(
        result.summary,
        browserProfile ? translate(
          "auto.components.browser.pane.BrowserToolbarMenu.c5f0e4d3b2a1",
          "Imported {{value0}} cookies from {{value1}} ({{value2}}).",
          {
            value0: result.summary.importedCookies,
            value1: browser?.label ?? browserFamily,
            value2: browserProfile
          }
        ) : translate(
          "auto.components.browser.pane.BrowserToolbarMenu.d6a1f5e4c3b2",
          "Imported {{value0}} cookies from {{value1}}.",
          {
            value0: result.summary.importedCookies,
            value1: browser?.label ?? browserFamily
          }
        )
      );
    } else {
      toast5.error(result.reason);
    }
  };
  const handleImportFromFile = async () => {
    const result = await importCookiesToProfile(effectiveProfileId);
    if (result.ok) {
      emitBrowserCookieImportToast(
        result.summary,
        translate(
          "auto.components.browser.pane.BrowserToolbarMenu.53bbe3dab4",
          "Imported {{value0}} cookies from file.",
          { value0: result.summary.importedCookies }
        )
      );
    } else if (result.reason !== "canceled") {
      toast5.error(result.reason);
    }
  };
  return /* @__PURE__ */ jsxs26(Fragment6, { children: [
    /* @__PURE__ */ jsx33(
      BrowserToolbarMenuDropdown,
      {
        onOpenSettings: () => setSettingsOpen(true),
        allProfiles,
        effectiveProfileId,
        onSwitchProfile: handleSwitchProfile,
        onNewProfile: () => setNewProfileDialogOpen(true),
        detectedBrowsers,
        onFetchDetectedBrowsers: () => void fetchDetectedBrowsers(),
        browserSessionImportState,
        onImportFromBrowser: (browserFamily, browserProfile) => void handleImportFromBrowser(browserFamily, browserProfile),
        onImportFromFile: () => void handleImportFromFile(),
        viewportPresetId,
        onApplyViewportPreset: applyViewportPreset,
        overflow
      }
    ),
    /* @__PURE__ */ jsx33(BrowserSettingsDialog, { open: settingsOpen, onOpenChange: setSettingsOpen, scopeId }),
    /* @__PURE__ */ jsx33(
      BrowserToolbarProfileDialogs,
      {
        pendingSwitchProfileId,
        onPendingSwitchChange: () => setPendingSwitchProfileId(void 0),
        onConfirmSwitch: confirmSwitchProfile,
        newProfileDialogOpen,
        onNewProfileDialogOpenChange: handleNewProfileDialogOpenChange,
        newProfileName,
        onNewProfileNameChange: setNewProfileName,
        isCreatingProfile,
        onCreateProfile: () => void handleCreateProfile(),
        onCancelNewProfile: () => {
          setNewProfileDialogOpen(false);
          setNewProfileName("");
        }
      }
    )
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-toolbar.tsx
import { jsx as jsx34 } from "react/jsx-runtime";
function BrowserPageToolbar({
  page,
  isActive,
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
  dismissAddressBarSuggestionsRef,
  grab,
  grabIntent,
  startGrabIntent,
  browserAnnotationsLength,
  isBlankTab,
  markupIsActive,
  markupStart,
  markupCancel
}) {
  const browserPageId = page.id;
  const externalUrl = getOpenableExternalUrl(currentUrl);
  const isMac = getRendererPlatform() === "darwin";
  return /* @__PURE__ */ jsx34(TooltipProvider, { children: /* @__PURE__ */ jsx34(
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
      addressSlot: /* @__PURE__ */ jsx34(
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
      reloadControl: /* @__PURE__ */ jsx34(
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
      importControl: (compact) => /* @__PURE__ */ jsx34(BrowserImportHintButton, { profileId: page.sessionProfileId, compact }),
      elementTools: {
        activeIntent: grab.state !== "idle" ? grabIntent : null,
        onStartIntent: startGrabIntent,
        disabled: isBlankTab || markupIsActive,
        grabShortcutLabel: isMac ? "\u2318C" : "Ctrl+C",
        annotateShortcutLabel: isMac ? "\u2318\u21E7C" : "Alt+Shift+N",
        annotationCount: browserAnnotationsLength
      },
      markup: {
        active: markupIsActive,
        disabled: isBlankTab || grab.state !== "idle",
        onToggle: () => markupIsActive ? markupCancel() : void markupStart(),
        canShowDiscoveryHint: isActive
      },
      overflowMenu: (overflow) => /* @__PURE__ */ jsx34(
        BrowserToolbarMenu,
        {
          currentProfileId: page.sessionProfileId,
          scopeId: page.scopeId,
          browserPageId: page.id,
          viewportPresetId: page.viewportPresetId,
          onDestroyWebview: () => void destroyPersistentWebview(page.id),
          isActive,
          overflow
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
import { jsx as jsx35, jsxs as jsxs27 } from "react/jsx-runtime";
function BrowserPageChromeHeader({
  chromeHeaderRef,
  browserTab,
  isActive,
  webviewRef,
  addressBarInputRef,
  dismissAddressBarSuggestionsRef,
  reload,
  addressBarValue,
  setAddressBarValue,
  submitAddressBar,
  navigateToUrl,
  currentUrl,
  grab,
  grabAnnotations,
  annotationSend,
  isBlankTab,
  markupIsActive,
  markupStart,
  markupCancel,
  resourceNotice,
  setResourceNotice
}) {
  return /* @__PURE__ */ jsxs27("div", { ref: chromeHeaderRef, className: "pointer-events-auto shrink-0", children: [
    /* @__PURE__ */ jsx35(
      BrowserPageToolbar,
      {
        page: browserTab,
        isActive,
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
        dismissAddressBarSuggestionsRef,
        grab,
        grabIntent: grabAnnotations.grabIntent,
        startGrabIntent: grabAnnotations.startGrabIntent,
        browserAnnotationsLength: annotationSend.browserAnnotations.length,
        isBlankTab,
        markupIsActive,
        markupStart,
        markupCancel
      }
    ),
    resourceNotice ? /* @__PURE__ */ jsxs27("div", { className: "flex items-center justify-between gap-2 border-b border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground", children: [
      /* @__PURE__ */ jsx35("span", { children: resourceNotice }),
      /* @__PURE__ */ jsx35(
        "button",
        {
          type: "button",
          onClick: () => setResourceNotice(null),
          className: "shrink-0 text-muted-foreground/60 hover:text-foreground",
          "aria-label": translate("auto.components.browser.pane.BrowserPane.2fdca7df09", "Dismiss"),
          children: "\u2715"
        }
      )
    ] }) : null
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/use-browser-page-chrome-focus.ts
import { useCallback as useCallback8, useEffect as useEffect12, useRef as useRef9 } from "react";

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
  const keepAddressBarFocusRef = useRef9(false);
  const addressBarFocusGrabRef = useRef9(null);
  const cancelAddressBarFocusGrab = useCallback8(() => {
    addressBarFocusGrabRef.current?.();
  }, []);
  const focusAddressBarNow = useCallback8(
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
  const focusGuestNow = useCallback8(() => {
    if (!guestFocus.isAttached()) {
      return false;
    }
    addressBarInputRef.current?.blur();
    return guestFocus.focus();
  }, [addressBarInputRef, guestFocus]);
  const startAddressBarFocusGrab = useCallback8(
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
  useEffect12(() => {
    if (!isActive) {
      return;
    }
    if (!consumeAddressBarFocusRequest(browserTabId)) {
      return;
    }
    return startAddressBarFocusGrab();
  }, [browserTabId, consumeAddressBarFocusRequest, isActive, startAddressBarFocusGrab]);
  useEffect12(() => {
    if (!isActive) {
      return;
    }
    return window.browserAPI.onFocusAddressBar(({ browserPageId }) => {
      if (browserPageId === browserTabId) {
        focusAddressBarNow();
      }
    });
  }, [browserTabId, focusAddressBarNow, isActive]);
  useEffect12(() => {
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
  useEffect12(() => {
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
  useEffect12(() => {
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
import { useMemo as useMemo5 } from "react";
function useWebviewGuestFocus(webviewRef) {
  return useMemo5(
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

// src/renderer/components/browser-pane/host-guest/use-browser-page-viewport-scroll-reporting.ts
import { useEffect as useEffect13 } from "react";
function useBrowserPageViewportScrollReporting(browserPageId, scroller, viewportPresetId) {
  useEffect13(() => {
    let reportFrame = null;
    const send = () => {
      reportFrame = null;
      const state = getBrowserPageViewportScrollState(browserPageId);
      if (state) {
        window.browserAPI?.reportViewportScrollState?.({ browserPageId, state });
      }
    };
    const report = () => {
      if (typeof requestAnimationFrame === "undefined") {
        send();
        return;
      }
      if (reportFrame === null) {
        reportFrame = requestAnimationFrame(send);
      }
    };
    report();
    if (!scroller) {
      return () => {
        if (reportFrame !== null && typeof cancelAnimationFrame !== "undefined") {
          cancelAnimationFrame(reportFrame);
        }
      };
    }
    scroller.addEventListener("scroll", report, { passive: true });
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(report);
    resizeObserver?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", report);
      resizeObserver?.disconnect();
      if (reportFrame !== null && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(reportFrame);
      }
    };
  }, [browserPageId, scroller, viewportPresetId]);
}

// src/renderer/components/browser-pane/host-guest/browser-page-paintability.ts
function isBrowserPagePanePaintable({ isActive }) {
  return isActive;
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-slot-viewport.ts
import { useCallback as useCallback9, useSyncExternalStore as useSyncExternalStore3 } from "react";
function useBrowserPageSlotViewport(workspaceId) {
  const subscribe = useCallback9(
    (listener) => subscribeBrowserOverlaySlotViewport(workspaceId, listener),
    [workspaceId]
  );
  const getSnapshot = useCallback9(() => getBrowserOverlaySlotViewport(workspaceId), [workspaceId]);
  return useSyncExternalStore3(subscribe, getSnapshot, () => null);
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-webview-lifecycle.ts
import {
  useCallback as useCallback10,
  useEffect as useEffect14,
  useLayoutEffect as useLayoutEffect4,
  useRef as useRef10,
  useState as useState10
} from "react";

// src/shared/non-secure-context-uuid.ts
function createNonSecureContextUuid() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  return bytesToUuid(bytes);
}
function bytesToUuid(bytes) {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

// src/renderer/components/browser-pane/describe-page/browser-annotation-geometry.ts
import { MessageCircleQuestionMark, PencilLine } from "lucide-react";
var BROWSER_ANNOTATION_INTENT_OPTIONS = [
  {
    value: "change",
    get label() {
      return translate("auto.components.browser.pane.BrowserPane.143204e423", "Change");
    },
    icon: PencilLine
  },
  {
    value: "question",
    get label() {
      return translate("auto.components.browser.pane.BrowserPane.b5ba6085de", "Question");
    },
    icon: MessageCircleQuestionMark
  }
];
var DEFAULT_BROWSER_ANNOTATION_PRIORITY = "important";
var EMPTY_BROWSER_ANNOTATIONS = [];
var PENDING_ANNOTATION_CARD_HEIGHT = 240;
var PENDING_ANNOTATION_CARD_WIDTH = 352;
var PENDING_ANNOTATION_CARD_MARGIN = 22;
function createBrowserAnnotationId() {
  return `browser-annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function createBrowserAnnotationPayload(payload) {
  return {
    ...payload,
    // Why: annotations are persisted; screenshot data is a transient copy payload that can be megabytes per selection.
    screenshot: null
  };
}
var BROWSER_OVERLAY_SIDES = ["bottom", "top", "right", "left"];
function pickBrowserOverlaySide(space, cardHeight) {
  const vertical = cardHeight + PENDING_ANNOTATION_CARD_MARGIN;
  const horizontal = PENDING_ANNOTATION_CARD_WIDTH + PENDING_ANNOTATION_CARD_MARGIN;
  const room = {
    bottom: space.bottom / vertical,
    top: space.top / vertical,
    right: space.right / horizontal,
    left: space.left / horizontal
  };
  const fitting = BROWSER_OVERLAY_SIDES.find((side) => room[side] >= 1);
  return fitting ?? (room.bottom >= room.top ? "bottom" : "top");
}
function getBrowserOverlayAnchor(payload, container, webview, viewport, cardHeight = null) {
  const containerRect = container?.getBoundingClientRect();
  const webviewRect = webview?.getBoundingClientRect();
  const rect = getLiveBrowserAnnotationRect(payload, viewport);
  const guestWidth = viewport.viewportWidth ?? payload.page.viewportWidth;
  const scale = webviewRect && webviewRect.width > 0 && guestWidth > 0 ? webviewRect.width / guestWidth : 1;
  const offsetX = (webviewRect?.left ?? 0) - (containerRect?.left ?? 0);
  const offsetY = (webviewRect?.top ?? 0) - (containerRect?.top ?? 0);
  const containerWidth = containerRect?.width ?? 0;
  const containerHeight = containerRect?.height ?? 0;
  const width = rect.width * scale;
  const height = rect.height * scale;
  const elementLeft = offsetX + rect.x * scale;
  const elementRight = elementLeft + width;
  const elementTop = offsetY + rect.y * scale;
  const elementBottom = elementTop + height;
  const side = pickBrowserOverlaySide(
    {
      top: elementTop,
      bottom: containerHeight - elementBottom,
      left: elementLeft,
      right: containerWidth - elementRight
    },
    cardHeight ?? PENDING_ANNOTATION_CARD_HEIGHT
  );
  const edge = {
    top: { x: elementLeft + width / 2, y: elementTop },
    bottom: { x: elementLeft + width / 2, y: elementBottom },
    left: { x: elementLeft, y: elementTop + height / 2 },
    right: { x: elementRight, y: elementTop + height / 2 }
  }[side];
  return {
    x: clampNumber(edge.x, 12, Math.max(12, containerWidth - 12)),
    y: clampNumber(edge.y, 12, Math.max(12, containerHeight - 12)),
    side
  };
}
function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function getLiveBrowserAnnotationRect(payload, viewport) {
  if (viewport.target) {
    return viewport.target;
  }
  if (payload.target.isFixed) {
    return payload.target.rectViewport;
  }
  const scrollX = viewport.version === 0 ? payload.page.scrollX : viewport.scrollX;
  const scrollY = viewport.version === 0 ? payload.page.scrollY : viewport.scrollY;
  return {
    ...payload.target.rectViewport,
    x: payload.target.rectPage.x - scrollX,
    y: payload.target.rectPage.y - scrollY
  };
}
function applyBrowserAnnotationViewportReport(current, report) {
  const unchanged = current.scrollX === report.scrollX && current.scrollY === report.scrollY && current.viewportWidth === report.viewportWidth && sameRect(current.target, report.target);
  if (unchanged) {
    return current.version === 0 ? { ...current, version: 1 } : current;
  }
  return { ...report, version: current.version + 1 };
}
function sameRect(a, b) {
  return a === b || !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

// src/renderer/components/browser-pane/annotate/browser-annotation-page-url.ts
function browserAnnotationMatchesPageUrl(capturedUrl, currentUrl) {
  try {
    const captured = new URL(capturedUrl);
    const current = new URL(currentUrl);
    captured.username = "";
    captured.password = "";
    current.username = "";
    current.password = "";
    current.search = "";
    current.hash = "";
    return captured.href === current.href;
  } catch {
    return false;
  }
}

// src/renderer/components/browser-pane/annotate/guest-annotation-viewport-bridge.ts
function syncGuestAnnotationViewportBridge({
  toolTargetId,
  annotations,
  currentDocument,
  pendingPayload,
  surfaceActive,
  token
}) {
  const eligibleIds = currentDocument ? new Set(currentDocument.markerIds) : null;
  const markers = annotations.flatMap(
    (annotation, index) => currentDocument && (!eligibleIds?.has(annotation.id) || !browserAnnotationMatchesPageUrl(annotation.payload.page.sanitizedUrl, currentDocument.url)) ? [] : [
      {
        id: annotation.id,
        index,
        isFixed: annotation.payload.target.isFixed === true,
        rectPage: annotation.payload.target.rectPage,
        rectViewport: annotation.payload.target.rectViewport
      }
    ]
  );
  void window.browserAPI.setAnnotationViewportBridge({
    browserPageId: toolTargetId,
    emitViewport: pendingPayload !== null,
    enabled: surfaceActive && (pendingPayload !== null || markers.length > 0),
    markers,
    selectionId: pendingPayload?.page.capturedAt,
    token
  }).catch(() => {
  });
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
  viewportPresetIdRef,
  onUpdatePageStateRef,
  setGuestRecoveryGeneration,
  setBrowserZoomPercent,
  focusAddressBarNow,
  syncNavigationState,
  syncBrowserAnnotationViewportBridge
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
      syncBrowserAnnotationViewportBridge();
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
    const queuedAnnotationViewportBridgeSync = liveWebContentsId === null || registeredWebContentsIds.get(browserTabId) !== liveWebContentsId;
    if (queuedAnnotationViewportBridgeSync) {
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
        syncBrowserAnnotationViewportBridge();
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
    if (!queuedAnnotationViewportBridgeSync) {
      syncBrowserAnnotationViewportBridge();
    }
    const appliedLevel = setBrowserPageZoomLevel(webview, paneZoomLevelRef.current);
    if (appliedLevel !== null) {
      setBrowserZoomPercent(browserPageZoomLevelToPercent(appliedLevel));
    }
    const preset = getBrowserViewportPreset(viewportPresetIdRef.current);
    void window.browserAPI.setViewportOverride({
      browserPageId: browserTabId,
      override: preset ? browserViewportPresetToOverride(preset) : null
    });
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
  invalidateBrowserAnnotationDocumentRef,
  onUpdatePageStateRef,
  onSetUrlRef,
  setBrowserOverlayViewport,
  setAddressBarValue,
  focusAddressBarNow
}) {
  const handleDidStartLoading = () => {
    invalidateBrowserAnnotationDocumentRef.current();
    setBrowserOverlayViewport({ scrollX: 0, scrollY: 0, version: 0 });
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

// src/shared/browser-annotation-viewport-report.ts
function isValidBrowserGrabRect(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const rect = value;
  return typeof rect.x === "number" && Number.isFinite(rect.x) && typeof rect.y === "number" && Number.isFinite(rect.y) && typeof rect.width === "number" && Number.isFinite(rect.width) && rect.width >= 0 && typeof rect.height === "number" && Number.isFinite(rect.height) && rect.height >= 0;
}
var finiteOr = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
function parseBrowserAnnotationViewportReport(json) {
  let next;
  try {
    next = JSON.parse(json);
  } catch {
    return null;
  }
  if (!next || typeof next !== "object") {
    return null;
  }
  const viewportWidth = finiteOr(next.viewportWidth, 0);
  return {
    scrollX: finiteOr(next.scrollX, 0),
    scrollY: finiteOr(next.scrollY, 0),
    ...viewportWidth > 0 ? { viewportWidth } : {},
    ...isValidBrowserGrabRect(next.target) ? { target: next.target } : {}
  };
}

// src/shared/browser-annotation-viewport-bridge.ts
var BROWSER_ANNOTATION_VIEWPORT_MESSAGE_PREFIX = "__orca_annotation_viewport__:";

// src/renderer/components/browser-pane/annotate/browser-annotation-viewport-message.ts
function consumeBrowserAnnotationViewportMessage(event, token, setViewport) {
  const message = typeof event.message === "string" ? event.message : "";
  const prefix = `${BROWSER_ANNOTATION_VIEWPORT_MESSAGE_PREFIX}${token}:`;
  if (!message.startsWith(prefix)) {
    return;
  }
  const report = parseBrowserAnnotationViewportReport(message.slice(prefix.length));
  if (report) {
    setViewport((current) => applyBrowserAnnotationViewportReport(current, report));
  }
}

// src/renderer/components/browser-pane/host-guest/browser-page-webview-navigation-handlers.ts
function createBrowserPageWebviewNavigationHandlers({
  webview,
  browserTabId,
  browserTabUrl,
  recoveryNavigationValidationRef,
  activeLoadFailureRef,
  lastKnownWebviewUrlRef,
  invalidateBrowserAnnotationDocumentRef,
  addressBarInputRef,
  onSetUrlRef,
  onUpdatePageStateRef,
  addBrowserHistoryEntryRef,
  faviconUrlRef,
  setAddressBarValue,
  annotationViewportBridgeTokenRef,
  setBrowserOverlayViewport
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
    if (event.isMainFrame && event.url) {
      invalidateBrowserAnnotationDocumentRef.current();
    }
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
    if (lastKnownWebviewUrlRef.current !== normalizedBrowserModelUrl) {
      invalidateBrowserAnnotationDocumentRef.current();
    }
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
  const handleAnnotationViewportMessage = (event) => {
    consumeBrowserAnnotationViewportMessage(
      event,
      annotationViewportBridgeTokenRef.current,
      setBrowserOverlayViewport
    );
  };
  return {
    handleDidStartNavigation,
    handleDidRedirectNavigation,
    handleFullDidNavigate,
    handleDidNavigateInPage,
    handleTitleUpdate,
    handleFaviconUpdate,
    handleAnnotationViewportMessage
  };
}

// src/renderer/components/browser-pane/host-guest/bind-browser-page-webview-listeners.ts
function resolveInitialWebviewUrl(rawUrl) {
  const normalized = normalizeBrowserNavigationUrl(rawUrl);
  return normalized && !isFileUrl(normalized) ? normalized : ORCA_BROWSER_BLANK_URL;
}
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
    viewportPresetIdRef,
    onUpdatePageStateRef,
    setGuestRecoveryGeneration,
    setBrowserZoomPercent,
    focusAddressBarNow,
    syncNavigationState,
    syncBrowserAnnotationViewportBridge,
    faviconUrlRef,
    addressBarInputRef,
    lastKnownWebviewUrlRef,
    trackNextLoadingEventRef,
    invalidateBrowserAnnotationDocumentRef,
    onSetUrlRef,
    setBrowserOverlayViewport,
    setAddressBarValue,
    addBrowserHistoryEntryRef,
    annotationViewportBridgeTokenRef,
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
    viewportPresetIdRef,
    onUpdatePageStateRef,
    setGuestRecoveryGeneration,
    setBrowserZoomPercent,
    focusAddressBarNow,
    syncNavigationState,
    syncBrowserAnnotationViewportBridge
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
    invalidateBrowserAnnotationDocumentRef,
    onUpdatePageStateRef,
    onSetUrlRef,
    setBrowserOverlayViewport,
    setAddressBarValue,
    focusAddressBarNow
  });
  const {
    handleDidStartNavigation,
    handleDidRedirectNavigation,
    handleFullDidNavigate,
    handleDidNavigateInPage,
    handleTitleUpdate,
    handleFaviconUpdate,
    handleAnnotationViewportMessage
  } = createBrowserPageWebviewNavigationHandlers({
    webview,
    browserTabId,
    browserTabUrl,
    recoveryNavigationValidationRef,
    activeLoadFailureRef,
    lastKnownWebviewUrlRef,
    invalidateBrowserAnnotationDocumentRef,
    addressBarInputRef,
    onSetUrlRef,
    onUpdatePageStateRef,
    addBrowserHistoryEntryRef,
    faviconUrlRef,
    setAddressBarValue,
    annotationViewportBridgeTokenRef,
    setBrowserOverlayViewport
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
  webview.addEventListener("console-message", handleAnnotationViewportMessage);
  if (needsInitialNavigation) {
    const initialUrl = resolveInitialWebviewUrl(initialBrowserUrlRef.current);
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
    webview.removeEventListener("console-message", handleAnnotationViewportMessage);
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
  args.invalidateBrowserAnnotationDocumentRef.current();
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
  cancelPendingBrowserCapture,
  setBrowserOverlayViewport,
  setFindOpen,
  focusAddressBarNow,
  focusWebviewNow,
  paneZoomLevelRef,
  viewportPresetId,
  setBrowserZoomPercent,
  pendingAnnotationPayload,
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
  const [guestRecoveryGeneration, setGuestRecoveryGeneration] = useState10(0);
  const guestRecoveryPendingRef = useRef10(false);
  const validateVisibleGuestRegistrationRef = useRef10(() => {
  });
  const wasPaintableForGuestValidationRef = useRef10(isPaintable);
  const browserTabLoadingRef = useRef10(browserTabLoading);
  const inputLockedRef = useRef10(inputLocked);
  const faviconUrlRef = useRef10(faviconUrl);
  const initialBrowserUrlRef = useRef10(browserTabUrl);
  const viewportPresetIdRef = useRef10(viewportPresetId);
  const addBrowserHistoryEntry = useBrowserStore((s) => s.addBrowserHistoryEntry);
  const addBrowserHistoryEntryRef = useRef10(addBrowserHistoryEntry);
  const isPaintableRef = useRef10(isPaintable);
  const annotationViewportBridgeTokenRef = useRef10(void 0);
  annotationViewportBridgeTokenRef.current ??= createNonSecureContextUuid().replaceAll("-", "");
  const isActiveRef = useRef10(isActive);
  const pendingAnnotationPayloadRef = useRef10(pendingAnnotationPayload);
  const browserAnnotations = useBrowserAnnotationStore(
    (s) => s.browserAnnotationsByPageId[browserTabId] ?? EMPTY_BROWSER_ANNOTATIONS
  );
  const browserAnnotationMarkerIds = useBrowserAnnotationStore(
    (s) => s.browserAnnotationMarkerIdsByPageId[browserTabId]
  );
  const invalidatePendingCaptureRef = useRef10(cancelPendingBrowserCapture);
  useLayoutEffect4(() => {
    browserTabLoadingRef.current = browserTabLoading;
    inputLockedRef.current = inputLocked;
    viewportPresetIdRef.current = viewportPresetId;
    isActiveRef.current = isActive;
    pendingAnnotationPayloadRef.current = pendingAnnotationPayload;
    invalidatePendingCaptureRef.current = cancelPendingBrowserCapture;
    isPaintableRef.current = isPaintable;
  }, [
    browserTabLoading,
    cancelPendingBrowserCapture,
    inputLocked,
    isActive,
    isPaintable,
    pendingAnnotationPayload,
    viewportPresetId
  ]);
  useLayoutEffect4(() => {
    const webview = webviewRef.current;
    if (webview) {
      setBrowserPageWebviewInputLock(webview, inputLocked);
    }
  }, [inputLocked, webviewRef]);
  useEffect14(() => {
    initialBrowserUrlRef.current = browserTabUrl;
  }, [browserTabId, browserTabUrl]);
  useEffect14(() => {
    browserTabUrlRef.current = browserTabUrl;
  }, [browserTabUrl, browserTabUrlRef]);
  useEffect14(() => {
    activeLoadFailureRef.current = browserTabLoadError;
  }, [activeLoadFailureRef, browserTabLoadError]);
  useEffect14(() => {
    onUpdatePageStateRef.current = onUpdatePageState;
    onSetUrlRef.current = onSetUrl;
    addBrowserHistoryEntryRef.current = addBrowserHistoryEntry;
  }, [onSetUrl, onUpdatePageState, addBrowserHistoryEntry, onSetUrlRef, onUpdatePageStateRef]);
  const syncNavigationState = useCallback10(
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
  const syncBrowserAnnotationViewportBridge = useCallback10(() => {
    const state = useBrowserAnnotationStore.getState();
    syncGuestAnnotationViewportBridge({
      toolTargetId: browserTabId,
      annotations: state.browserAnnotationsByPageId[browserTabId] ?? EMPTY_BROWSER_ANNOTATIONS,
      currentDocument: {
        markerIds: state.browserAnnotationMarkerIdsByPageId[browserTabId] ?? [],
        url: browserTabUrlRef.current
      },
      pendingPayload: pendingAnnotationPayloadRef.current,
      surfaceActive: isActiveRef.current,
      token: annotationViewportBridgeTokenRef.current
    });
  }, [browserTabId, browserTabUrlRef]);
  const invalidateBrowserAnnotationDocument = useCallback10(() => {
    useBrowserAnnotationStore.getState().invalidateBrowserPageAnnotationGeometry(browserTabId);
    invalidatePendingCaptureRef.current();
    pendingAnnotationPayloadRef.current = null;
    syncBrowserAnnotationViewportBridge();
  }, [browserTabId, syncBrowserAnnotationViewportBridge]);
  const invalidateBrowserAnnotationDocumentRef = useRef10(invalidateBrowserAnnotationDocument);
  useLayoutEffect4(() => {
    invalidateBrowserAnnotationDocumentRef.current = invalidateBrowserAnnotationDocument;
  }, [invalidateBrowserAnnotationDocument]);
  useEffect14(() => {
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
      viewportPresetIdRef,
      onUpdatePageStateRef,
      setGuestRecoveryGeneration,
      setBrowserZoomPercent,
      focusAddressBarNow,
      syncNavigationState,
      syncBrowserAnnotationViewportBridge,
      faviconUrlRef,
      addressBarInputRef,
      lastKnownWebviewUrlRef,
      trackNextLoadingEventRef,
      invalidateBrowserAnnotationDocumentRef,
      onSetUrlRef,
      setBrowserOverlayViewport,
      setAddressBarValue,
      addBrowserHistoryEntryRef,
      annotationViewportBridgeTokenRef,
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
    syncNavigationState,
    syncBrowserAnnotationViewportBridge
  ]);
  useEffect14(() => {
    const becamePaintable = isPaintable && !wasPaintableForGuestValidationRef.current;
    wasPaintableForGuestValidationRef.current = isPaintable;
    if (becamePaintable) {
      validateVisibleGuestRegistrationRef.current();
    }
  }, [isPaintable]);
  useEffect14(() => {
    syncBrowserAnnotationViewportBridge();
  }, [
    browserAnnotations,
    browserAnnotationMarkerIds,
    browserTabId,
    browserTabUrl,
    isActive,
    pendingAnnotationPayload,
    syncBrowserAnnotationViewportBridge
  ]);
  return {
    syncBrowserAnnotationViewportBridge
  };
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-webview-partition.ts
function useBrowserPageWebviewPartition(args) {
  const profilePartition = useBrowserSessionStore(
    (state) => args.sessionProfileId === null ? null : state.browserSessionProfiles.find((profile) => profile.id === args.sessionProfileId)?.partition ?? null
  );
  return args.sessionPartition ?? profilePartition ?? ORCA_BROWSER_PARTITION;
}

// src/renderer/components/browser-pane/host-guest/use-browser-page-zoom-feedback.ts
import { useCallback as useCallback11, useEffect as useEffect15, useRef as useRef11, useState as useState11 } from "react";
var BROWSER_PAGE_ZOOM_FEEDBACK_MS = 1400;
var noopSetDefaultZoomLevel = () => {
};
function useBrowserPageZoomFeedback(browserTabId) {
  const browserDefaultZoomPercent = browserPageZoomLevelToPercent(DEFAULT_BROWSER_PAGE_ZOOM_LEVEL);
  const [initialZoomLevel] = useState11(
    () => getExplicitBrowserPageZoomLevel(browserTabId) ?? DEFAULT_BROWSER_PAGE_ZOOM_LEVEL
  );
  const paneZoomLevelRef = useRef11(initialZoomLevel);
  const [browserZoomPercent, setBrowserZoomPercent] = useState11(
    browserPageZoomLevelToPercent(initialZoomLevel)
  );
  const [browserZoomFeedbackVisible, setBrowserZoomFeedbackVisible] = useState11(false);
  const browserZoomFeedbackTimerRef = useRef11(void 0);
  useEffect15(() => {
    return () => {
      clearTimeout(browserZoomFeedbackTimerRef.current);
    };
  }, []);
  const showBrowserZoomFeedback = useCallback11((level) => {
    setBrowserZoomPercent(browserPageZoomLevelToPercent(level));
    setBrowserZoomFeedbackVisible(true);
    clearTimeout(browserZoomFeedbackTimerRef.current);
    browserZoomFeedbackTimerRef.current = setTimeout(() => {
      setBrowserZoomFeedbackVisible(false);
    }, BROWSER_PAGE_ZOOM_FEEDBACK_MS);
  }, []);
  return {
    paneZoomLevelRef,
    browserZoomPercent,
    setBrowserZoomPercent,
    browserZoomFeedbackVisible,
    showBrowserZoomFeedback,
    browserDefaultZoomPercent,
    setBrowserDefaultZoomLevel: noopSetDefaultZoomLevel
  };
}

// src/renderer/components/browser-pane/navigate/use-browser-page-resource-notices.ts
import { useEffect as useEffect16, useState as useState12 } from "react";

// src/renderer/components/browser-pane/navigate/browser-notices.ts
function humanizePermission(permission) {
  switch (permission) {
    case "media":
      return "camera or microphone access";
    case "pointerLock":
      return "pointer lock";
    case "storage-access":
      return "access to its own cookies and storage while embedded on this page";
    case "top-level-storage-access":
      return "cookie access on behalf of an embedded site";
    case "geolocation":
      return "your location";
    case "idle-detection":
      return "permission to detect when you are idle";
    case "display-capture":
      return "permission to capture your screen";
    case "window-management":
      return "screen information and multi-screen window placement";
    case "keyboardLock":
      return "permission to capture keyboard input";
    case "openExternal":
      return "permission to open a link outside this app";
    case "fileSystem":
      return "access to your files or folders";
    case "hid":
      return "access to a connected human interface device";
    case "usb":
      return "access to a USB device";
    case "serial":
      return "access to a serial device";
    case "midi":
      return "access to your MIDI devices";
    case "midiSysex":
      return "access to system-exclusive MIDI messages";
    case "mediaKeySystem":
      return "access to protected media playback";
    case "speaker-selection":
      return "permission to choose an audio output device";
    default:
      return permission;
  }
}
function formatPermissionNotice(event) {
  const target = event.origin === "unknown" ? "this page" : event.origin;
  return `${target} asked for ${humanizePermission(event.permission)}, and the browser denied it.`;
}
function formatPopupNotice(event) {
  const target = event.origin === "unknown" ? "A site" : event.origin;
  if (event.action === "opened-in-orca") {
    return null;
  }
  if (event.action === "opened-external") {
    return `${target} opened a new window in your default browser.`;
  }
  return `${target} tried to open a popup this app does not support here.`;
}
function formatLoadFailureDescription(loadError, meta) {
  if (!loadError) {
    return "The page did not respond.";
  }
  if (loadError.code === BROWSER_GUEST_RECOVERY_ERROR_CODE) {
    return loadError.description;
  }
  if (meta.isLocalhostLike) {
    return "We couldn't connect to your local server.";
  }
  if (loadError.code === 0) {
    return loadError.description;
  }
  return "We couldn't connect to this page.";
}
function formatLoadFailureRecoveryHint(meta, loadError) {
  if (!meta.isLocalhostLike || loadError?.code === BROWSER_GUEST_RECOVERY_ERROR_CODE) {
    return null;
  }
  return "If this should be a local app, make sure the server is running and listening on the expected port.";
}

// src/renderer/components/browser-pane/navigate/use-browser-page-resource-notices.ts
function useBrowserPageResourceNotices(browserTabId) {
  const [resourceNotice, setResourceNotice] = useState12(null);
  useEffect16(() => {
    if (!resourceNotice) {
      return;
    }
    const timer = setTimeout(() => setResourceNotice(null), 1e4);
    return () => clearTimeout(timer);
  }, [resourceNotice]);
  useEffect16(() => {
    return window.browserAPI.onPermissionDenied((event) => {
      if (event.browserPageId !== browserTabId) {
        return;
      }
      setResourceNotice(formatPermissionNotice(event));
    });
  }, [browserTabId]);
  useEffect16(() => {
    return window.browserAPI.onPopup((event) => {
      if (event.browserPageId !== browserTabId) {
        return;
      }
      const notice = formatPopupNotice(event);
      if (notice) {
        setResourceNotice(notice);
      }
    });
  }, [browserTabId]);
  return { resourceNotice, setResourceNotice };
}

// src/renderer/components/browser-pane/annotate/use-browser-page-annotation-send.ts
import {
  useCallback as useCallback12,
  useEffect as useEffect17,
  useLayoutEffect as useLayoutEffect5,
  useMemo as useMemo6,
  useRef as useRef12,
  useState as useState13
} from "react";
import { toast as toast6 } from "sonner";

// src/renderer/components/browser-pane/annotate/browser-annotation-output.ts
function formatPageHeading(payload) {
  try {
    const url = new URL(payload.page.sanitizedUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return payload.page.sanitizedUrl || "current page";
  }
}
function annotationElementLabel(payload) {
  const react = payload.target.reactComponents;
  const accessibleName = payload.target.accessibility.accessibleName;
  const base = accessibleName ? `${payload.target.tagName} "${inlineText(accessibleName)}"` : payload.target.textSnippet ? `${payload.target.tagName} "${inlineText(payload.target.textSnippet).slice(0, 60)}"` : payload.target.tagName;
  return react ? `${inlineText(react)} ${base}` : base;
}
var BROWSER_ANNOTATION_INLINE_TEXT_MAX_LENGTH = 2048;
function inlineText(content, maxLength = BROWSER_ANNOTATION_INLINE_TEXT_MAX_LENGTH) {
  let normalized = "";
  let pendingSpace = false;
  for (let index = 0; index < content.length && normalized.length < maxLength; ) {
    const code = content.charCodeAt(index);
    if (isInlineWhitespaceCode(code)) {
      if (code === 13 && content.charCodeAt(index + 1) === 10) {
        index += 1;
      }
      pendingSpace = normalized.length > 0;
      index += 1;
      continue;
    }
    const codePoint = content.codePointAt(index);
    if (codePoint === void 0) {
      break;
    }
    const char = String.fromCodePoint(codePoint);
    const extraSpaceLength = pendingSpace ? 1 : 0;
    if (normalized.length + extraSpaceLength + char.length > maxLength) {
      break;
    }
    if (pendingSpace) {
      normalized += " ";
      pendingSpace = false;
    }
    normalized += char;
    index += char.length;
  }
  return normalized;
}
function isInlineWhitespaceCode(code) {
  return code === 32 || code >= 9 && code <= 13 || code === 160 || code === 5760 || code >= 8192 && code <= 8202 || code === 8232 || code === 8233 || code === 8239 || code === 8287 || code === 12288 || code === 65279;
}
function formatStyles(styles) {
  const lines = [];
  const entries = [
    ["display", styles.display],
    ["position", styles.position],
    ["width", styles.width],
    ["height", styles.height],
    ["margin", styles.margin],
    ["padding", styles.padding],
    ["color", styles.color],
    ["background", styles.backgroundColor],
    ["border", styles.border],
    ["border-radius", styles.borderRadius],
    ["font-family", styles.fontFamily],
    ["font-size", styles.fontSize],
    ["font-weight", styles.fontWeight],
    ["line-height", styles.lineHeight],
    ["text-align", styles.textAlign],
    ["z-index", styles.zIndex]
  ];
  for (const [name, value] of entries) {
    if (!value || value === "auto" || value === "normal") {
      continue;
    }
    if (name === "position" && value === "static") {
      continue;
    }
    if (name === "display" && value === "inline") {
      continue;
    }
    if (name === "background" && value === "rgba(0, 0, 0, 0)") {
      continue;
    }
    lines.push(`- ${name}: ${value}`);
  }
  return lines;
}
function maxBacktickRunLength(content, floor) {
  let maxRun = floor;
  let currentRun = 0;
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) !== 96) {
      currentRun = 0;
      continue;
    }
    currentRun += 1;
    if (currentRun > maxRun) {
      maxRun = currentRun;
    }
  }
  return maxRun;
}
function fence(language, content) {
  const maxRun = maxBacktickRunLength(content, 3);
  const marker = "`".repeat(maxRun + 1);
  return [`${marker}${language}`, content, marker];
}
function inlineCode(content) {
  const maxRun = maxBacktickRunLength(content, 0);
  const marker = "`".repeat(maxRun + 1);
  const padding = content.startsWith("`") || content.endsWith("`") ? " " : "";
  return `${marker}${padding}${content}${padding}${marker}`;
}
function formatBrowserAnnotationsAsMarkdown(annotations) {
  if (annotations.length === 0) {
    return "";
  }
  const firstAnnotation = annotations[0];
  const first = firstAnnotation.payload;
  const groups = /* @__PURE__ */ new Map();
  annotations.forEach((annotation, index) => {
    const url = annotation.payload.page.sanitizedUrl;
    const entries = groups.get(url) ?? [];
    entries.push({ annotation, index });
    groups.set(url, entries);
  });
  const mixedPages = groups.size > 1;
  const lines = mixedPages ? ["## Design Feedback across pages", ""] : [
    `## Design Feedback: ${formatPageHeading(first)}`,
    "",
    `**URL:** ${first.page.sanitizedUrl}`,
    `**Browser tab id:** ${firstAnnotation.browserPageId}`,
    `**Viewport:** ${first.page.viewportWidth}x${first.page.viewportHeight}`,
    ""
  ];
  for (const [url, entries] of groups) {
    if (mixedPages) {
      lines.push(
        `## Design Feedback: ${inlineText(formatPageHeading(entries[0].annotation.payload))}`
      );
      lines.push("", `**URL:** ${inlineCode(inlineText(url))}`, "");
    }
    entries.forEach(({ annotation, index }) => {
      const { payload } = annotation;
      const { target } = payload;
      const rect = target.rectViewport;
      const styleLines = formatStyles(target.computedStyles);
      lines.push(`### ${index + 1}. ${annotationElementLabel(payload)}`);
      if (mixedPages) {
        lines.push(`**Browser tab id:** ${inlineCode(inlineText(annotation.browserPageId))}`);
        lines.push(`**Viewport:** ${payload.page.viewportWidth}x${payload.page.viewportHeight}`);
      }
      lines.push(`**Intent:** ${annotation.intent}`);
      lines.push(`**Selector:** ${inlineCode(target.selector)}`);
      if (target.elementPath) {
        lines.push(`**Location:** ${inlineCode(target.elementPath)}`);
      }
      if (target.sourceFile) {
        lines.push(`**Source:** ${inlineText(target.sourceFile)}`);
      }
      if (target.reactComponents) {
        lines.push(`**React:** ${inlineText(target.reactComponents)}`);
      }
      lines.push(
        `**Bounds:** x=${Math.round(rect.x)}, y=${Math.round(rect.y)}, ${Math.round(rect.width)}x${Math.round(rect.height)}`
      );
      if (target.cssClasses) {
        lines.push(`**Classes:** ${inlineCode(target.cssClasses)}`);
      }
      if (target.selectedText) {
        lines.push(`**Selected text:** "${inlineText(target.selectedText)}"`);
      } else if (target.textSnippet) {
        lines.push(`**Text:** "${inlineText(target.textSnippet)}"`);
      }
      if (payload.nearbyText.length > 0) {
        lines.push("**Nearby text:**");
        for (const text of payload.nearbyText) {
          lines.push(`- ${inlineText(text)}`);
        }
      }
      if (target.nearbyElements?.length) {
        lines.push("**Nearby elements:**");
        for (const element of target.nearbyElements) {
          lines.push(`- ${inlineText(element)}`);
        }
      }
      if (styleLines.length > 0) {
        lines.push("**Computed styles:**");
        lines.push(...styleLines);
      }
      if (target.fullPath) {
        lines.push(`**Full DOM path:** ${inlineCode(target.fullPath)}`);
      }
      if (target.htmlSnippet) {
        lines.push("**HTML:**");
        lines.push(...fence("html", target.htmlSnippet));
      }
      lines.push(`**Feedback:** ${inlineText(annotation.comment)}`);
      lines.push("");
    });
  }
  return lines.join("\n").trimEnd();
}

// src/renderer/components/browser-pane/annotate/GrabConfirmationSheet.tsx
import { Copy, Image as Image2, MessageSquarePlus as MessageSquarePlus3, X as X2 } from "lucide-react";

// src/renderer/ui/scroll-area.tsx
import * as ScrollAreaPrimitive from "radix-ui/scroll-area";
import { jsx as jsx36, jsxs as jsxs28 } from "react/jsx-runtime";
function ScrollArea({
  className,
  viewportClassName,
  viewportRef,
  viewportTabIndex,
  viewportProps,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs28(
    ScrollAreaPrimitive.Root,
    {
      "data-slot": "scroll-area",
      className: cn("relative", className),
      ...props,
      children: [
        /* @__PURE__ */ jsx36(
          ScrollAreaPrimitive.Viewport,
          {
            ref: viewportRef,
            tabIndex: viewportTabIndex,
            "data-slot": "scroll-area-viewport",
            className: cn(
              "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
              viewportClassName
            ),
            ...viewportProps,
            children
          }
        ),
        /* @__PURE__ */ jsx36(ScrollBar, {}),
        /* @__PURE__ */ jsx36(ScrollAreaPrimitive.Corner, {})
      ]
    }
  );
}
function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}) {
  return /* @__PURE__ */ jsx36(
    ScrollAreaPrimitive.ScrollAreaScrollbar,
    {
      "data-slot": "scroll-area-scrollbar",
      orientation,
      className: cn(
        "flex touch-none p-px transition-colors select-none bg-transparent",
        orientation === "vertical" && "h-full w-3 py-2 border-l border-l-transparent",
        orientation === "horizontal" && "h-3 px-2 flex-col border-t border-t-transparent",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx36(
        ScrollAreaPrimitive.ScrollAreaThumb,
        {
          "data-slot": "scroll-area-thumb",
          className: "relative flex-1 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/60"
        }
      )
    }
  );
}

// src/renderer/components/browser-pane/annotate/GrabConfirmationSheet.tsx
import { jsx as jsx37, jsxs as jsxs29 } from "react/jsx-runtime";
function formatGrabPayloadAsText(payload) {
  const lines = [];
  lines.push(`Attached browser context from ${payload.page.sanitizedUrl}`);
  lines.push("");
  lines.push("Selected element:");
  lines.push(payload.target.tagName);
  if (payload.target.accessibility.accessibleName) {
    lines.push(`Accessible name: "${payload.target.accessibility.accessibleName}"`);
  }
  if (payload.target.accessibility.role) {
    lines.push(`Role: ${payload.target.accessibility.role}`);
  }
  lines.push(`Selector: ${payload.target.selector}`);
  if (payload.target.sourceFile) {
    lines.push(`Source: ${payload.target.sourceFile}`);
  }
  if (payload.target.reactComponents) {
    lines.push(`React: ${payload.target.reactComponents}`);
  }
  const { rectViewport } = payload.target;
  lines.push(`Dimensions: ${Math.round(rectViewport.width)}x${Math.round(rectViewport.height)}`);
  lines.push("");
  if (payload.target.textSnippet) {
    lines.push("Text content:");
    lines.push(payload.target.textSnippet);
    lines.push("");
  }
  if (payload.nearbyText.length > 0) {
    lines.push("Nearby context:");
    for (const text of payload.nearbyText) {
      lines.push(`- ${text}`);
    }
    lines.push("");
  }
  const styles = payload.target.computedStyles;
  const styleLines = [];
  if (styles.display && styles.display !== "inline") {
    styleLines.push(`display: ${styles.display}`);
  }
  if (styles.position && styles.position !== "static") {
    styleLines.push(`position: ${styles.position}`);
  }
  if (styles.fontSize) {
    styleLines.push(`font-size: ${styles.fontSize}`);
  }
  if (styles.color) {
    styleLines.push(`color: ${styles.color}`);
  }
  if (styles.backgroundColor && styles.backgroundColor !== "rgba(0, 0, 0, 0)") {
    styleLines.push(`background: ${styles.backgroundColor}`);
  }
  if (styleLines.length > 0) {
    lines.push("Computed styles:");
    for (const sl of styleLines) {
      lines.push(`  ${sl}`);
    }
    lines.push("");
  }
  if (payload.target.htmlSnippet) {
    lines.push("HTML:");
    lines.push(payload.target.htmlSnippet);
    lines.push("");
  }
  if (payload.ancestorPath.length > 0) {
    lines.push(`Ancestor path: ${payload.ancestorPath.join(" > ")}`);
  }
  if (payload.target.fullPath) {
    lines.push(`Full DOM path: ${payload.target.fullPath}`);
  }
  return lines.join("\n").trimEnd();
}
function EscapedText({ text, className }) {
  return /* @__PURE__ */ jsx37("span", { className, children: text });
}
function getNearbyTextRows(nearbyText) {
  const counts = /* @__PURE__ */ new Map();
  return nearbyText.map((text) => {
    const count = counts.get(text) ?? 0;
    counts.set(text, count + 1);
    return { key: `${text}:${count}`, text };
  });
}
function GrabConfirmationSheet({
  payload,
  onCopy,
  onCopyScreenshot,
  onAttach,
  onCancel,
  busy = false
}) {
  const { target, page, nearbyText } = payload;
  const nearbyTextRows = getNearbyTextRows(nearbyText);
  return /* @__PURE__ */ jsxs29("div", { className: "absolute inset-0 z-20 flex flex-col bg-background/98 backdrop-blur-sm", children: [
    /* @__PURE__ */ jsxs29("div", { className: "flex items-center justify-between border-b border-border/70 px-4 py-3", children: [
      /* @__PURE__ */ jsxs29("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx37("div", { className: "rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400", children: translate("auto.components.browser.pane.GrabConfirmationSheet.f3575229df", "Grab") }),
        /* @__PURE__ */ jsx37("span", { className: "text-sm text-muted-foreground", children: translate(
          "auto.components.browser.pane.GrabConfirmationSheet.50f7114f99",
          "Review before attaching. Captured page context may include visible site content."
        ) })
      ] }),
      /* @__PURE__ */ jsx37(Button, { size: "icon", variant: "ghost", className: "h-7 w-7", onClick: onCancel, disabled: busy, children: /* @__PURE__ */ jsx37(X2, { className: "size-4" }) })
    ] }),
    /* @__PURE__ */ jsx37(ScrollArea, { className: "flex-1 p-4", children: /* @__PURE__ */ jsxs29("div", { className: "space-y-4", children: [
      payload.screenshot?.dataUrl?.startsWith("data:image/png;base64,") ? /* @__PURE__ */ jsx37("div", { className: "overflow-hidden rounded-lg border border-border/60", children: /* @__PURE__ */ jsx37(
        "img",
        {
          src: payload.screenshot.dataUrl,
          alt: translate(
            "auto.components.browser.pane.GrabConfirmationSheet.9c6ce0632a",
            "Selected element screenshot"
          ),
          className: "max-h-48 w-full object-contain bg-black/5"
        }
      ) }) : null,
      /* @__PURE__ */ jsxs29("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx37("h3", { className: "text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: translate(
          "auto.components.browser.pane.GrabConfirmationSheet.a759d8f866",
          "Selected Element"
        ) }),
        /* @__PURE__ */ jsxs29("div", { className: "rounded-lg border border-border/60 bg-muted/20 p-3 text-sm", children: [
          /* @__PURE__ */ jsxs29("div", { className: "flex items-baseline gap-2", children: [
            /* @__PURE__ */ jsx37("span", { className: "font-mono font-semibold text-foreground", children: /* @__PURE__ */ jsx37(EscapedText, { text: `<${target.tagName}>` }) }),
            target.accessibility.role ? /* @__PURE__ */ jsxs29("span", { className: "text-xs text-muted-foreground", children: [
              translate(
                "auto.components.browser.pane.GrabConfirmationSheet.d053db279d",
                "role="
              ),
              /* @__PURE__ */ jsx37(EscapedText, { text: target.accessibility.role })
            ] }) : null
          ] }),
          target.accessibility.accessibleName ? /* @__PURE__ */ jsxs29("div", { className: "mt-1 text-muted-foreground", children: [
            translate(
              "auto.components.browser.pane.GrabConfirmationSheet.accessibleNameOpenQuote",
              '"'
            ),
            /* @__PURE__ */ jsx37(EscapedText, { text: target.accessibility.accessibleName }),
            translate("auto.components.browser.pane.GrabConfirmationSheet.eb98a0971a", '"')
          ] }) : null,
          /* @__PURE__ */ jsx37("div", { className: "mt-1 font-mono text-xs text-muted-foreground/70", children: /* @__PURE__ */ jsx37(EscapedText, { text: target.selector }) }),
          /* @__PURE__ */ jsxs29("div", { className: "mt-1 text-xs text-muted-foreground/60", children: [
            Math.round(target.rectViewport.width),
            "x",
            Math.round(target.rectViewport.height)
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs29("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx37("h3", { className: "text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: translate("auto.components.browser.pane.GrabConfirmationSheet.9098b118ab", "Page") }),
        /* @__PURE__ */ jsxs29("div", { className: "rounded-lg border border-border/60 bg-muted/20 p-3 text-sm", children: [
          /* @__PURE__ */ jsx37("div", { className: "font-medium text-foreground", children: /* @__PURE__ */ jsx37(
            EscapedText,
            {
              text: page.title || translate(
                "auto.components.browser.pane.GrabConfirmationSheet.405bb315da",
                "Untitled"
              )
            }
          ) }),
          /* @__PURE__ */ jsx37("div", { className: "mt-0.5 text-xs text-muted-foreground/70", children: /* @__PURE__ */ jsx37(EscapedText, { text: page.sanitizedUrl }) })
        ] })
      ] }),
      target.htmlSnippet ? /* @__PURE__ */ jsxs29("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx37("h3", { className: "text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: translate("auto.components.browser.pane.GrabConfirmationSheet.7d1480fbf1", "HTML") }),
        /* @__PURE__ */ jsx37("pre", { className: "max-h-32 overflow-auto rounded-lg border border-border/60 bg-muted/20 p-3 font-mono text-xs text-foreground/80", children: /* @__PURE__ */ jsx37(EscapedText, { text: target.htmlSnippet }) })
      ] }) : null,
      nearbyText.length > 0 ? /* @__PURE__ */ jsxs29("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx37("h3", { className: "text-xs font-semibold uppercase tracking-wider text-muted-foreground", children: translate(
          "auto.components.browser.pane.GrabConfirmationSheet.effd75e330",
          "Nearby Context"
        ) }),
        /* @__PURE__ */ jsx37("div", { className: "rounded-lg border border-border/60 bg-muted/20 p-3", children: /* @__PURE__ */ jsx37("ul", { className: "list-inside list-disc space-y-0.5 text-sm text-muted-foreground", children: nearbyTextRows.map((row) => /* @__PURE__ */ jsx37("li", { children: /* @__PURE__ */ jsx37(EscapedText, { text: row.text }) }, row.key)) }) })
      ] }) : null
    ] }) }),
    /* @__PURE__ */ jsxs29("div", { className: "flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3", children: [
      /* @__PURE__ */ jsx37(Button, { variant: "ghost", size: "sm", onClick: onCancel, disabled: busy, children: translate("auto.components.browser.pane.GrabConfirmationSheet.87d97bdd6d", "Cancel") }),
      /* @__PURE__ */ jsxs29(Button, { variant: "outline", size: "sm", className: "gap-1.5", onClick: onCopy, children: [
        /* @__PURE__ */ jsx37(Copy, { className: "size-3.5" }),
        translate("auto.components.browser.pane.GrabConfirmationSheet.26fd87f4df", "Copy")
      ] }),
      onCopyScreenshot ? /* @__PURE__ */ jsxs29(Button, { variant: "outline", size: "sm", className: "gap-1.5", onClick: onCopyScreenshot, children: [
        /* @__PURE__ */ jsx37(Image2, { className: "size-3.5" }),
        translate(
          "auto.components.browser.pane.GrabConfirmationSheet.7095e98362",
          "Copy Screenshot"
        )
      ] }) : null,
      /* @__PURE__ */ jsxs29(Button, { size: "sm", className: "gap-1.5", onClick: onAttach, disabled: busy, children: [
        /* @__PURE__ */ jsx37(MessageSquarePlus3, { className: "size-3.5" }),
        translate("auto.components.browser.pane.sendToAgent.attach", "Send to agent")
      ] })
    ] })
  ] });
}

// src/renderer/components/browser-pane/annotate/browser-agent-send.ts
function compactImages(images) {
  return images.filter((image) => image !== null);
}
function buildGrabAgentPayload(payload) {
  return {
    kind: "grab",
    pageUrl: sanitizeAgentPageUrl(payload.page.sanitizedUrl),
    pageTitle: payload.page.title,
    text: formatGrabPayloadAsText(payload),
    images: compactImages([
      pngDataUrlToAgentImage(BROWSER_AGENT_IMAGE_NAMES.grab, payload.screenshot?.dataUrl)
    ])
  };
}
function buildAnnotationAgentPayload(annotations) {
  if (annotations.length === 0) {
    return null;
  }
  const { page } = annotations[0].payload;
  return {
    kind: "annotation",
    pageUrl: sanitizeAgentPageUrl(page.sanitizedUrl),
    pageTitle: page.title,
    text: formatBrowserAnnotationsAsMarkdown([...annotations]),
    images: []
  };
}
function formatMarkupAsText(args) {
  const heading = args.pageUrl ? `Screenshot markup from ${args.pageUrl}` : "Screenshot markup";
  return `${heading}

Image: ${BROWSER_AGENT_IMAGE_NAMES.markup} (${args.width}x${args.height})`;
}
function buildMarkupAgentPayload(args) {
  const pageUrl = sanitizeAgentPageUrl(args.pageUrl);
  return {
    kind: "markup",
    pageUrl,
    pageTitle: args.pageTitle,
    text: formatMarkupAsText({ pageUrl, width: args.result.width, height: args.result.height }),
    images: compactImages([
      pngDataUrlToAgentImage(BROWSER_AGENT_IMAGE_NAMES.markup, args.result.dataUrl)
    ])
  };
}
function isSendToAgentCanceled(error) {
  const isErrorLike = error instanceof Error || typeof DOMException !== "undefined" && error instanceof DOMException;
  return isErrorLike && error.name === "AbortError";
}
function useSendToAgent() {
  const host = useBrowserRendererHost();
  if (!host.onSendToAgent) {
    return null;
  }
  return async (payload) => {
    await host.onSendToAgent(payload);
  };
}

// src/renderer/components/browser-pane/annotate/use-browser-page-annotation-send.ts
function useBrowserPageAnnotationSend({
  browserTabId
}) {
  const browserAnnotations = useBrowserAnnotationStore(
    (s) => s.browserAnnotationsByPageId[browserTabId] ?? EMPTY_BROWSER_ANNOTATIONS
  );
  const browserAnnotationsRef = useRef12(browserAnnotations);
  const [browserAnnotationTrayOpen, setBrowserAnnotationTrayOpen] = useState13(true);
  const [browserAnnotationsCopied, setBrowserAnnotationsCopied] = useState13(false);
  const [browserAnnotationsSending, setBrowserAnnotationsSending] = useState13(false);
  const sendInFlightRef = useRef12(false);
  const annotationCopyTimerRef = useRef12(void 0);
  const copyPrompt = useMemo6(
    () => formatBrowserAnnotationsAsMarkdown(browserAnnotations),
    [browserAnnotations]
  );
  const sendToAgent = useSendToAgent();
  const sendToAgentRef = useRef12(sendToAgent);
  const deleteBrowserPageAnnotation = useBrowserAnnotationStore(
    (s) => s.deleteBrowserPageAnnotation
  );
  const updateBrowserPageAnnotation = useBrowserAnnotationStore(
    (s) => s.updateBrowserPageAnnotation
  );
  const clearBrowserPageAnnotations = useBrowserAnnotationStore(
    (s) => s.clearBrowserPageAnnotations
  );
  const removeDeliveredBrowserPageAnnotations = useBrowserAnnotationStore(
    (s) => s.removeDeliveredBrowserPageAnnotations
  );
  useLayoutEffect5(() => {
    browserAnnotationsRef.current = browserAnnotations;
    sendToAgentRef.current = sendToAgent;
  }, [browserAnnotations, sendToAgent]);
  useEffect17(() => {
    return () => {
      clearTimeout(annotationCopyTimerRef.current);
    };
  }, []);
  const handleCopyBrowserAnnotations = useCallback12(() => {
    if (!copyPrompt) {
      return;
    }
    void window.browserAPI.writeClipboardText(copyPrompt);
    clearTimeout(annotationCopyTimerRef.current);
    setBrowserAnnotationsCopied(true);
    annotationCopyTimerRef.current = setTimeout(() => setBrowserAnnotationsCopied(false), 1400);
  }, [copyPrompt]);
  const handleSendBrowserAnnotationsToAgent = useCallback12(async () => {
    const send = sendToAgentRef.current;
    const delivered = browserAnnotationsRef.current;
    const payload = buildAnnotationAgentPayload(delivered);
    if (!send || !payload || sendInFlightRef.current) {
      return;
    }
    sendInFlightRef.current = true;
    setBrowserAnnotationsSending(true);
    try {
      await send(payload);
      removeDeliveredBrowserPageAnnotations(browserTabId, delivered);
    } catch (error) {
      if (!isSendToAgentCanceled(error)) {
        toast6.error(
          translate("auto.components.browser.pane.sendToAgent.failed", "Could not send to agent")
        );
      }
    } finally {
      sendInFlightRef.current = false;
      setBrowserAnnotationsSending(false);
    }
  }, [browserTabId, removeDeliveredBrowserPageAnnotations]);
  const handleClearBrowserAnnotations = useCallback12(() => {
    if (browserAnnotationsRef.current.length === 0) {
      return;
    }
    clearTimeout(annotationCopyTimerRef.current);
    setBrowserAnnotationsCopied(false);
    clearBrowserPageAnnotations(browserTabId);
  }, [browserTabId, clearBrowserPageAnnotations]);
  const handleDeleteBrowserAnnotation = useCallback12(
    (annotationId) => {
      if (browserAnnotationsRef.current.length === 1) {
        clearTimeout(annotationCopyTimerRef.current);
        setBrowserAnnotationsCopied(false);
        setBrowserAnnotationTrayOpen(true);
      }
      deleteBrowserPageAnnotation(browserTabId, annotationId);
    },
    [browserTabId, deleteBrowserPageAnnotation, setBrowserAnnotationTrayOpen]
  );
  const handleUpdateBrowserAnnotation = useCallback12(
    (annotationId, comment, intent) => {
      updateBrowserPageAnnotation(browserTabId, annotationId, { comment, intent });
    },
    [browserTabId, updateBrowserPageAnnotation]
  );
  return {
    browserAnnotations,
    browserAnnotationTrayOpen,
    setBrowserAnnotationTrayOpen,
    browserAnnotationsCopied,
    browserAnnotationsSending,
    handleSendBrowserAnnotationsToAgent: sendToAgent ? handleSendBrowserAnnotationsToAgent : null,
    handleCopyBrowserAnnotations,
    handleClearBrowserAnnotations,
    handleDeleteBrowserAnnotation,
    handleUpdateBrowserAnnotation
  };
}

// src/renderer/components/browser-pane/annotate/use-browser-page-grab-annotations.ts
import {
  useCallback as useCallback13,
  useEffect as useEffect19,
  useLayoutEffect as useLayoutEffect6,
  useRef as useRef13,
  useState as useState14
} from "react";
import { toast as toast7 } from "sonner";

// src/renderer/components/browser-pane/annotate/use-browser-page-annotation-viewport-tracking.ts
import { useEffect as useEffect18 } from "react";
function useBrowserPageAnnotationViewportTracking({
  isActive,
  pendingAnnotation,
  annotationCount,
  container,
  scroller,
  setBrowserOverlayViewport
}) {
  useEffect18(() => {
    if (!isActive || !pendingAnnotation && annotationCount === 0) {
      return;
    }
    let frame = null;
    const bump = () => {
      if (frame !== null) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setBrowserOverlayViewport((current) => ({ ...current, version: current.version + 1 }));
      });
    };
    const observer = typeof ResizeObserver === "undefined" || !container ? null : new ResizeObserver(bump);
    if (observer && container) {
      observer.observe(container);
    }
    const unsubscribe = subscribeBrowserPageViewportScroll(scroller, bump);
    return () => {
      observer?.disconnect();
      unsubscribe();
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [annotationCount, container, isActive, pendingAnnotation, scroller, setBrowserOverlayViewport]);
}

// src/renderer/lib/browser-clipboard.ts
var PNG_DATA_URL_PREFIX2 = "data:image/png;base64,";
async function writeClipboardImage(pngDataUrl) {
  if (!pngDataUrl.startsWith(PNG_DATA_URL_PREFIX2)) {
    return;
  }
  const blob = await (await fetch(pngDataUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

// src/renderer/components/browser-pane/annotate/browser-page-grab-action.ts
async function copyGrabScreenshotToClipboard(dataUrl) {
  try {
    await writeClipboardImage(dataUrl);
  } catch {
  }
}
function runBrowserGrabActionShortcut({
  key,
  grabIntent,
  grab,
  grabPayloadRef,
  toolTargetIdRef,
  showGrabToast
}) {
  if (grabIntent === "annotate") {
    return;
  }
  const copyFromPayload = (payload) => {
    if (key === "c") {
      const text = formatGrabPayloadAsText(payload);
      void window.browserAPI.writeClipboardText(text);
      showGrabToast("Copied", "success", payload);
    } else {
      const dataUrl = payload.screenshot?.dataUrl;
      if (dataUrl?.startsWith("data:image/png;base64,")) {
        void copyGrabScreenshotToClipboard(dataUrl);
        showGrabToast("Screenshotted", "success", payload);
      } else {
        showGrabToast("No screenshot available", "error", payload);
      }
    }
  };
  if (grab.state === "confirming") {
    if (grab.contextMenu && key === "c") {
      const currentPayload = grabPayloadRef.current;
      if (currentPayload) {
        copyFromPayload(currentPayload);
      }
      grab.rearm();
    } else if (key === "s") {
      const currentPayload = grabPayloadRef.current;
      if (currentPayload) {
        copyFromPayload(currentPayload);
      }
      grab.rearm();
    }
  } else {
    void (async () => {
      let result;
      try {
        result = await window.browserAPI.extractHoverPayload({
          browserPageId: toolTargetIdRef.current
        });
      } catch {
        showGrabToast("Could not read the hovered element", "error");
        return;
      }
      if (!result.ok) {
        showGrabToast("No element hovered", "error");
        return;
      }
      const payload = result.payload;
      if (key === "s") {
        try {
          const ssResult = await window.browserAPI.captureSelectionScreenshot({
            browserPageId: toolTargetIdRef.current,
            rect: payload.target.rectViewport
          });
          if (ssResult.ok) {
            payload.screenshot = ssResult.screenshot;
          }
        } catch {
        }
      }
      copyFromPayload(payload);
    })();
  }
}

// src/renderer/components/browser-pane/annotate/use-browser-page-grab-annotations.ts
var copiedGrabToastMessage = () => translate(
  "auto.components.browser.pane.annotate.use.browser.page.grab.annotations.0c7b9b2b7a",
  "Copied"
);
var screenshottedGrabToastMessage = () => translate(
  "auto.components.browser.pane.annotate.use.browser.page.grab.annotations.c937229f19",
  "Screenshotted"
);
var annotationAddedGrabToastMessage = () => translate(
  "auto.components.browser.pane.annotate.use.browser.page.grab.annotations.1f5cb19034",
  "Annotation added"
);
function useBrowserPageGrabAnnotations({
  browserTabId,
  toolTargetId = browserTabId,
  isActive,
  grab,
  containerRef,
  trackingContainer,
  trackingScroller,
  webviewRef,
  setBrowserOverlayViewport,
  browserAnnotationsLength,
  setBrowserAnnotationTrayOpen,
  currentUrl
}) {
  const mountedRef = useMountedRef();
  const toolTargetIdRef = useRef13(toolTargetId);
  const grabToastTimerRef = useRef13(void 0);
  const [grabIntent, setGrabIntent] = useState14("copy");
  const grabIntentRef = useRef13(grabIntent);
  const [pendingAnnotationPayload, setPendingAnnotationPayload] = useState14(null);
  const pendingAnnotationPayloadRef = useRef13(null);
  const [grabToast, setGrabToast] = useState14(null);
  const grabRef = useRef13(grab);
  const grabPayloadRef = useRef13(grab.payload);
  const sendToAgent = useSendToAgent();
  const sendToAgentRef = useRef13(sendToAgent);
  const grabSendInFlightRef = useRef13(false);
  const grabReviewPayloadRef = useRef13(null);
  const currentUrlRef = useRef13(currentUrl);
  const [grabReviewPayload, setGrabReviewPayload] = useState14(null);
  const [grabReviewSending, setGrabReviewSending] = useState14(false);
  const grabReviewOpenRef = useRef13(false);
  useLayoutEffect6(() => {
    toolTargetIdRef.current = toolTargetId;
    grabIntentRef.current = grabIntent;
    pendingAnnotationPayloadRef.current = pendingAnnotationPayload;
    grabRef.current = grab;
    grabPayloadRef.current = grab.payload;
    sendToAgentRef.current = sendToAgent;
    currentUrlRef.current = currentUrl;
    grabReviewPayloadRef.current = grabReviewPayload;
  }, [
    grab,
    grabIntent,
    pendingAnnotationPayload,
    sendToAgent,
    toolTargetId,
    currentUrl,
    grabReviewPayload
  ]);
  const grabMenuActionTakenRef = useRef13(false);
  const addBrowserPageAnnotation = useBrowserAnnotationStore((s) => s.addBrowserPageAnnotation);
  useEffect19(() => () => clearTimeout(grabToastTimerRef.current), []);
  const dismissGrabToast = useCallback13(() => {
    clearTimeout(grabToastTimerRef.current);
    setGrabToast(null);
    if (grabRef.current.state === "confirming" && !(grabIntentRef.current === "annotate" && pendingAnnotationPayloadRef.current)) {
      grabRef.current.rearm();
    }
  }, []);
  const showGrabToast = useCallback13(
    (message, type, payload) => {
      if (!mountedRef.current) {
        return;
      }
      let x = 0;
      let y = 0;
      let below = true;
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (payload) {
        const rect = payload.target.rectViewport;
        const webview = webviewRef.current;
        const webviewRect = webview?.getBoundingClientRect();
        const offsetX = (webviewRect?.left ?? 0) - (containerRect?.left ?? 0);
        const offsetY = (webviewRect?.top ?? 0) - (containerRect?.top ?? 0);
        x = offsetX + rect.x + rect.width / 2;
        const elementBottom = offsetY + rect.y + rect.height;
        const elementTop = offsetY + rect.y;
        const containerHeight = containerRect?.height ?? 0;
        below = elementBottom + 52 < containerHeight;
        y = below ? elementBottom : elementTop;
      } else if (containerRect) {
        x = containerRect.width / 2;
        y = containerRect.height / 2;
      }
      clearTimeout(grabToastTimerRef.current);
      setGrabToast({ message, type, x, y, below, payload: payload ?? null });
      grabToastTimerRef.current = setTimeout(() => dismissGrabToast(), 2e3);
    },
    [containerRef, dismissGrabToast, mountedRef, webviewRef]
  );
  useEffect19(() => {
    if (grab.state !== "confirming" || !grab.payload) {
      return;
    }
    if (grabIntent === "annotate") {
      setPendingAnnotationPayload(
        () => grabPayloadRef.current === grab.payload ? grab.payload : null
      );
      setBrowserOverlayViewport(
        (current) => current.target ? { ...current, target: void 0 } : current
      );
      return;
    }
    if (!grab.contextMenu) {
      const text = formatGrabPayloadAsText(grab.payload);
      void window.browserAPI.writeClipboardText(text);
      showGrabToast(copiedGrabToastMessage(), "success", grab.payload);
    }
  }, [
    grab.state,
    grab.payload,
    grab.contextMenu,
    grabIntent,
    setBrowserOverlayViewport,
    showGrabToast
  ]);
  useBrowserPageAnnotationViewportTracking({
    isActive,
    pendingAnnotation: pendingAnnotationPayload,
    annotationCount: browserAnnotationsLength,
    container: trackingContainer ?? containerRef.current,
    scroller: trackingScroller ?? containerRef.current?.querySelector("[data-browser-page-scroller]") ?? null,
    setBrowserOverlayViewport
  });
  const startGrabIntent = useCallback13(
    (nextIntent) => {
      setGrabIntent(nextIntent);
      if (nextIntent === "copy") {
        setPendingAnnotationPayload(null);
      } else {
        setBrowserAnnotationTrayOpen(true);
      }
      if (grab.state === "idle" || grab.state === "error" || grabIntent === nextIntent) {
        grab.toggle();
      }
    },
    [grab, grabIntent, setBrowserAnnotationTrayOpen]
  );
  const handleGrabActionShortcut = useCallback13(
    (key) => {
      runBrowserGrabActionShortcut({
        key,
        grabIntent,
        grab,
        grabPayloadRef,
        toolTargetIdRef,
        showGrabToast
      });
    },
    [grab, grabIntent, showGrabToast]
  );
  const handleGrabCopy = useCallback13(() => {
    grabMenuActionTakenRef.current = true;
    const payload = grabPayloadRef.current;
    if (!payload) {
      return;
    }
    const text = formatGrabPayloadAsText(payload);
    void window.browserAPI.writeClipboardText(text);
    showGrabToast(copiedGrabToastMessage(), "success", payload);
    grab.rearm();
  }, [grab, showGrabToast]);
  const handleGrabCopyScreenshot = useCallback13(() => {
    grabMenuActionTakenRef.current = true;
    const payload = grabPayloadRef.current;
    if (!payload) {
      return;
    }
    const dataUrl = payload.screenshot?.dataUrl;
    if (!dataUrl?.startsWith("data:image/png;base64,")) {
      return;
    }
    void copyGrabScreenshotToClipboard(dataUrl);
    showGrabToast(screenshottedGrabToastMessage(), "success", payload);
    grab.rearm();
  }, [grab, showGrabToast]);
  const handleGrabSendToAgent = useCallback13(
    async (payload, options) => {
      const send = sendToAgentRef.current;
      if (!send || grabSendInFlightRef.current) {
        return false;
      }
      grabSendInFlightRef.current = true;
      try {
        let screenshot = payload.screenshot;
        const liveUrl = currentUrlRef.current;
        const pageStillMatches = liveUrl === void 0 || sanitizeAgentPageUrl(liveUrl) === sanitizeAgentPageUrl(payload.page.sanitizedUrl);
        if (!pageStillMatches) {
          screenshot = null;
        } else {
          try {
            const result = await window.browserAPI.captureSelectionScreenshot({
              browserPageId: toolTargetIdRef.current,
              rect: payload.target.rectViewport
            });
            if (result.ok) {
              screenshot = result.screenshot;
            }
          } catch {
          }
        }
        await send(buildGrabAgentPayload({ ...payload, screenshot }));
        if (options?.isReviewOpen?.() ?? true) {
          grabRef.current.exit();
        }
        return true;
      } catch (error) {
        if (!isSendToAgentCanceled(error)) {
          toast7.error(
            translate("auto.components.browser.pane.sendToAgent.failed", "Could not send to agent")
          );
        }
        return false;
      } finally {
        grabSendInFlightRef.current = false;
      }
    },
    []
  );
  useEffect19(() => {
    if (grab.state === "error" && grab.error) {
      toast7.error(grab.error);
    }
  }, [grab.state, grab.error]);
  const updateGrabReview = useCallback13((next) => {
    grabReviewOpenRef.current = next !== null;
    setGrabReviewPayload(next);
  }, []);
  const openGrabReview = useCallback13(
    (payload) => updateGrabReview(payload),
    [updateGrabReview]
  );
  const closeGrabReview = useCallback13(() => {
    updateGrabReview(null);
    if (grabRef.current.state === "confirming") {
      grabRef.current.rearm();
    }
  }, [updateGrabReview]);
  const handleSendGrabReview = useCallback13(async () => {
    const payload = grabReviewPayloadRef.current;
    if (!payload || grabSendInFlightRef.current) {
      return;
    }
    setGrabReviewSending(true);
    try {
      const sent = await handleGrabSendToAgent(payload, {
        isReviewOpen: () => grabReviewOpenRef.current
      });
      if (sent) {
        updateGrabReview(null);
      }
    } finally {
      setGrabReviewSending(false);
    }
  }, [handleGrabSendToAgent, updateGrabReview]);
  useEffect19(() => {
    if (grab.state === "idle") {
      updateGrabReview(null);
    }
  }, [grab.state, updateGrabReview]);
  const handleAddBrowserAnnotation = useCallback13(
    (comment, intent) => {
      const payload = pendingAnnotationPayloadRef.current;
      if (!payload) {
        return;
      }
      addBrowserPageAnnotation({
        id: createBrowserAnnotationId(),
        browserPageId: browserTabId,
        comment,
        intent,
        priority: DEFAULT_BROWSER_ANNOTATION_PRIORITY,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        payload: createBrowserAnnotationPayload(payload)
      });
      pendingAnnotationPayloadRef.current = null;
      setPendingAnnotationPayload(null);
      setBrowserAnnotationTrayOpen(true);
      showGrabToast(annotationAddedGrabToastMessage(), "success", payload);
      grab.rearm();
    },
    [addBrowserPageAnnotation, browserTabId, grab, setBrowserAnnotationTrayOpen, showGrabToast]
  );
  const handleCancelPendingBrowserAnnotation = useCallback13(() => {
    pendingAnnotationPayloadRef.current = null;
    setPendingAnnotationPayload(null);
    if (grabIntent === "annotate" && grab.state === "confirming") {
      grab.rearm();
    }
  }, [grab, grabIntent]);
  const cancelPendingBrowserCapture = useCallback13(() => {
    grabRef.current.cancel();
    pendingAnnotationPayloadRef.current = null;
    grabPayloadRef.current = null;
    setPendingAnnotationPayload(null);
    updateGrabReview(null);
    clearTimeout(grabToastTimerRef.current);
    setGrabToast(null);
  }, [updateGrabReview]);
  return {
    grabIntent,
    startGrabIntent,
    pendingAnnotationPayload,
    setPendingAnnotationPayload,
    grabToast,
    setGrabToast,
    grabToastTimerRef,
    dismissGrabToast,
    handleGrabCopy,
    handleGrabCopyScreenshot,
    grabReviewPayload,
    grabReviewSending,
    openGrabReview,
    closeGrabReview,
    handleSendGrabReview,
    handleGrabSendToAgent: sendToAgent ? handleGrabSendToAgent : null,
    grabMenuActionTakenRef,
    handleAddBrowserAnnotation,
    handleCancelPendingBrowserAnnotation,
    cancelPendingBrowserCapture,
    handleGrabActionShortcut
  };
}

// src/renderer/components/browser-pane/annotate/useGrabMode.ts
import { useCallback as useCallback14, useEffect as useEffect20, useLayoutEffect as useLayoutEffect7, useRef as useRef14, useState as useState15 } from "react";
var opIdCounter = 0;
function nextOpId() {
  return `grab-${++opIdCounter}-${Date.now()}`;
}
function getGrabEnableError(reason) {
  switch (reason) {
    case "not-ready":
      return translate(
        "auto.components.browser-pane.grab.errorNotReady",
        "This page isn't ready for element selection yet."
      );
    case "not-authorized":
      return translate(
        "auto.components.browser-pane.grab.errorNotAuthorized",
        "Browser access was denied."
      );
    case "already-active":
      return translate(
        "auto.components.browser-pane.grab.errorAlreadyActive",
        "Element selection is already active."
      );
    case "injection-failed":
      return translate(
        "auto.components.browser-pane.grab.errorInjectionFailed",
        "Could not start element selection on this page."
      );
  }
}
function useGrabMode(browserPageId) {
  const [state, setState] = useState15("idle");
  const [payload, setPayload] = useState15(null);
  const [error, setError] = useState15(null);
  const [contextMenu, setContextMenu] = useState15(false);
  const activeOpIdRef = useRef14(null);
  const grabTabIdRef = useRef14(null);
  const armGenerationRef = useRef14(0);
  const browserTabIdRef = useRef14(browserPageId);
  const mountedRef = useMountedRef();
  useLayoutEffect7(() => {
    browserTabIdRef.current = browserPageId;
  }, [browserPageId]);
  useEffect20(() => {
    return () => {
      const grabTabId = grabTabIdRef.current;
      if (grabTabId) {
        armGenerationRef.current += 1;
        void window.browserAPI.setGrabMode({ browserPageId: grabTabId, enabled: false });
        void window.browserAPI.cancelGrab({ browserPageId: grabTabId });
        grabTabIdRef.current = null;
        activeOpIdRef.current = null;
      }
    };
  }, [browserPageId]);
  const armAndAwait = useCallback14(async () => {
    const tabId = browserPageId;
    const armGeneration = armGenerationRef.current += 1;
    grabTabIdRef.current = tabId;
    setState("armed");
    const setResult = await window.browserAPI.setGrabMode({
      browserPageId: tabId,
      enabled: true
    });
    if (!mountedRef.current || armGenerationRef.current !== armGeneration || browserTabIdRef.current !== tabId || grabTabIdRef.current !== tabId) {
      const supersededBySameTab = armGenerationRef.current !== armGeneration && grabTabIdRef.current === tabId;
      if (!supersededBySameTab) {
        void window.browserAPI.setGrabMode({ browserPageId: tabId, enabled: false });
        void window.browserAPI.cancelGrab({ browserPageId: tabId });
        if (grabTabIdRef.current === tabId) {
          grabTabIdRef.current = null;
        }
      }
      return;
    }
    if (!setResult.ok) {
      grabTabIdRef.current = null;
      setState("error");
      setError(getGrabEnableError(setResult.reason));
      return;
    }
    const opId = nextOpId();
    activeOpIdRef.current = opId;
    setState("awaiting");
    const result = await window.browserAPI.awaitGrabSelection({
      browserPageId: tabId,
      opId
    });
    if (!mountedRef.current || activeOpIdRef.current !== opId || grabTabIdRef.current !== tabId) {
      return;
    }
    activeOpIdRef.current = null;
    if (result.kind === "selected" || result.kind === "context-selected") {
      let screenshot = null;
      try {
        const ssResult = await window.browserAPI.captureSelectionScreenshot({
          browserPageId: tabId,
          rect: result.payload.target.rectViewport
        });
        if (ssResult.ok) {
          screenshot = ssResult.screenshot;
        }
      } catch {
      }
      if (!mountedRef.current || armGenerationRef.current !== armGeneration || grabTabIdRef.current !== tabId) {
        return;
      }
      setContextMenu(result.kind === "context-selected");
      setPayload({ ...result.payload, screenshot });
      setState("confirming");
    } else if (result.kind === "cancelled") {
      grabTabIdRef.current = null;
      setState("idle");
      setPayload(null);
    } else {
      grabTabIdRef.current = null;
      setState("error");
      setError(result.reason);
    }
  }, [browserPageId, mountedRef]);
  const cancel = useCallback14(() => {
    const targetTabId = grabTabIdRef.current ?? browserPageId;
    armGenerationRef.current += 1;
    void window.browserAPI.setGrabMode({
      browserPageId: targetTabId,
      enabled: false
    });
    if (activeOpIdRef.current) {
      void window.browserAPI.cancelGrab({
        browserPageId: targetTabId
      });
      activeOpIdRef.current = null;
    }
    grabTabIdRef.current = null;
    setState("idle");
    setPayload(null);
    setError(null);
    setContextMenu(false);
  }, [browserPageId]);
  const toggle = useCallback14(() => {
    if ((state === "idle" || state === "error") && grabTabIdRef.current === null) {
      setError(null);
      setPayload(null);
      setContextMenu(false);
      void armAndAwait();
    } else {
      cancel();
    }
  }, [state, armAndAwait, cancel]);
  const rearm = useCallback14(() => {
    setState("armed");
    setPayload(null);
    setError(null);
    setContextMenu(false);
    void armAndAwait();
  }, [armAndAwait]);
  const exit = useCallback14(() => {
    const targetTabId = grabTabIdRef.current ?? browserTabIdRef.current;
    armGenerationRef.current += 1;
    void window.browserAPI.setGrabMode({
      browserPageId: targetTabId,
      enabled: false
    });
    activeOpIdRef.current = null;
    grabTabIdRef.current = null;
    setState("idle");
    setPayload(null);
    setError(null);
    setContextMenu(false);
  }, []);
  useEffect20(() => {
    if (state === "idle") {
      return;
    }
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        const element = e.target && typeof e.target === "object" && "closest" in e.target ? e.target : null;
        if (isEditableKeyboardTarget(e.target) || element?.closest(
          '[data-slot="select-trigger"], [data-slot="select-content"], [data-slot="annotation-edit"]'
        )) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [state, cancel]);
  return { state, payload, error, contextMenu, toggle, cancel, rearm, exit };
}

// src/renderer/components/browser-pane/annotate/use-browser-page-markup-capture.ts
import { useCallback as useCallback16, useLayoutEffect as useLayoutEffect8, useRef as useRef16 } from "react";
import { toast as toast10 } from "sonner";

// src/renderer/components/browser-pane/annotate/markup-clipboard-delivery.ts
import { toast as toast8 } from "sonner";
async function deliverMarkupToClipboard(result) {
  await writeClipboardImage(result.dataUrl);
  const isMac = navigator.userAgent.includes("Mac");
  toast8.success(
    translate(
      "auto.components.browser-pane.markup.copiedToast",
      "Markup copied \u2014 paste it into your agent ({{value0}})",
      { value0: isMac ? "\u2318V" : "Ctrl+V" }
    )
  );
}

// src/renderer/components/browser-pane/annotate/useMarkupMode.ts
import { useCallback as useCallback15, useRef as useRef15, useState as useState16 } from "react";
import { toast as toast9 } from "sonner";

// src/shared/clipboard-image.ts
var CLIPBOARD_IMAGE_MAX_BASE64_CHARS = 24 * 1024 * 1024;
var CLIPBOARD_IMAGE_MAX_SOURCE_BYTES = Math.floor(
  CLIPBOARD_IMAGE_MAX_BASE64_CHARS / 4 * 3
);
var CLIPBOARD_IMAGE_MAX_PIXELS = 32 * 1024 * 1024;

// src/renderer/components/browser-pane/annotate/markup-base-image.ts
async function captureMarkupBaseImage(source) {
  if (source.kind === "webview") {
    return captureFromWebview(source.webview);
  }
  return captureFromImage(source.element);
}
async function captureFromWebview(webview) {
  const native = await webview.capturePage();
  if (native.isEmpty()) {
    throw new Error("markup: webview capturePage returned an empty image");
  }
  const size = native.getSize();
  const image = await loadImage(native.toDataURL());
  return { dataUrl: flattenToOpaquePng(image, size.width, size.height), ...size };
}
function captureFromImage(element) {
  const width = element.naturalWidth || element.width;
  const height = element.naturalHeight || element.height;
  if (!element.complete || !element.isConnected || width <= 0 || height <= 0) {
    throw new Error("markup: remote frame image is not ready");
  }
  return { dataUrl: flattenToOpaquePng(element, width, height), width, height };
}
function flattenToOpaquePng(image, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("markup: 2d context unavailable for base image");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("markup: failed to decode captured screenshot"));
    image.src = src;
  });
}

// src/renderer/components/browser-pane/annotate/markup-drawing-model.ts
var MARKUP_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#111827",
  "#ffffff"
];
var DEFAULT_MARKUP_COLOR = MARKUP_COLORS[0];
var MARKUP_WIDTHS = [2, 4, 8];
var DEFAULT_MARKUP_WIDTH = 4;
var MARKUP_FONT_SIZES = [14, 18, 24, 32, 48];
var DEFAULT_MARKUP_FONT_SIZE = 18;
var HIGHLIGHT_WIDTH_MULTIPLIER = 4;
var HIGHLIGHT_ALPHA = 0.35;
function createMarkupDocument() {
  return { shapes: [], past: [], future: [] };
}
function setShapes(doc, shapes) {
  return { shapes, past: [...doc.past, doc.shapes], future: [] };
}
function commitShape(doc, shape) {
  return setShapes(doc, [...doc.shapes, shape]);
}
function undoShape(doc) {
  const prev = doc.past.at(-1);
  if (!prev) {
    return doc;
  }
  return { shapes: prev, past: doc.past.slice(0, -1), future: [doc.shapes, ...doc.future] };
}
function redoShape(doc) {
  const next = doc.future.at(0);
  if (!next) {
    return doc;
  }
  return { shapes: next, past: [...doc.past, doc.shapes], future: doc.future.slice(1) };
}
function clearShapes(doc) {
  return doc.shapes.length === 0 ? doc : setShapes(doc, []);
}
function canUndo(doc) {
  return doc.past.length > 0;
}
function canRedo(doc) {
  return doc.future.length > 0;
}
function normalizeRect(from, to) {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y)
  };
}
function scalePoint(point, scale) {
  return { x: point.x * scale, y: point.y * scale };
}
function scaleShape(shape, scale) {
  switch (shape.kind) {
    case "pen":
    case "highlight":
      return {
        ...shape,
        width: shape.width * scale,
        points: shape.points.map((point) => scalePoint(point, scale))
      };
    case "arrow":
    case "rect":
    case "ellipse":
      return {
        ...shape,
        width: shape.width * scale,
        from: scalePoint(shape.from, scale),
        to: scalePoint(shape.to, scale)
      };
    case "text":
      return {
        ...shape,
        fontSize: shape.fontSize * scale,
        at: scalePoint(shape.at, scale)
      };
  }
}
var ARROW_HEAD_ANGLE = 0.45;
function arrowHeadLength(width) {
  return Math.max(10, width * 3.5);
}
function arrowHeadGeometry(from, to, width) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) {
    return null;
  }
  const angle = Math.atan2(dy, dx);
  const size = arrowHeadLength(width);
  const leftAngle = angle + Math.PI - ARROW_HEAD_ANGLE;
  const rightAngle = angle + Math.PI + ARROW_HEAD_ANGLE;
  return {
    tip: to,
    left: { x: to.x + size * Math.cos(leftAngle), y: to.y + size * Math.sin(leftAngle) },
    right: { x: to.x + size * Math.cos(rightAngle), y: to.y + size * Math.sin(rightAngle) }
  };
}
function highlightWidth(width) {
  return width * HIGHLIGHT_WIDTH_MULTIPLIER;
}
function strokeDotRadius(width) {
  return Math.max(width / 2, 1);
}
function textHaloWidth(fontSize) {
  return Math.max(fontSize / 6, 2);
}

// src/renderer/components/browser-pane/annotate/markup-shape-render.ts
var TEXT_FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
function drawShape(ctx, shape) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  switch (shape.kind) {
    case "pen":
      drawStroke(ctx, shape);
      break;
    case "highlight":
      drawHighlight(ctx, shape);
      break;
    case "arrow":
      drawArrow(ctx, shape);
      break;
    case "rect":
      drawRect(ctx, shape);
      break;
    case "ellipse":
      drawEllipse(ctx, shape);
      break;
    case "text":
      drawText(ctx, shape);
      break;
  }
  ctx.restore();
}
function drawShapes(ctx, shapes) {
  for (const shape of shapes) {
    drawShape(ctx, shape);
  }
}
function drawStroke(ctx, shape) {
  ctx.lineWidth = shape.width;
  strokePolyline(ctx, shape.points, shape.width);
}
function drawHighlight(ctx, shape) {
  ctx.globalAlpha = HIGHLIGHT_ALPHA;
  const width = highlightWidth(shape.width);
  ctx.lineWidth = width;
  strokePolyline(ctx, shape.points, width);
}
function strokePolyline(ctx, points, width) {
  if (points.length === 0) {
    return;
  }
  if (points.length === 1) {
    const point = points[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, strokeDotRadius(width), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}
function drawArrow(ctx, shape) {
  ctx.lineWidth = shape.width;
  ctx.beginPath();
  ctx.moveTo(shape.from.x, shape.from.y);
  ctx.lineTo(shape.to.x, shape.to.y);
  ctx.stroke();
  const head = arrowHeadGeometry(shape.from, shape.to, shape.width);
  if (!head) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(head.left.x, head.left.y);
  ctx.lineTo(head.tip.x, head.tip.y);
  ctx.lineTo(head.right.x, head.right.y);
  ctx.stroke();
}
function drawRect(ctx, shape) {
  ctx.lineWidth = shape.width;
  const rect = normalizeRect(shape.from, shape.to);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
}
function drawEllipse(ctx, shape) {
  ctx.lineWidth = shape.width;
  const rect = normalizeRect(shape.from, shape.to);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}
function applyTextStyle(ctx, shape) {
  ctx.font = `600 ${shape.fontSize}px ${TEXT_FONT_FAMILY}`;
  ctx.textBaseline = "top";
  ctx.lineWidth = textHaloWidth(shape.fontSize);
  ctx.lineJoin = "round";
}
function drawText(ctx, shape) {
  applyTextStyle(ctx, shape);
  ctx.strokeStyle = haloColor(shape.color);
  ctx.strokeText(shape.text, shape.at.x, shape.at.y);
  ctx.fillText(shape.text, shape.at.x, shape.at.y);
}
function textInkBox(ctx, shape) {
  ctx.save();
  applyTextStyle(ctx, shape);
  const metrics = ctx.measureText(shape.text);
  ctx.restore();
  const halo = textHaloWidth(shape.fontSize);
  return {
    x: shape.at.x - metrics.actualBoundingBoxLeft - halo / 2,
    y: shape.at.y - metrics.actualBoundingBoxAscent - halo / 2,
    width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight + halo,
    height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + halo
  };
}
function haloColor(color) {
  return color.toLowerCase() === "#ffffff" ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.85)";
}

// src/renderer/components/browser-pane/annotate/markup-screenshot-compose.ts
function clampMarkupScale(scale) {
  if (!Number.isFinite(scale) || scale <= 0) {
    return 1;
  }
  return Math.min(Math.max(scale, 1), 4);
}
function effectiveMarkupScale(displayCssWidth, displayCssHeight, outputScale, maxPixels = Number.POSITIVE_INFINITY) {
  const scale = clampMarkupScale(outputScale);
  const area = displayCssWidth * displayCssHeight;
  if (area <= 0 || !Number.isFinite(maxPixels) || maxPixels <= 0) {
    return scale;
  }
  return Math.min(scale, Math.sqrt(maxPixels / area));
}
function markupCanvasSize(displayCssWidth, displayCssHeight, outputScale, maxPixels = Number.POSITIVE_INFINITY) {
  const scale = effectiveMarkupScale(displayCssWidth, displayCssHeight, outputScale, maxPixels);
  return {
    width: Math.max(1, Math.floor(displayCssWidth * scale)),
    height: Math.max(1, Math.floor(displayCssHeight * scale))
  };
}
function dataUrlByteLength(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    return 0;
  }
  const payload = dataUrl.slice(commaIndex + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
}
var MARKUP_DOWNSCALE_STEPS = [1, 0.85, 0.7, 0.55, 0.4, 0.3];
function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}
function renderComposite(input) {
  const scale = effectiveMarkupScale(
    input.displayCssWidth,
    input.displayCssHeight,
    input.outputScale,
    input.maxPixels
  );
  const size = markupCanvasSize(
    input.displayCssWidth,
    input.displayCssHeight,
    input.outputScale,
    input.maxPixels
  );
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("markup compose: 2d context unavailable");
  }
  ctx.drawImage(input.image, 0, 0, size.width, size.height);
  for (const shape of input.shapes) {
    drawShapes(ctx, [scaleShape(shape, scale)]);
  }
  return canvas;
}
function downscaleCanvas(source, factor) {
  if (factor >= 1) {
    return source;
  }
  const next = createCanvas(source.width * factor, source.height * factor);
  const ctx = next.getContext("2d");
  if (!ctx) {
    return source;
  }
  ctx.drawImage(source, 0, 0, next.width, next.height);
  return next;
}
function canvasToPngDataUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        try {
          resolve(canvas.toDataURL("image/png"));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("markup compose: toDataURL failed"));
        }
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error ?? new Error("markup compose: blob read failed"));
      reader.readAsDataURL(blob);
    }, "image/png");
  });
}
async function composeMarkupDataUrl(input) {
  const composite = renderComposite(input);
  let smallest = null;
  for (const step of MARKUP_DOWNSCALE_STEPS) {
    const canvas = downscaleCanvas(composite, step);
    const dataUrl = await canvasToPngDataUrl(canvas);
    const byteLength = dataUrlByteLength(dataUrl);
    const result = {
      dataUrl,
      mimeType: "image/png",
      width: canvas.width,
      height: canvas.height,
      byteLength
    };
    if (byteLength <= input.maxBytes) {
      return result;
    }
    smallest = result;
  }
  if (!smallest) {
    throw new Error("markup compose: no downscale step produced output");
  }
  return smallest;
}

// src/renderer/components/browser-pane/annotate/useMarkupMode.ts
var MarkupDeliveryHandledError = class extends Error {
  constructor() {
    super("Markup delivery was not completed");
    this.name = "MarkupDeliveryHandledError";
  }
};
function useMarkupMode({
  getCaptureContext,
  onDeliver
}) {
  const [state, setState] = useState16("idle");
  const [baseImage, setBaseImage] = useState16(null);
  const contextRef = useRef15(null);
  const captureTokenRef = useRef15(0);
  const reset = useCallback15(() => {
    captureTokenRef.current += 1;
    contextRef.current = null;
    setBaseImage(null);
    setState("idle");
  }, []);
  const reportError = useCallback15((key, fallback) => {
    toast9.error(translate(key, fallback));
  }, []);
  const start = useCallback15(async () => {
    const context = getCaptureContext();
    if (!context) {
      reportError(
        "auto.components.browser-pane.markup.errorUnavailable",
        "Screenshot markup is not available on this page."
      );
      return;
    }
    const token = captureTokenRef.current += 1;
    contextRef.current = context;
    setState("capturing");
    try {
      const image = await captureMarkupBaseImage(context.source);
      if (captureTokenRef.current !== token) {
        return;
      }
      setBaseImage(image);
      setState("drawing");
    } catch {
      if (captureTokenRef.current !== token) {
        return;
      }
      reportError(
        "auto.components.browser-pane.markup.errorCapture",
        "Could not capture the page to draw on."
      );
      reset();
    }
  }, [getCaptureContext, reportError, reset]);
  const cancel = useCallback15(() => {
    reset();
  }, [reset]);
  const complete = useCallback15(
    async ({ imageElement, shapes }) => {
      const context = contextRef.current;
      if (!context) {
        reset();
        return;
      }
      const token = captureTokenRef.current;
      setState("composing");
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      if (captureTokenRef.current !== token) {
        return;
      }
      try {
        const result = await composeMarkupDataUrl({
          image: imageElement,
          displayCssWidth: context.cssWidth,
          displayCssHeight: context.cssHeight,
          outputScale: context.outputScale,
          shapes,
          // Why: target the clipboard handler's own ceilings — the byte limit
          // (≈18 MB, well above a normal viewport PNG) and the pixel limit, which
          // the handler otherwise enforces by silently dropping oversize images.
          maxBytes: CLIPBOARD_IMAGE_MAX_SOURCE_BYTES,
          maxPixels: CLIPBOARD_IMAGE_MAX_PIXELS
        });
        if (captureTokenRef.current !== token) {
          return;
        }
        await onDeliver(result, context);
        if (captureTokenRef.current !== token) {
          return;
        }
        reset();
      } catch (error) {
        if (captureTokenRef.current !== token) {
          return;
        }
        if (!(error instanceof MarkupDeliveryHandledError)) {
          reportError(
            "auto.components.browser-pane.markup.errorAttach",
            "Could not attach the markup screenshot."
          );
        }
        setState("drawing");
      }
    },
    [onDeliver, reset, reportError]
  );
  return {
    state,
    isActive: state !== "idle",
    baseImage,
    start,
    cancel,
    complete
  };
}

// src/renderer/components/browser-pane/annotate/use-browser-page-markup-capture.ts
function useBrowserPageMarkupCapture(webviewRef, page) {
  const sendToAgent = useSendToAgent();
  const sendRef = useRef16(sendToAgent);
  const pageRef = useRef16(page);
  useLayoutEffect8(() => {
    sendRef.current = sendToAgent;
    pageRef.current = page;
  });
  const onDeliver = useCallback16(
    async (result, context) => {
      const send = sendRef.current;
      const page2 = context?.page ?? pageRef.current;
      if (!send) {
        await deliverMarkupToClipboard(result);
        return;
      }
      try {
        await send(
          buildMarkupAgentPayload({
            pageUrl: page2.url,
            pageTitle: page2.title,
            result
          })
        );
      } catch (error) {
        if (!isSendToAgentCanceled(error)) {
          toast10.error(
            translate("auto.components.browser.pane.sendToAgent.failed", "Could not send to agent")
          );
        }
        throw new MarkupDeliveryHandledError();
      }
      toast10.success(
        translate("auto.components.browser.pane.sendToAgent.markupSent", "Markup sent to agent")
      );
    },
    []
  );
  return useMarkupMode({
    getCaptureContext: useCallback16(() => {
      const webview = webviewRef.current;
      if (!webview) {
        return null;
      }
      const rect = webview.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      return {
        source: { kind: "webview", webview },
        cssWidth: rect.width,
        cssHeight: rect.height,
        outputScale: window.devicePixelRatio || 1,
        page: pageRef.current
      };
    }, [webviewRef]),
    onDeliver
  });
}

// src/renderer/components/browser-pane/annotate/browser-annotate-chord.ts
function isAnnotateChord(event, platform) {
  if (event.repeat || event.nativeEvent.isComposing || isEditableKeyboardTarget(event.target)) {
    return false;
  }
  if (platform === "darwin") {
    return event.metaKey && event.shiftKey && !event.altKey && !event.ctrlKey && event.code === "KeyC";
  }
  return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === "KeyN";
}
function isGrabChord(event, platform) {
  if (event.repeat || event.nativeEvent.isComposing || isEditableKeyboardTarget(event.target)) {
    return false;
  }
  if (event.code !== "KeyC" || event.shiftKey || event.altKey) {
    return false;
  }
  if (window.getSelection()?.isCollapsed === false) {
    return false;
  }
  return platform === "darwin" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-context-menu.tsx
import {
  useCallback as useCallback17,
  useEffect as useEffect21,
  useLayoutEffect as useLayoutEffect9,
  useRef as useRef17,
  useState as useState17
} from "react";
import { createPortal } from "react-dom";
import { Fragment as Fragment7, jsx as jsx38, jsxs as jsxs30 } from "react/jsx-runtime";
var MENU_ITEM_CLASS = "relative flex w-full cursor-default items-center gap-2 rounded-[7px] px-2 py-0.5 text-[12px] leading-5 font-medium outline-none select-none hover:bg-black/8 focus:bg-black/8 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-white/14 dark:focus:bg-white/14";
function BrowserPageContextMenu({
  browserPageId,
  scopeId,
  canGoBack,
  canGoForward,
  webviewRef,
  onReload
}) {
  const createBrowserPage = useBrowserStore((s) => s.createBrowserPage);
  const [contextMenu, setContextMenu] = useState17(null);
  const contextMenuRef = useRef17(null);
  useEffect21(() => {
    return window.browserAPI.onContextMenuRequested((event) => {
      if (event.browserPageId !== browserPageId) {
        return;
      }
      const x = Math.round(event.screenX - window.screenX);
      const y = Math.round(event.screenY - window.screenY);
      setContextMenu({
        x,
        y,
        linkUrl: event.linkUrl,
        pageUrl: event.pageUrl,
        selectionText: event.selectionText ?? ""
      });
    });
  }, [browserPageId]);
  useEffect21(() => {
    return window.browserAPI.onContextMenuDismissed((event) => {
      if (event.browserPageId !== browserPageId) {
        return;
      }
      setContextMenu(null);
    });
  }, [browserPageId]);
  const closeMenu = useCallback17(() => {
    setContextMenu(null);
    try {
      webviewRef.current?.focus();
    } catch {
    }
  }, [webviewRef]);
  const menuItems = useCallback17(() => {
    const el = contextMenuRef.current;
    if (!el) {
      return [];
    }
    return [...el.querySelectorAll('[role="menuitem"]:not(:disabled)')];
  }, []);
  useEffect21(() => {
    if (!contextMenu) {
      return;
    }
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [closeMenu, contextMenu]);
  useEffect21(() => {
    if (!contextMenu) {
      return;
    }
    menuItems()[0]?.focus();
  }, [contextMenu, menuItems]);
  const handleMenuKeyDown = useCallback17(
    (e) => {
      const items = menuItems();
      if (items.length === 0) {
        return;
      }
      const currentIndex = items.indexOf(document.activeElement);
      let nextIndex;
      if (e.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % items.length;
      } else if (e.key === "ArrowUp") {
        nextIndex = (currentIndex <= 0 ? items.length : currentIndex) - 1;
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = items.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      items[nextIndex]?.focus();
    },
    [menuItems]
  );
  useLayoutEffect9(() => {
    const el = contextMenuRef.current;
    if (!el || !contextMenu) {
      return;
    }
    el.style.left = `${contextMenu.x}px`;
    el.style.top = `${contextMenu.y}px`;
    const rect = el.getBoundingClientRect();
    const offsetX = contextMenu.x - rect.left;
    const offsetY = contextMenu.y - rect.top;
    let renderX = contextMenu.x;
    let renderY = contextMenu.y;
    if (rect.right > window.innerWidth) {
      renderX = contextMenu.x - rect.width;
    }
    if (rect.bottom > window.innerHeight) {
      renderY = contextMenu.y - rect.height;
    }
    renderX = Math.max(0, renderX);
    renderY = Math.max(0, renderY);
    el.style.left = `${renderX + offsetX}px`;
    el.style.top = `${renderY + offsetY}px`;
  }, [contextMenu]);
  if (!contextMenu) {
    return null;
  }
  return createPortal(
    /* @__PURE__ */ jsxs30(Fragment7, { children: [
      /* @__PURE__ */ jsx38("div", { className: "fixed inset-0 z-50", onPointerDown: closeMenu }),
      /* @__PURE__ */ jsxs30(
        "div",
        {
          ref: contextMenuRef,
          role: "menu",
          "aria-orientation": "vertical",
          tabIndex: -1,
          onKeyDown: handleMenuKeyDown,
          "data-testid": "browser-context-menu",
          style: { left: contextMenu.x, top: contextMenu.y },
          className: "fixed z-50 min-w-[13rem] overflow-hidden rounded-[11px] border border-black/14 bg-[rgba(255,255,255,0.82)] p-1 text-black shadow-[0_16px_36px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl dark:border-white/14 dark:bg-[rgba(0,0,0,0.72)] dark:text-white dark:shadow-[0_20px_44px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]",
          children: [
            contextMenu.linkUrl ? /* @__PURE__ */ jsxs30(Fragment7, { children: [
              /* @__PURE__ */ jsx38(
                "button",
                {
                  role: "menuitem",
                  className: MENU_ITEM_CLASS,
                  onClick: () => {
                    if (!isFileUrl(contextMenu.linkUrl)) {
                      createBrowserPage(scopeId, contextMenu.linkUrl, { activate: false });
                    }
                    closeMenu();
                  },
                  children: translate(
                    "auto.components.browser.contextMenu.openLinkInNewPage",
                    "Open Link in New Page"
                  )
                }
              ),
              /* @__PURE__ */ jsx38(
                "button",
                {
                  role: "menuitem",
                  className: MENU_ITEM_CLASS,
                  onClick: () => {
                    const targetUrl = normalizeExternalBrowserUrl(contextMenu.linkUrl);
                    if (targetUrl) {
                      void window.browserAPI.openExternal({ url: targetUrl });
                    }
                    closeMenu();
                  },
                  children: translate(
                    "auto.components.browser.pane.BrowserPane.8ce4f6b12e",
                    "Open Link In Default Browser"
                  )
                }
              ),
              /* @__PURE__ */ jsx38(
                "button",
                {
                  role: "menuitem",
                  className: MENU_ITEM_CLASS,
                  onClick: () => {
                    void window.browserAPI.writeClipboardText(contextMenu.linkUrl ?? "");
                    closeMenu();
                  },
                  children: translate("auto.components.browser.contextMenu.copyLink", "Copy Link")
                }
              ),
              /* @__PURE__ */ jsx38("div", { className: "my-1 h-px bg-border/70" })
            ] }) : null,
            contextMenu.selectionText.trim() ? /* @__PURE__ */ jsxs30(Fragment7, { children: [
              /* @__PURE__ */ jsx38(
                "button",
                {
                  role: "menuitem",
                  className: MENU_ITEM_CLASS,
                  onClick: () => {
                    void window.browserAPI.writeClipboardText(contextMenu.selectionText);
                    closeMenu();
                  },
                  children: translate("auto.components.browser.pane.BrowserPane.2a4c4b8e1f", "Copy")
                }
              ),
              /* @__PURE__ */ jsx38("div", { className: "my-1 h-px bg-border/70" })
            ] }) : null,
            /* @__PURE__ */ jsx38(
              "button",
              {
                role: "menuitem",
                disabled: !canGoBack,
                className: MENU_ITEM_CLASS,
                onClick: () => {
                  webviewRef.current?.goBack();
                  closeMenu();
                },
                children: translate("auto.components.browser.pane.BrowserPane.40edfa75cb", "Back")
              }
            ),
            /* @__PURE__ */ jsx38(
              "button",
              {
                role: "menuitem",
                disabled: !canGoForward,
                className: MENU_ITEM_CLASS,
                onClick: () => {
                  webviewRef.current?.goForward();
                  closeMenu();
                },
                children: translate("auto.components.browser.pane.BrowserPane.250a9b3e42", "Forward")
              }
            ),
            /* @__PURE__ */ jsx38(
              "button",
              {
                role: "menuitem",
                className: MENU_ITEM_CLASS,
                onClick: () => {
                  onReload();
                  closeMenu();
                },
                children: translate("auto.components.browser.pane.BrowserPane.0e080d820e", "Reload")
              }
            ),
            /* @__PURE__ */ jsx38("div", { className: "my-1 h-px bg-border/70" }),
            /* @__PURE__ */ jsx38(
              "button",
              {
                role: "menuitem",
                className: MENU_ITEM_CLASS,
                onClick: () => {
                  const targetUrl = normalizeExternalBrowserUrl(contextMenu.pageUrl);
                  if (targetUrl) {
                    void window.browserAPI.openExternal({ url: targetUrl });
                  }
                  closeMenu();
                },
                children: translate(
                  "auto.components.browser.pane.BrowserPane.f7ab83f7ed",
                  "Open Page In Default Browser"
                )
              }
            ),
            /* @__PURE__ */ jsx38(
              "button",
              {
                role: "menuitem",
                className: MENU_ITEM_CLASS,
                onClick: () => {
                  void window.browserAPI.writeClipboardText(contextMenu.pageUrl);
                  closeMenu();
                },
                children: translate("auto.components.browser.pane.BrowserPane.1b179ab561", "Copy Page URL")
              }
            ),
            /* @__PURE__ */ jsx38("div", { className: "my-1 h-px bg-border/70" }),
            /* @__PURE__ */ jsx38(
              "button",
              {
                role: "menuitem",
                className: MENU_ITEM_CLASS,
                onClick: () => {
                  void window.browserAPI.openDevTools({ browserPageId });
                  closeMenu();
                },
                children: translate("auto.components.browser.pane.BrowserPane.a8f37f70c3", "Inspect Page")
              }
            )
          ]
        }
      )
    ] }),
    document.body
  );
}

// src/renderer/components/browser-pane/navigate/browser-load-failure-overlay.tsx
import { Copy as Copy2, ExternalLink as ExternalLink2, Globe as Globe3, RefreshCw as RefreshCw3 } from "lucide-react";
import { jsx as jsx39, jsxs as jsxs31 } from "react/jsx-runtime";
function getLoadErrorMetadata(loadError) {
  try {
    const parsed = new URL(loadError.validatedUrl);
    return {
      host: parsed.host || null,
      isLocalhostLike: parsed.hostname === "0.0.0.0" || isEligibleLocalCertificateHost(parsed.hostname)
    };
  } catch {
    return { host: null, isLocalhostLike: false };
  }
}
function BrowserLoadFailureOverlay({
  loadError,
  externalUrl,
  currentUrl,
  httpsRecoveryUrl,
  onRetry,
  onTryHttps,
  onCopy,
  onOpenExternal
}) {
  const meta = getLoadErrorMetadata(loadError);
  const guestRecoveryError = loadError.code === BROWSER_GUEST_RECOVERY_ERROR_CODE;
  const recoveryHint = formatLoadFailureRecoveryHint(meta, loadError);
  return /* @__PURE__ */ jsx39("div", { className: "absolute inset-0 z-20 flex items-center justify-center bg-background px-6", children: /* @__PURE__ */ jsxs31("div", { "aria-live": "polite", className: "flex max-w-lg flex-col items-center px-8 py-8 text-center", children: [
    /* @__PURE__ */ jsx39("div", { className: "mb-4 rounded-full border border-border bg-muted p-3 text-muted-foreground", children: /* @__PURE__ */ jsx39(Globe3, { className: "size-5" }) }),
    /* @__PURE__ */ jsx39("h2", { className: "text-base font-semibold text-foreground", children: guestRecoveryError ? translate("browser.guestRecovery.title", "Browser page stopped") : meta.host ? translate("browser.loadFailure.cantReachHost", "Can't reach {{value0}}", {
      value0: meta.host
    }) : translate("browser.loadFailure.cantLoadPage", "Can't load this page") }),
    /* @__PURE__ */ jsx39("p", { className: "mt-2 text-sm text-muted-foreground", children: formatLoadFailureDescription(loadError, meta) }),
    recoveryHint ? /* @__PURE__ */ jsx39("p", { className: "mt-2 text-xs text-muted-foreground", children: recoveryHint }) : null,
    /* @__PURE__ */ jsxs31("div", { className: "mt-5 flex flex-wrap items-center justify-center gap-2", children: [
      httpsRecoveryUrl && !guestRecoveryError ? /* @__PURE__ */ jsx39(
        Button,
        {
          size: "sm",
          className: "h-9 gap-2 px-3",
          onClick: () => onTryHttps(httpsRecoveryUrl),
          children: translate("browser.loadFailure.tryHttps", "Try HTTPS")
        }
      ) : null,
      /* @__PURE__ */ jsxs31(Button, { size: "sm", variant: "outline", className: "h-9 gap-2 px-3", onClick: onRetry, children: [
        /* @__PURE__ */ jsx39(RefreshCw3, { className: "size-4" }),
        translate("browser.loadFailure.retry", "Retry")
      ] }),
      /* @__PURE__ */ jsxs31(
        Button,
        {
          size: "sm",
          variant: "ghost",
          className: "h-9 gap-2 px-3",
          onClick: () => onCopy(currentUrl),
          children: [
            /* @__PURE__ */ jsx39(Copy2, { className: "size-4" }),
            translate("browser.loadFailure.copyAddress", "Copy Address")
          ]
        }
      ),
      externalUrl && onOpenExternal ? /* @__PURE__ */ jsxs31(
        Button,
        {
          size: "sm",
          variant: "ghost",
          className: "h-9 gap-2 px-3",
          onClick: () => onOpenExternal(externalUrl),
          children: [
            /* @__PURE__ */ jsx39(ExternalLink2, { className: "size-4" }),
            translate("browser.loadFailure.openExternally", "Open Externally")
          ]
        }
      ) : null
    ] })
  ] }) });
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-zoom-indicator.tsx
import { jsxs as jsxs32 } from "react/jsx-runtime";
function BrowserPageZoomIndicator({
  state,
  percent
}) {
  return /* @__PURE__ */ jsxs32(
    "div",
    {
      role: "status",
      "aria-live": "polite",
      "aria-hidden": state.ariaHidden,
      className: cn(
        "pointer-events-none absolute top-3 right-3 z-30 rounded-md border border-border bg-popover/95 px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-xs transition-opacity duration-300 ease-out",
        state.opacityClassName
      ),
      children: [
        percent,
        "%"
      ]
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserFind.tsx
import { useCallback as useCallback18, useEffect as useEffect22, useRef as useRef18, useState as useState18 } from "react";
import { ChevronUp, ChevronDown, X as X3 } from "lucide-react";

// src/renderer/lib/find-query-bounds.ts
var FIND_QUERY_MAX_BYTES = 2 * 1024;
function isFindQueryTooLarge(query, maxBytes = FIND_QUERY_MAX_BYTES) {
  return isClipboardTextByteLengthOverLimit(query, maxBytes);
}
function getFindRequestQuery(query) {
  return isFindQueryTooLarge(query) ? null : query;
}

// src/renderer/components/browser-pane/assemble-chrome/BrowserFind.tsx
import { jsx as jsx40, jsxs as jsxs33 } from "react/jsx-runtime";
function BrowserFind({
  isOpen,
  onClose,
  webviewRef,
  guestGeneration = null
}) {
  const inputRef = useRef18(null);
  const wasOpenRef = useRef18(isOpen);
  const activeFindQueryRef = useRef18(null);
  const [query, setQuery] = useState18("");
  const [activeMatch, setActiveMatch] = useState18(0);
  const [totalMatches, setTotalMatches] = useState18(0);
  const requestQuery = getFindRequestQuery(query);
  const safeFindInPage = useCallback18(
    (text, opts) => {
      const webview = webviewRef.current;
      if (!webview || !text) {
        return;
      }
      try {
        webview.findInPage(text, opts);
      } catch {
      }
    },
    [webviewRef]
  );
  const safeStopFindInPage = useCallback18(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }
    try {
      webview.stopFindInPage("clearSelection");
    } catch {
    }
  }, [webviewRef]);
  const findNext = useCallback18(() => {
    if (requestQuery) {
      const findNext2 = activeFindQueryRef.current !== requestQuery;
      safeFindInPage(requestQuery, { forward: true, findNext: findNext2 });
      activeFindQueryRef.current = requestQuery;
    }
  }, [requestQuery, safeFindInPage]);
  const findPrevious = useCallback18(() => {
    if (requestQuery) {
      const findNext2 = activeFindQueryRef.current !== requestQuery;
      safeFindInPage(requestQuery, { forward: false, findNext: findNext2 });
      activeFindQueryRef.current = requestQuery;
    }
  }, [requestQuery, safeFindInPage]);
  useEffect22(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      safeStopFindInPage();
    }
  }, [isOpen, safeStopFindInPage]);
  useEffect22(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!isOpen) {
      activeFindQueryRef.current = null;
      return;
    }
    if (!requestQuery) {
      activeFindQueryRef.current = null;
      safeStopFindInPage();
      return;
    }
    const runFind = () => {
      if (activeFindQueryRef.current === requestQuery) {
        return;
      }
      safeFindInPage(requestQuery, { findNext: true });
      activeFindQueryRef.current = requestQuery;
    };
    if (!wasOpen) {
      runFind();
      return;
    }
    const id = window.setTimeout(runFind, 200);
    return () => window.clearTimeout(id);
  }, [isOpen, requestQuery, safeFindInPage, safeStopFindInPage]);
  useEffect22(() => {
    const webview = webviewRef.current;
    if (!webview || !isOpen) {
      return;
    }
    const handleFoundInPage = (event) => {
      const { activeMatchOrdinal, matches } = event.result;
      setActiveMatch(activeMatchOrdinal);
      setTotalMatches(matches);
    };
    webview.addEventListener("found-in-page", handleFoundInPage);
    return () => {
      try {
        webview.removeEventListener("found-in-page", handleFoundInPage);
      } catch {
      }
    };
  }, [webviewRef, isOpen, guestGeneration]);
  if ((!isOpen || !requestQuery) && (activeMatch !== 0 || totalMatches !== 0)) {
    setActiveMatch(0);
    setTotalMatches(0);
  }
  const handleKeyDown = useCallback18(
    (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && e.shiftKey) {
        findPrevious();
      } else if (e.key === "Enter") {
        findNext();
      }
    },
    [onClose, findNext, findPrevious]
  );
  if (!isOpen) {
    return null;
  }
  return /* @__PURE__ */ jsxs33(
    "div",
    {
      className: "absolute top-2 right-2 z-50 flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/95 px-2 py-1 shadow-lg backdrop-blur-sm",
      style: { width: 300 },
      onKeyDown: handleKeyDown,
      children: [
        /* @__PURE__ */ jsx40(
          ImeInput,
          {
            ref: inputRef,
            type: "text",
            value: query,
            onChange: (e) => setQuery(e.target.value),
            placeholder: translate(
              "auto.components.browser.pane.BrowserFind.636a69cd66",
              "Find in page..."
            ),
            className: "min-w-0 flex-1 border-none bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
          }
        ),
        query ? /* @__PURE__ */ jsx40("span", { className: "shrink-0 text-xs text-zinc-400", children: totalMatches > 0 ? translate(
          "auto.components.browser.pane.BrowserFind.fc63f336aa",
          "{{value0}} of {{value1}}",
          { value0: activeMatch, value1: totalMatches }
        ) : translate("auto.components.browser.pane.BrowserFind.7baca7b1b8", "No matches") }) : null,
        /* @__PURE__ */ jsx40("div", { className: "mx-0.5 h-4 w-px bg-zinc-700" }),
        /* @__PURE__ */ jsx40(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "icon-xs",
            onClick: findPrevious,
            className: "flex size-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-200",
            title: translate("auto.components.browser.pane.BrowserFind.ca7aebbd7f", "Previous match"),
            children: /* @__PURE__ */ jsx40(ChevronUp, { size: 14 })
          }
        ),
        /* @__PURE__ */ jsx40(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "icon-xs",
            onClick: findNext,
            className: "flex size-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-200",
            title: translate("auto.components.browser.pane.BrowserFind.5c0c02ae76", "Next match"),
            children: /* @__PURE__ */ jsx40(ChevronDown, { size: 14 })
          }
        ),
        /* @__PURE__ */ jsx40("div", { className: "mx-0.5 h-4 w-px bg-zinc-700" }),
        /* @__PURE__ */ jsx40(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "icon-xs",
            onClick: onClose,
            className: "flex size-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-200",
            title: translate("auto.components.browser.pane.BrowserFind.c9d5f63fdc", "Close"),
            children: /* @__PURE__ */ jsx40(X3, { size: 14 })
          }
        )
      ]
    }
  );
}

// src/renderer/components/browser-pane/annotate/browser-guest-annotate-overlays.tsx
import { createPortal as createPortal2 } from "react-dom";
import { Copy as Copy4, Image as Image4, MessageSquarePlus as MessageSquarePlus7 } from "lucide-react";

// src/renderer/components/browser-pane/annotate/browser-page-annotation-tray.tsx
import { useEffect as useEffect23, useState as useState19 } from "react";
import { CircleCheck, Copy as Copy3, MessageSquarePlus as MessageSquarePlus4, Pencil, Send, Trash2 as Trash22 } from "lucide-react";

// src/renderer/ui/toggle-group.tsx
import * as React6 from "react";
import * as ToggleGroupPrimitive from "radix-ui/toggle-group";

// src/renderer/ui/toggle.tsx
import { cva as cva6 } from "class-variance-authority";
import * as TogglePrimitive from "radix-ui/toggle";
import { jsx as jsx41 } from "react/jsx-runtime";
var toggleVariants = cva6(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground"
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

// src/renderer/ui/toggle-group.tsx
import { jsx as jsx42 } from "react/jsx-runtime";
var ToggleGroupContext = React6.createContext({
  size: "default",
  variant: "default",
  spacing: 0
});
function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  children,
  ...props
}) {
  const contextValue = React6.useMemo(() => ({ variant, size, spacing }), [variant, size, spacing]);
  return /* @__PURE__ */ jsx42(
    ToggleGroupPrimitive.Root,
    {
      "data-slot": "toggle-group",
      "data-variant": variant,
      "data-size": size,
      "data-spacing": spacing,
      style: { "--gap": spacing },
      className: cn(
        "group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx42(ToggleGroupContext.Provider, { value: contextValue, children })
    }
  );
}
function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}) {
  const context = React6.useContext(ToggleGroupContext);
  return /* @__PURE__ */ jsx42(
    ToggleGroupPrimitive.Item,
    {
      "data-slot": "toggle-group-item",
      "data-variant": context.variant || variant,
      "data-size": context.size || size,
      "data-spacing": context.spacing,
      className: cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size
        }),
        "w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",
        "data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l",
        className
      ),
      ...props,
      children
    }
  );
}

// src/renderer/lib/screen-submit-shortcut.ts
function isScreenSubmitShortcut(event) {
  if (isImeOwnedKeyboardEvent(event)) {
    return false;
  }
  if (event.key !== "Enter" || event.altKey || event.shiftKey) {
    return false;
  }
  const platform = getRendererPlatform();
  return platform === "darwin" ? Boolean(event.metaKey) && !event.ctrlKey : Boolean(event.ctrlKey) && !event.metaKey;
}
function getScreenSubmitModifierLabel() {
  return getRendererPlatform() === "darwin" ? "\u2318" : "Ctrl";
}

// src/renderer/components/browser-pane/annotate/browser-page-annotation-tray.tsx
import { Fragment as Fragment8, jsx as jsx43, jsxs as jsxs34 } from "react/jsx-runtime";
function BrowserPageAnnotationTray({
  browserAnnotations,
  currentUrl,
  handleSendBrowserAnnotationsToAgent,
  browserAnnotationsSending,
  handleCopyBrowserAnnotations,
  browserAnnotationsCopied,
  handleClearBrowserAnnotations,
  handleDeleteBrowserAnnotation,
  handleUpdateBrowserAnnotation
}) {
  const [editingAnnotationId, setEditingAnnotationId] = useState19(null);
  const [editComment, setEditComment] = useState19("");
  const [editIntent, setEditIntent] = useState19("change");
  useEffect23(() => {
    if (editingAnnotationId && !browserAnnotations.some((annotation) => annotation.id === editingAnnotationId)) {
      setEditingAnnotationId(null);
    }
  }, [browserAnnotations, editingAnnotationId]);
  const handleStartEdit = (annotation) => {
    setEditingAnnotationId(annotation.id);
    setEditComment(annotation.comment);
    setEditIntent(annotation.intent);
  };
  const handleCancelEdit = () => {
    setEditingAnnotationId(null);
  };
  const handleSaveEdit = () => {
    const trimmed = editComment.trim();
    if (!trimmed || !editingAnnotationId) {
      return;
    }
    handleUpdateBrowserAnnotation(editingAnnotationId, trimmed, editIntent);
    setEditingAnnotationId(null);
  };
  return /* @__PURE__ */ jsxs34("div", { className: "absolute right-3 bottom-3 z-30 flex max-h-[45%] w-[min(20rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-[0_10px_24px_rgba(0,0,0,0.18)]", children: [
    /* @__PURE__ */ jsxs34("div", { className: "flex items-center gap-2 border-b border-border px-3 py-2", children: [
      /* @__PURE__ */ jsx43(MessageSquarePlus4, { className: "size-4 text-muted-foreground" }),
      /* @__PURE__ */ jsx43("div", { className: "min-w-0 flex-1 text-sm font-medium", children: browserAnnotations.length === 1 ? translate(
        "auto.components.browser.pane.BrowserPane.ea6af700da",
        "{{value0}} annotation",
        { value0: browserAnnotations.length }
      ) : translate(
        "auto.components.browser.pane.BrowserPane.c13693fe27",
        "{{value0}} annotations",
        { value0: browserAnnotations.length }
      ) }),
      handleSendBrowserAnnotationsToAgent ? /* @__PURE__ */ jsxs34(Tooltip, { children: [
        /* @__PURE__ */ jsx43(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxs34(
          Button,
          {
            size: "xs",
            variant: "outline",
            className: "gap-1.5",
            disabled: browserAnnotationsSending,
            onClick: () => void handleSendBrowserAnnotationsToAgent(),
            children: [
              /* @__PURE__ */ jsx43(Send, { className: "size-3" }),
              translate("auto.components.browser.pane.sendToAgent.annotations", "Send to agent")
            ]
          }
        ) }),
        /* @__PURE__ */ jsx43(TooltipContent, { side: "bottom", sideOffset: 6, children: translate(
          "auto.components.browser.pane.BrowserPane.95af781091",
          "Send feedback to an agent"
        ) })
      ] }) : null,
      /* @__PURE__ */ jsxs34(
        Button,
        {
          size: "xs",
          variant: "outline",
          className: "gap-1.5",
          onClick: handleCopyBrowserAnnotations,
          children: [
            browserAnnotationsCopied ? /* @__PURE__ */ jsx43(CircleCheck, { className: "size-3" }) : /* @__PURE__ */ jsx43(Copy3, { className: "size-3" }),
            browserAnnotationsCopied ? translate("auto.components.browser.pane.BrowserPane.6f4ab3592b", "Copied") : translate("auto.components.browser.pane.BrowserPane.d51ef37351", "Copy")
          ]
        }
      ),
      /* @__PURE__ */ jsxs34(Tooltip, { children: [
        /* @__PURE__ */ jsx43(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx43(
          Button,
          {
            size: "icon-xs",
            variant: "ghost",
            className: "text-muted-foreground hover:text-foreground",
            onClick: handleClearBrowserAnnotations,
            "aria-label": translate(
              "auto.components.browser.pane.BrowserPane.734e4343ec",
              "Clear browser annotations"
            ),
            children: /* @__PURE__ */ jsx43(Trash22, { className: "size-3" })
          }
        ) }),
        /* @__PURE__ */ jsx43(TooltipContent, { side: "bottom", sideOffset: 6, children: translate("auto.components.browser.pane.BrowserPane.11c5084aa2", "Clear annotations") })
      ] })
    ] }),
    /* @__PURE__ */ jsx43("div", { className: "min-h-0 flex-1 overflow-auto p-1.5", children: browserAnnotations.map((annotation, index) => {
      const isEditing = annotation.id === editingAnnotationId;
      return /* @__PURE__ */ jsxs34(
        "div",
        {
          className: "group flex gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent focus-within:bg-accent",
          children: [
            /* @__PURE__ */ jsx43("div", { className: "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground", children: index + 1 }),
            isEditing ? /* @__PURE__ */ jsxs34(
              "div",
              {
                className: "min-w-0 flex-1",
                "data-slot": "annotation-edit",
                onKeyDown: (event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    handleCancelEdit();
                  }
                },
                children: [
                  /* @__PURE__ */ jsx43(
                    ImeTextarea,
                    {
                      value: editComment,
                      onChange: (event) => setEditComment(event.target.value),
                      maxLength: GRAB_BUDGET.annotationCommentMaxLength,
                      className: "h-16 w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                      autoFocus: true,
                      "aria-label": translate(
                        "auto.components.browser.pane.BrowserPane.d2a7092e6e",
                        "Annotation comment"
                      ),
                      onKeyDown: (event) => {
                        if (isScreenSubmitShortcut(event)) {
                          event.preventDefault();
                          event.stopPropagation();
                          handleSaveEdit();
                        }
                      }
                    }
                  ),
                  /* @__PURE__ */ jsx43(
                    ToggleGroup,
                    {
                      type: "single",
                      size: "sm",
                      variant: "outline",
                      value: editIntent,
                      onValueChange: (value) => {
                        if (value) {
                          setEditIntent(value);
                        }
                      },
                      className: "mt-1.5 h-7 w-full [&_[data-slot=toggle-group-item]]:h-7 [&_[data-slot=toggle-group-item]]:flex-1 [&_[data-slot=toggle-group-item]]:px-1.5",
                      "aria-label": translate(
                        "auto.components.browser.pane.annotate.browser.page.annotation.tray.449d2c2629",
                        "Annotation intent"
                      ),
                      children: BROWSER_ANNOTATION_INTENT_OPTIONS.map((option) => {
                        const Icon2 = option.icon;
                        return /* @__PURE__ */ jsxs34(
                          ToggleGroupItem,
                          {
                            value: option.value,
                            "aria-label": option.label,
                            className: "gap-1 text-[11px] data-[state=on]:border-foreground/20 data-[state=on]:bg-foreground/10 data-[state=on]:text-foreground data-[state=on]:shadow-xs data-[state=on]:hover:bg-foreground/15 data-[state=on]:hover:text-foreground",
                            children: [
                              /* @__PURE__ */ jsx43(Icon2, { className: "size-3" }),
                              /* @__PURE__ */ jsx43("span", { children: option.label })
                            ]
                          },
                          option.value
                        );
                      })
                    }
                  ),
                  /* @__PURE__ */ jsxs34("div", { className: "mt-1.5 flex justify-end gap-1.5", children: [
                    /* @__PURE__ */ jsx43(Button, { size: "xs", variant: "ghost", onClick: handleCancelEdit, children: translate(
                      "auto.components.browser.pane.annotate.browser.page.annotation.tray.024467ceac",
                      "Cancel"
                    ) }),
                    /* @__PURE__ */ jsx43(Button, { size: "xs", disabled: !editComment.trim(), onClick: handleSaveEdit, children: translate(
                      "auto.components.browser.pane.annotate.browser.page.annotation.tray.c16f932cb3",
                      "Save"
                    ) })
                  ] })
                ]
              }
            ) : /* @__PURE__ */ jsxs34(Fragment8, { children: [
              /* @__PURE__ */ jsxs34("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsx43("div", { className: "truncate font-medium text-foreground", children: annotation.payload.target.accessibility.accessibleName || annotation.payload.target.textSnippet || annotation.payload.target.tagName }),
                /* @__PURE__ */ jsx43("div", { className: "mt-0.5 line-clamp-2 text-muted-foreground", children: annotation.comment }),
                /* @__PURE__ */ jsxs34("div", { className: "mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground", children: [
                  /* @__PURE__ */ jsx43("span", { children: annotation.intent }),
                  currentUrl !== void 0 && !browserAnnotationMatchesPageUrl(
                    annotation.payload.page.sanitizedUrl,
                    currentUrl
                  ) ? /* @__PURE__ */ jsx43("span", { className: "truncate", title: annotation.payload.page.sanitizedUrl, children: annotation.payload.page.sanitizedUrl }) : null
                ] })
              ] }),
              /* @__PURE__ */ jsxs34("div", { className: "flex shrink-0 items-start gap-0.5", children: [
                /* @__PURE__ */ jsx43(
                  Button,
                  {
                    size: "icon-xs",
                    variant: "ghost",
                    className: "[@media(hover:hover)]:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100",
                    onClick: () => handleStartEdit(annotation),
                    "aria-label": translate(
                      "auto.components.browser.pane.annotate.browser.page.annotation.tray.09a7c1df70",
                      "Edit annotation {{value0}}",
                      { value0: index + 1 }
                    ),
                    children: /* @__PURE__ */ jsx43(Pencil, { className: "size-3" })
                  }
                ),
                /* @__PURE__ */ jsx43(
                  Button,
                  {
                    size: "icon-xs",
                    variant: "ghost",
                    className: "[@media(hover:hover)]:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100",
                    onClick: () => handleDeleteBrowserAnnotation(annotation.id),
                    "aria-label": translate(
                      "auto.components.browser.pane.BrowserPane.f2d0c22d67",
                      "Delete annotation {{value0}}",
                      { value0: index + 1 }
                    ),
                    children: /* @__PURE__ */ jsx43(Trash22, { className: "size-3" })
                  }
                )
              ] })
            ] })
          ]
        },
        annotation.id
      );
    }) })
  ] });
}

// src/renderer/components/browser-pane/annotate/browser-page-grab-toast.tsx
import { CircleCheck as CircleCheck2, Image as Image3, MessageSquarePlus as MessageSquarePlus5, OctagonX } from "lucide-react";
import { jsx as jsx44, jsxs as jsxs35 } from "react/jsx-runtime";
function BrowserPageGrabToast({
  grabToast,
  grabToastTimerRef,
  dismissGrabToast,
  setGrabToast,
  onReviewForAgent
}) {
  return /* @__PURE__ */ jsxs35(
    "div",
    {
      className: "absolute z-30 flex items-center animate-in fade-in zoom-in-95 duration-150",
      style: {
        left: grabToast.x,
        top: grabToast.y,
        transform: grabToast.below ? "translate(-50%, 8px)" : "translate(-50%, -100%) translateY(-8px)",
        flexDirection: grabToast.below ? "column" : "column-reverse"
      },
      children: [
        /* @__PURE__ */ jsx44(
          "div",
          {
            className: "h-2 w-4 shrink-0",
            style: {
              clipPath: grabToast.below ? "polygon(50% 0%, 0% 100%, 100% 100%)" : "polygon(0% 0%, 100% 0%, 50% 100%)",
              background: "white"
            }
          }
        ),
        /* @__PURE__ */ jsxs35(
          "div",
          {
            className: `flex items-center gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 shadow-lg ${grabToast.type === "success" ? "bg-white text-gray-900" : "bg-white text-red-600"}`,
            children: [
              grabToast.type === "success" ? /* @__PURE__ */ jsx44(CircleCheck2, { className: "size-4 fill-blue-600 text-white" }) : /* @__PURE__ */ jsx44(OctagonX, { className: "size-4 text-red-500" }),
              /* @__PURE__ */ jsx44("span", { className: "text-sm font-semibold", children: grabToast.message }),
              grabToast.payload?.screenshot?.dataUrl?.startsWith("data:image/png;base64,") || onReviewForAgent && grabToast.payload ? /* @__PURE__ */ jsxs35(
                DropdownMenu,
                {
                  onOpenChange: (open) => {
                    if (open) {
                      clearTimeout(grabToastTimerRef.current);
                    } else {
                      grabToastTimerRef.current = setTimeout(() => dismissGrabToast(), 1200);
                    }
                  },
                  children: [
                    /* @__PURE__ */ jsx44(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx44("button", { className: "flex size-6 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-black/10 hover:text-gray-700", children: /* @__PURE__ */ jsx44("span", { className: "text-sm font-bold leading-none", children: "\xB7\xB7\xB7" }) }) }),
                    /* @__PURE__ */ jsxs35(DropdownMenuContent, { align: "start", sideOffset: 4, children: [
                      grabToast.payload?.screenshot?.dataUrl?.startsWith("data:image/png;base64,") ? /* @__PURE__ */ jsxs35(
                        DropdownMenuItem,
                        {
                          onSelect: () => {
                            const dataUrl = grabToast.payload?.screenshot?.dataUrl;
                            if (dataUrl?.startsWith("data:image/png;base64,")) {
                              void copyGrabScreenshotToClipboard(dataUrl);
                              setGrabToast(
                                (prev) => prev ? {
                                  ...prev,
                                  message: translate(
                                    "auto.components.browser.pane.BrowserPane.f30d2d35a7",
                                    "Screenshotted"
                                  )
                                } : null
                              );
                            }
                          },
                          children: [
                            /* @__PURE__ */ jsx44(Image3, { className: "size-3.5" }),
                            translate(
                              "auto.components.browser.pane.BrowserPane.1ded0d3168",
                              "Copy Screenshot"
                            ),
                            /* @__PURE__ */ jsx44(DropdownMenuShortcut, { children: "S" })
                          ]
                        }
                      ) : null,
                      onReviewForAgent && grabToast.payload ? /* @__PURE__ */ jsxs35(
                        DropdownMenuItem,
                        {
                          onSelect: () => {
                            if (grabToast.payload) {
                              onReviewForAgent(grabToast.payload);
                            }
                          },
                          children: [
                            /* @__PURE__ */ jsx44(MessageSquarePlus5, { className: "size-3.5" }),
                            translate("auto.components.browser.pane.sendToAgent.grab", "Send to agent\u2026")
                          ]
                        }
                      ) : null
                    ] })
                  ]
                }
              ) : null
            ]
          }
        )
      ]
    }
  );
}

// src/renderer/components/browser-pane/annotate/MarkupOverlay.tsx
import { useCallback as useCallback21, useRef as useRef20, useState as useState21 } from "react";
import { Check as Check3, X as X4 } from "lucide-react";

// src/renderer/components/browser-pane/annotate/MarkupToolbar.tsx
import React7 from "react";
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Highlighter,
  Pencil as Pencil2,
  Redo2,
  Square,
  Trash2 as Trash23,
  Type,
  Undo2
} from "lucide-react";
import { jsx as jsx45, jsxs as jsxs36 } from "react/jsx-runtime";
function toolItems() {
  return [
    {
      kind: "pen",
      icon: Pencil2,
      label: translate("auto.components.browser-pane.markup.tool.pen", "Pen")
    },
    {
      kind: "highlight",
      icon: Highlighter,
      label: translate("auto.components.browser-pane.markup.tool.highlight", "Highlighter")
    },
    {
      kind: "arrow",
      icon: ArrowUpRight,
      label: translate("auto.components.browser-pane.markup.tool.arrow", "Arrow")
    },
    {
      kind: "rect",
      icon: Square,
      label: translate("auto.components.browser-pane.markup.tool.rect", "Rectangle")
    },
    {
      kind: "ellipse",
      icon: Circle,
      label: translate("auto.components.browser-pane.markup.tool.ellipse", "Ellipse")
    },
    {
      kind: "text",
      icon: Type,
      label: translate("auto.components.browser-pane.markup.tool.text", "Text")
    },
    {
      kind: "eraser",
      icon: Eraser,
      label: translate("auto.components.browser-pane.markup.tool.eraser", "Eraser")
    }
  ];
}
var MarkupToolbar = React7.memo(function MarkupToolbar2({
  tool,
  onToolChange,
  color,
  onColorChange,
  width,
  onWidthChange,
  fontSize,
  onFontSizeChange,
  canUndo: canUndo2,
  canRedo: canRedo2,
  onUndo,
  onRedo,
  onClear
}) {
  return /* @__PURE__ */ jsx45(TooltipProvider, { delayDuration: 300, children: /* @__PURE__ */ jsxs36("div", { className: "flex flex-wrap items-center justify-center gap-1 rounded-md border border-border bg-card/95 px-1.5 py-1 shadow-md backdrop-blur", children: [
    toolItems().map((item) => /* @__PURE__ */ jsx45(
      IconButton,
      {
        label: item.label,
        active: tool === item.kind,
        onClick: () => onToolChange(item.kind),
        children: /* @__PURE__ */ jsx45(item.icon, { className: "size-4" })
      },
      item.kind
    )),
    /* @__PURE__ */ jsx45(Divider, {}),
    /* @__PURE__ */ jsxs36(Popover, { children: [
      /* @__PURE__ */ jsxs36(Tooltip, { children: [
        /* @__PURE__ */ jsx45(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx45(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsx45(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "icon-sm",
            "aria-label": translate(
              "auto.components.browser-pane.markup.style",
              "Color and thickness"
            ),
            children: /* @__PURE__ */ jsx45(
              "span",
              {
                className: "size-4 rounded-full border border-border",
                style: { backgroundColor: color }
              }
            )
          }
        ) }) }),
        /* @__PURE__ */ jsx45(TooltipContent, { side: "top", sideOffset: 4, children: translate("auto.components.browser-pane.markup.style", "Color and thickness") })
      ] }),
      /* @__PURE__ */ jsxs36(PopoverContent, { side: "top", align: "start", className: "w-auto p-2", children: [
        /* @__PURE__ */ jsx45("div", { className: "flex flex-wrap gap-1", children: MARKUP_COLORS.map((swatch) => /* @__PURE__ */ jsx45(
          "button",
          {
            type: "button",
            "aria-label": swatch,
            onClick: () => onColorChange(swatch),
            className: cn(
              "size-6 rounded-full border",
              color === swatch ? "border-ring ring-1 ring-ring" : "border-border"
            ),
            style: { backgroundColor: swatch }
          },
          swatch
        )) }),
        /* @__PURE__ */ jsx45("div", { className: "mt-2 flex items-center gap-1", children: MARKUP_WIDTHS.map((option) => /* @__PURE__ */ jsx45(
          "button",
          {
            type: "button",
            "aria-label": translate(
              "auto.components.browser-pane.markup.widthOption",
              "{{value0}} px",
              { value0: option }
            ),
            onClick: () => onWidthChange(option),
            className: cn(
              "flex h-6 flex-1 items-center justify-center rounded-sm border",
              width === option ? "border-ring bg-accent" : "border-border hover:bg-accent/50"
            ),
            children: /* @__PURE__ */ jsx45(
              "span",
              {
                className: "rounded-full bg-foreground",
                style: { width: option + 2, height: option + 2 }
              }
            )
          },
          option
        )) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs36(Popover, { children: [
      /* @__PURE__ */ jsxs36(Tooltip, { children: [
        /* @__PURE__ */ jsx45(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx45(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs36(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "sm",
            className: "h-8 gap-1 px-2",
            "aria-label": translate(
              "auto.components.browser-pane.markup.fontSize",
              "Font size"
            ),
            children: [
              /* @__PURE__ */ jsx45(Type, { className: "size-3.5" }),
              /* @__PURE__ */ jsx45("span", { className: "text-[11px] tabular-nums", children: fontSize })
            ]
          }
        ) }) }),
        /* @__PURE__ */ jsx45(TooltipContent, { side: "top", sideOffset: 4, children: translate("auto.components.browser-pane.markup.fontSize", "Font size") })
      ] }),
      /* @__PURE__ */ jsx45(PopoverContent, { side: "top", align: "start", className: "w-auto p-2", children: /* @__PURE__ */ jsx45("div", { className: "flex items-center gap-1", children: MARKUP_FONT_SIZES.map((size) => /* @__PURE__ */ jsx45(
        "button",
        {
          type: "button",
          "aria-label": translate(
            "auto.components.browser-pane.markup.widthOption",
            "{{value0}} px",
            { value0: size }
          ),
          onClick: () => onFontSizeChange(size),
          className: cn(
            "flex h-6 min-w-7 items-center justify-center rounded-sm border px-1 text-[11px] tabular-nums",
            fontSize === size ? "border-ring bg-accent" : "border-border hover:bg-accent/50"
          ),
          children: size
        },
        size
      )) }) })
    ] }),
    /* @__PURE__ */ jsx45(Divider, {}),
    /* @__PURE__ */ jsx45(
      IconButton,
      {
        label: translate("auto.components.browser-pane.markup.undo", "Undo"),
        disabled: !canUndo2,
        onClick: onUndo,
        children: /* @__PURE__ */ jsx45(Undo2, { className: "size-4" })
      }
    ),
    /* @__PURE__ */ jsx45(
      IconButton,
      {
        label: translate("auto.components.browser-pane.markup.redo", "Redo"),
        disabled: !canRedo2,
        onClick: onRedo,
        children: /* @__PURE__ */ jsx45(Redo2, { className: "size-4" })
      }
    ),
    /* @__PURE__ */ jsx45(
      IconButton,
      {
        label: translate("auto.components.browser-pane.markup.clear", "Clear all"),
        disabled: !canUndo2 && !canRedo2,
        onClick: onClear,
        children: /* @__PURE__ */ jsx45(Trash23, { className: "size-4" })
      }
    )
  ] }) });
});
function Divider() {
  return /* @__PURE__ */ jsx45("span", { className: "mx-0.5 h-5 w-px bg-border", "aria-hidden": true });
}
function IconButton({
  label,
  active,
  disabled,
  onClick,
  children
}) {
  return /* @__PURE__ */ jsxs36(Tooltip, { children: [
    /* @__PURE__ */ jsx45(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx45(
      Button,
      {
        type: "button",
        variant: active ? "default" : "ghost",
        size: "icon-sm",
        disabled,
        "aria-label": label,
        "aria-pressed": active,
        onClick,
        children
      }
    ) }),
    /* @__PURE__ */ jsx45(TooltipContent, { side: "top", sideOffset: 4, children: label })
  ] });
}

// src/renderer/components/browser-pane/annotate/useMarkupEditor.ts
import { useCallback as useCallback20, useEffect as useEffect25, useMemo as useMemo8, useRef as useRef19, useState as useState20 } from "react";

// src/renderer/components/browser-pane/annotate/markup-canvas-render.ts
function sceneDevicePixels(cssWidth, cssHeight, dpr) {
  const scale = clampMarkupScale(dpr);
  return {
    scale,
    width: Math.max(1, Math.round(cssWidth * scale)),
    height: Math.max(1, Math.round(cssHeight * scale))
  };
}
function renderCommittedLayer(layer, shapes, cssWidth, cssHeight, dpr) {
  const { scale, width, height } = sceneDevicePixels(cssWidth, cssHeight, dpr);
  if (layer.width !== width || layer.height !== height) {
    layer.width = width;
    layer.height = height;
  }
  const ctx = layer.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawShapes(ctx, shapes);
}
function blitMarkupScene(canvas, committedLayer, inProgress, cssWidth, cssHeight, dpr) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const { scale, width, height } = sceneDevicePixels(cssWidth, cssHeight, dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (committedLayer.width > 0 && committedLayer.height > 0) {
    ctx.drawImage(committedLayer, 0, 0, width, height);
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (inProgress) {
    drawShapes(ctx, [inProgress]);
  }
}

// src/renderer/components/browser-pane/annotate/useMarkupKeyboardShortcuts.ts
import { useEffect as useEffect24 } from "react";
function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}
function useMarkupKeyboardShortcuts(params) {
  const { pendingText, setPendingText, undo, redo, onCancel } = params;
  useEffect24(() => {
    const isMac = navigator.userAgent.includes("Mac");
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === "Escape") {
        if (pendingText) {
          setPendingText(null);
        } else {
          onCancel();
        }
        return;
      }
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingText, setPendingText, undo, redo, onCancel]);
}

// src/renderer/components/browser-pane/annotate/useMarkupPointerHandlers.ts
import { useCallback as useCallback19 } from "react";

// src/renderer/components/browser-pane/annotate/markup-shape-hit-test.ts
var ERASER_RADIUS = 8;
var ELLIPSE_MAX_CHORD = 12;
var ELLIPSE_MIN_SEGMENTS = 16;
function shapesTouchedBySweep(shapes, from, to, measureTextInkBox) {
  return shapes.filter((shape) => sweepTouchesShape(shape, from, to, measureTextInkBox));
}
function topmostShapeAt(shapes, point, measureTextInkBox) {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    if (sweepTouchesShape(shapes[i], point, point, measureTextInkBox)) {
      return shapes[i];
    }
  }
  return void 0;
}
function sweepTouchesShape(shape, from, to, measureTextInkBox) {
  return shape.kind === "text" ? sweepTouchesBox(from, to, measureTextInkBox(shape)) : sweepTouchesStroke(from, to, strokedInk(shape));
}
function sweepTouchesStroke(from, to, ink) {
  const reach = ink.halfWidth + ERASER_RADIUS;
  return ink.paths.some((path) => sweepDistanceToPath(from, to, path) <= reach);
}
function sweepTouchesBox(from, to, box) {
  if (!box) {
    return false;
  }
  const inside = from.x >= box.x && from.x <= box.x + box.width && from.y >= box.y && from.y <= box.y + box.height;
  return inside || sweepDistanceToPath(from, to, rectOutline(box)) <= ERASER_RADIUS;
}
function strokedInk(shape) {
  switch (shape.kind) {
    case "pen":
      return { paths: [shape.points], halfWidth: strokeDotRadius(shape.width) };
    case "highlight":
      return { paths: [shape.points], halfWidth: strokeDotRadius(highlightWidth(shape.width)) };
    case "arrow": {
      const head = arrowHeadGeometry(shape.from, shape.to, shape.width);
      const shaft = [shape.from, shape.to];
      return {
        paths: head ? [shaft, [head.left, head.tip, head.right]] : [shaft],
        halfWidth: shape.width / 2
      };
    }
    case "rect":
      return {
        paths: [rectOutline(normalizeRect(shape.from, shape.to))],
        halfWidth: shape.width / 2
      };
    case "ellipse":
      return {
        paths: [ellipseOutline(normalizeRect(shape.from, shape.to))],
        halfWidth: shape.width / 2
      };
  }
}
function rectOutline(rect) {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return [
    { x: rect.x, y: rect.y },
    { x: right, y: rect.y },
    { x: right, y: bottom },
    { x: rect.x, y: bottom },
    { x: rect.x, y: rect.y }
  ];
}
function ellipseOutline(rect) {
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  const segments = Math.max(
    ELLIPSE_MIN_SEGMENTS,
    Math.ceil(2 * Math.PI * Math.max(rx, ry) / ELLIPSE_MAX_CHORD)
  );
  const outline = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = i / segments * 2 * Math.PI;
    outline.push({ x: rect.x + rx + rx * Math.cos(angle), y: rect.y + ry + ry * Math.sin(angle) });
  }
  return outline;
}
function sweepDistanceToPath(from, to, path) {
  let nearest = path.length === 1 ? pointToSegmentDistance(path[0], from, to) : Infinity;
  for (let i = 1; i < path.length; i += 1) {
    nearest = Math.min(nearest, segmentDistance(from, to, path[i - 1], path[i]));
  }
  return nearest;
}
function segmentDistance(a1, a2, b1, b2) {
  if (segmentsCross(a1, a2, b1, b2)) {
    return 0;
  }
  return Math.min(
    pointToSegmentDistance(a1, b1, b2),
    pointToSegmentDistance(a2, b1, b2),
    pointToSegmentDistance(b1, a1, a2),
    pointToSegmentDistance(b2, a1, a2)
  );
}
function segmentsCross(a1, a2, b1, b2) {
  return cross(a1, a2, b1) * cross(a1, a2, b2) < 0 && cross(b1, b2, a1) * cross(b1, b2, a2) < 0;
}
function cross(origin, a, b) {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}
function pointToSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

// src/renderer/components/browser-pane/annotate/markup-gesture.ts
var ERASER_CLICK_SLOP = 4;
function beginDrawGesture(state, pointerId, shape) {
  const settled = settleMissedRelease(state, pointerId);
  return settled.gesture ? settled : { ...settled, gesture: { kind: "draw", pointerId, shape } };
}
function beginEraseGesture(state, pointerId, point, measureTextInkBox) {
  const settled = settleMissedRelease(state, pointerId);
  if (settled.gesture) {
    return settled;
  }
  const topmost = topmostShapeAt(settled.doc.shapes, point, measureTextInkBox);
  return {
    ...settled,
    gesture: {
      kind: "erase",
      pointerId,
      origin: point,
      phase: "pressed",
      last: point,
      erasedIds: new Set(topmost ? [topmost.id] : [])
    }
  };
}
function settleMissedRelease(state, pointerId) {
  return state.gesture?.pointerId === pointerId ? endGesture(state, pointerId) : state;
}
function moveGesture(state, pointerId, point, measureTextInkBox) {
  const { gesture } = state;
  if (gesture?.pointerId !== pointerId) {
    return state;
  }
  if (gesture.kind === "erase") {
    if (gesture.phase === "pressed") {
      const { origin } = gesture;
      if (Math.hypot(point.x - origin.x, point.y - origin.y) < ERASER_CLICK_SLOP) {
        return state;
      }
      const dragging = { ...gesture, phase: "dragging" };
      return {
        ...state,
        gesture: sweepEraser(dragging, state.doc.shapes, point, measureTextInkBox)
      };
    }
    return { ...state, gesture: sweepEraser(gesture, state.doc.shapes, point, measureTextInkBox) };
  }
  return { ...state, gesture: { ...gesture, shape: dragShapeTo(gesture.shape, point) } };
}
function endGesture(state, pointerId) {
  const { doc, gesture } = state;
  if (gesture?.pointerId !== pointerId) {
    return state;
  }
  if (gesture.kind === "draw") {
    return { doc: hasNoSize(gesture.shape) ? doc : commitShape(doc, gesture.shape), gesture: null };
  }
  const remaining = doc.shapes.filter((shape) => !gesture.erasedIds.has(shape.id));
  return {
    doc: remaining.length === doc.shapes.length ? doc : setShapes(doc, remaining),
    gesture: null
  };
}
function cancelGesture(state, pointerId) {
  return state.gesture?.pointerId === pointerId ? { ...state, gesture: null } : state;
}
function undoMarkup(state) {
  if (gestureHasEffect(state.gesture)) {
    return { ...state, gesture: null };
  }
  return canUndo(state.doc) ? { doc: undoShape(state.doc), gesture: null } : state;
}
function canUndoMarkup(state) {
  return gestureHasEffect(state.gesture) || canUndo(state.doc);
}
function gestureHasEffect(gesture) {
  if (gesture === null) {
    return false;
  }
  return gesture.kind === "draw" ? !hasNoSize(gesture.shape) : gesture.erasedIds.size > 0;
}
function hasNoSize(shape) {
  return shape.kind !== "pen" && shape.kind !== "highlight" && shape.from.x === shape.to.x && shape.from.y === shape.to.y;
}
function redoMarkup(state) {
  return canRedo(state.doc) ? applyDocumentCommand(state, redoShape) : state;
}
function applyDocumentCommand(state, command) {
  return { doc: command(state.doc), gesture: null };
}
function sweepEraser(gesture, shapes, point, measureTextInkBox) {
  const touched = shapesTouchedBySweep(
    shapes.filter((shape) => !gesture.erasedIds.has(shape.id)),
    gesture.last,
    point,
    measureTextInkBox
  );
  const erasedIds = touched.length === 0 ? gesture.erasedIds : /* @__PURE__ */ new Set([...gesture.erasedIds, ...touched.map((shape) => shape.id)]);
  return { ...gesture, last: point, erasedIds };
}
function dragShapeTo(shape, point) {
  if (shape.kind === "pen" || shape.kind === "highlight") {
    return { ...shape, points: [...shape.points, point] };
  }
  return { ...shape, to: point };
}

// src/renderer/components/browser-pane/annotate/useMarkupPointerHandlers.ts
function useMarkupPointerHandlers(params) {
  const {
    busy,
    tool,
    color,
    width,
    pendingText,
    canvasRef,
    measureTextInkBox,
    setPendingText,
    setState
  } = params;
  const pointFromEvent = useCallback19(
    (event) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return { x: 0, y: 0 };
      }
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    },
    [canvasRef]
  );
  const onPointerDown = useCallback19(
    (event) => {
      if (busy || event.button !== 0) {
        return;
      }
      const point = pointFromEvent(event);
      if (tool === "text") {
        if (pendingText) {
          return;
        }
        event.preventDefault();
        setPendingText({ x: point.x, y: point.y, initial: "" });
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      const { pointerId } = event;
      if (tool === "eraser") {
        setState((state) => beginEraseGesture(state, pointerId, point, measureTextInkBox));
        return;
      }
      const id = createNonSecureContextUuid();
      const shape = tool === "pen" || tool === "highlight" ? { id, kind: tool, color, width, points: [point] } : { id, kind: tool, color, width, from: point, to: point };
      setState((state) => beginDrawGesture(state, pointerId, shape));
    },
    [
      busy,
      color,
      measureTextInkBox,
      pendingText,
      pointFromEvent,
      setPendingText,
      setState,
      tool,
      width
    ]
  );
  const onPointerMove = useCallback19(
    (event) => {
      const point = pointFromEvent(event);
      const { pointerId } = event;
      setState((state) => moveGesture(state, pointerId, point, measureTextInkBox));
    },
    [measureTextInkBox, pointFromEvent, setState]
  );
  const onPointerUp = useCallback19(
    (event) => {
      const { pointerId } = event;
      setState((state) => endGesture(state, pointerId));
    },
    [setState]
  );
  const onPointerCancel = useCallback19(
    (event) => {
      const { pointerId } = event;
      setState((state) => cancelGesture(state, pointerId));
    },
    [setState]
  );
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

// src/renderer/components/browser-pane/annotate/useMarkupEditor.ts
function useMarkupEditor(busy, onCancel) {
  const rootRef = useRef19(null);
  const canvasRef = useRef19(null);
  const textInputRef = useRef19(null);
  const committedLayerRef = useRef19(null);
  if (committedLayerRef.current === null) {
    committedLayerRef.current = document.createElement("canvas");
  }
  const [size, setSize] = useState20({ width: 0, height: 0, dpr: 1 });
  const [{ doc, gesture }, setState] = useState20(() => ({
    doc: createMarkupDocument(),
    gesture: null
  }));
  const drawing = gesture?.kind === "draw" ? gesture.shape : null;
  const erasedIds = gesture?.kind === "erase" ? gesture.erasedIds : null;
  const shapes = useMemo8(
    () => erasedIds && erasedIds.size > 0 ? doc.shapes.filter((shape) => !erasedIds.has(shape.id)) : doc.shapes,
    [doc.shapes, erasedIds]
  );
  const [tool, setTool] = useState20("pen");
  const [color, setColor] = useState20(DEFAULT_MARKUP_COLOR);
  const [width, setWidth] = useState20(DEFAULT_MARKUP_WIDTH);
  const [fontSize, setFontSize] = useState20(DEFAULT_MARKUP_FONT_SIZE);
  const [pendingText, setPendingText] = useState20(null);
  useEffect25(() => {
    const root = rootRef.current;
    if (!root) {
      return void 0;
    }
    const measure = () => {
      const rect = root.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      setSize(
        (prev) => prev.width === rect.width && prev.height === rect.height && prev.dpr === dpr ? prev : { width: rect.width, height: rect.height, dpr }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect25(() => {
    const layer = committedLayerRef.current;
    if (!layer) {
      return;
    }
    renderCommittedLayer(layer, shapes, size.width, size.height, size.dpr);
  }, [shapes, size]);
  useEffect25(() => {
    const canvas = canvasRef.current;
    const layer = committedLayerRef.current;
    if (!canvas || !layer) {
      return void 0;
    }
    const handle = requestAnimationFrame(() => {
      blitMarkupScene(canvas, layer, drawing, size.width, size.height, size.dpr);
    });
    return () => cancelAnimationFrame(handle);
  }, [shapes, drawing, size]);
  useEffect25(() => {
    if (!pendingText) {
      return void 0;
    }
    const handle = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(handle);
  }, [pendingText]);
  const undo = useCallback20(() => setState(undoMarkup), []);
  const redo = useCallback20(() => setState(redoMarkup), []);
  const clear = useCallback20(() => {
    setPendingText(null);
    setState((state) => applyDocumentCommand(state, clearShapes));
  }, []);
  const measureTextInkBox = useCallback20((shape) => {
    const ctx = committedLayerRef.current?.getContext("2d");
    return ctx ? textInkBox(ctx, shape) : null;
  }, []);
  useMarkupKeyboardShortcuts({ pendingText, setPendingText, undo, redo, onCancel });
  const pointerHandlers = useMarkupPointerHandlers({
    busy,
    tool,
    color,
    width,
    pendingText,
    canvasRef,
    measureTextInkBox,
    setPendingText,
    setState
  });
  const commitPendingText = useCallback20(
    (text) => {
      const at = pendingText;
      setPendingText(null);
      const trimmed = text.trim();
      if (!at || trimmed.length === 0) {
        return;
      }
      setState((state) => ({
        ...state,
        doc: commitShape(state.doc, {
          id: createNonSecureContextUuid(),
          kind: "text",
          color,
          at,
          text: trimmed,
          fontSize
        })
      }));
    },
    [color, fontSize, pendingText]
  );
  const cancelPendingText = useCallback20(() => setPendingText(null), []);
  return {
    rootRef,
    canvasRef,
    textInputRef,
    tool,
    color,
    width,
    fontSize,
    pendingText,
    shapes,
    canUndo: canUndoMarkup({ doc, gesture }),
    canRedo: canRedo(doc),
    setTool,
    setColor,
    setWidth,
    setFontSize,
    undo,
    redo,
    clear,
    ...pointerHandlers,
    commitPendingText,
    cancelPendingText
  };
}

// src/renderer/components/browser-pane/annotate/MarkupOverlay.tsx
import { jsx as jsx46, jsxs as jsxs37 } from "react/jsx-runtime";
function MarkupOverlay({
  baseImage,
  busy,
  onComplete,
  onCancel
}) {
  const baseImgRef = useRef20(null);
  const [baseLoaded, setBaseLoaded] = useState21(false);
  const editor = useMarkupEditor(busy, onCancel);
  const { pendingText } = editor;
  const handleDone = useCallback21(() => {
    const imageElement = baseImgRef.current;
    if (!imageElement || !baseLoaded) {
      return;
    }
    onComplete({ imageElement, shapes: editor.shapes });
  }, [baseLoaded, editor.shapes, onComplete]);
  return /* @__PURE__ */ jsxs37(
    "div",
    {
      ref: editor.rootRef,
      "data-orca-markup-overlay": true,
      className: "absolute inset-0 z-20 overflow-hidden",
      children: [
        /* @__PURE__ */ jsx46(
          "img",
          {
            ref: baseImgRef,
            src: baseImage.dataUrl,
            alt: "",
            draggable: false,
            onLoad: () => setBaseLoaded(true),
            onError: () => {
              console.error("markup: base screenshot failed to load");
              onCancel();
            },
            className: "pointer-events-none absolute inset-0 block h-full w-full select-none",
            style: { objectFit: "fill" }
          }
        ),
        /* @__PURE__ */ jsx46(
          "canvas",
          {
            ref: editor.canvasRef,
            className: cn(
              "absolute inset-0 h-full w-full touch-none",
              busy ? "cursor-progress" : "cursor-crosshair"
            ),
            onPointerDown: editor.onPointerDown,
            onPointerMove: editor.onPointerMove,
            onPointerUp: editor.onPointerUp,
            onPointerCancel: editor.onPointerCancel,
            onLostPointerCapture: editor.onPointerUp
          }
        ),
        pendingText ? /* @__PURE__ */ jsx46(
          ImeInput,
          {
            ref: editor.textInputRef,
            defaultValue: pendingText.initial,
            "aria-label": translate("auto.components.browser-pane.markup.textInput", "Annotation text"),
            onPointerDown: (event) => event.stopPropagation(),
            onBlur: (event) => editor.commitPendingText(event.target.value),
            onKeyDown: (event) => {
              event.stopPropagation();
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                editor.commitPendingText(event.currentTarget.value);
              } else if (event.key === "Escape") {
                event.preventDefault();
                editor.cancelPendingText();
              }
            },
            className: "absolute z-30 min-w-0 border-0 bg-transparent p-0 leading-none outline-none [field-sizing:content]",
            style: {
              left: pendingText.x,
              top: pendingText.y,
              color: editor.color,
              fontSize: editor.fontSize,
              fontWeight: 600,
              fontFamily: TEXT_FONT_FAMILY,
              // Why: force line-height to 1 (the UA default ~1.2 pushes the glyph
              // down) and zero the height so the text top aligns with the canvas's
              // textBaseline:'top' render — otherwise editing text sits slightly low.
              lineHeight: 1,
              height: "1em",
              boxSizing: "content-box",
              padding: 0,
              textShadow: editor.color.toLowerCase() === "#ffffff" ? "0 0 3px rgba(0,0,0,0.7)" : "0 0 3px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.9)"
            }
          },
          `${pendingText.x},${pendingText.y}`
        ) : null,
        /* @__PURE__ */ jsxs37("div", { className: "pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3", children: [
          /* @__PURE__ */ jsx46("div", { className: "pointer-events-auto max-w-full", children: /* @__PURE__ */ jsx46(
            MarkupToolbar,
            {
              tool: editor.tool,
              onToolChange: editor.setTool,
              color: editor.color,
              onColorChange: editor.setColor,
              width: editor.width,
              onWidthChange: editor.setWidth,
              fontSize: editor.fontSize,
              onFontSizeChange: editor.setFontSize,
              canUndo: editor.canUndo,
              canRedo: editor.canRedo,
              onUndo: editor.undo,
              onRedo: editor.redo,
              onClear: editor.clear
            }
          ) }),
          /* @__PURE__ */ jsxs37("div", { className: "pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-card/95 p-1.5 shadow-md backdrop-blur", children: [
            /* @__PURE__ */ jsx46("span", { className: "px-1 text-xs text-muted-foreground", children: translate(
              "auto.components.browser-pane.markup.hint",
              "Draw on the page, then copy the markup to paste into your agent."
            ) }),
            /* @__PURE__ */ jsxs37(Button, { type: "button", variant: "ghost", size: "sm", onClick: onCancel, disabled: busy, children: [
              /* @__PURE__ */ jsx46(X4, { className: "size-4" }),
              translate("auto.components.browser-pane.markup.cancel", "Cancel")
            ] }),
            /* @__PURE__ */ jsxs37(Button, { type: "button", size: "sm", onClick: handleDone, disabled: busy || !baseLoaded, children: [
              /* @__PURE__ */ jsx46(Check3, { className: "size-4" }),
              translate("auto.components.browser-pane.markup.copy", "Copy Markup")
            ] })
          ] })
        ] })
      ]
    }
  );
}

// src/renderer/components/browser-pane/annotate/pending-browser-annotation-card.tsx
import { useEffect as useEffect26, useState as useState22 } from "react";
import { CornerDownLeft, MessageSquarePlus as MessageSquarePlus6 } from "lucide-react";
import { jsx as jsx47, jsxs as jsxs38 } from "react/jsx-runtime";
function PendingBrowserAnnotationCard({
  payload,
  resolveAnchor,
  portalContainer,
  onAdd,
  onCancel
}) {
  const [card, setCard] = useState22(null);
  const [cardHeight, setCardHeight] = useState22(null);
  useEffect26(() => {
    if (!card || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => setCardHeight(card.offsetHeight || null));
    observer.observe(card);
    return () => observer.disconnect();
  }, [card]);
  const anchor = resolveAnchor(cardHeight);
  const [comment, setComment] = useState22("");
  const [intent, setIntent] = useState22("change");
  const trimmed = comment.trim();
  const submitModifierLabel = getScreenSubmitModifierLabel();
  return /* @__PURE__ */ jsxs38(
    Popover,
    {
      open: true,
      onOpenChange: (open) => {
        if (!open) {
          onCancel();
        }
      },
      children: [
        /* @__PURE__ */ jsx47(PopoverAnchor, { asChild: true, children: /* @__PURE__ */ jsx47(
          "span",
          {
            className: "pointer-events-none absolute size-px",
            style: { left: anchor.x, top: anchor.y }
          }
        ) }),
        /* @__PURE__ */ jsxs38(
          PopoverContent,
          {
            ref: setCard,
            side: anchor.side,
            align: "center",
            sideOffset: 10,
            collisionBoundary: portalContainer ?? void 0,
            collisionPadding: 12,
            portalContainer,
            className: "z-40 w-[22rem] max-w-[calc(var(--radix-popover-content-available-width)-1rem)] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]",
            "aria-label": translate(
              "auto.components.browser.pane.BrowserPane.b472c5fe03",
              "Add browser annotation"
            ),
            onEscapeKeyDown: (event) => {
              event.preventDefault();
              onCancel();
            },
            children: [
              /* @__PURE__ */ jsxs38("div", { className: "mb-2 flex min-w-0 items-center gap-1.5", title: payload.target.selector, children: [
                /* @__PURE__ */ jsx47("span", { className: "shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground", children: payload.target.tagName }),
                /* @__PURE__ */ jsx47("span", { className: "truncate text-xs font-medium text-foreground", children: payload.target.accessibility.accessibleName || payload.target.textSnippet || payload.target.selector })
              ] }),
              /* @__PURE__ */ jsx47(Label2, { htmlFor: "browser-annotation-comment", className: "sr-only", children: translate("auto.components.browser.pane.BrowserPane.d2a7092e6e", "Annotation comment") }),
              /* @__PURE__ */ jsx47(
                ImeTextarea,
                {
                  id: "browser-annotation-comment",
                  value: comment,
                  onChange: (event) => setComment(event.target.value),
                  placeholder: translate(
                    "auto.components.browser.pane.BrowserPane.532bac48c5",
                    "Describe what the agent should change here..."
                  ),
                  maxLength: GRAB_BUDGET.annotationCommentMaxLength,
                  className: "h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  autoFocus: true,
                  onKeyDown: (event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      onCancel();
                      return;
                    }
                    if (isScreenSubmitShortcut(event)) {
                      event.preventDefault();
                      event.stopPropagation();
                      if (trimmed) {
                        onAdd(trimmed, intent);
                      }
                    }
                  }
                }
              ),
              /* @__PURE__ */ jsx47(
                ToggleGroup,
                {
                  type: "single",
                  size: "sm",
                  variant: "outline",
                  value: intent,
                  onValueChange: (value) => {
                    if (value) {
                      setIntent(value);
                    }
                  },
                  className: "mt-2 h-8 w-full [&_[data-slot=toggle-group-item]]:h-8 [&_[data-slot=toggle-group-item]]:flex-1",
                  "aria-label": translate(
                    "auto.components.browser.pane.BrowserPane.0cb3bd6221",
                    "Annotation intent"
                  ),
                  children: BROWSER_ANNOTATION_INTENT_OPTIONS.map((option) => {
                    const Icon2 = option.icon;
                    return /* @__PURE__ */ jsxs38(
                      ToggleGroupItem,
                      {
                        value: option.value,
                        "aria-label": option.label,
                        className: "gap-1.5 text-xs data-[state=on]:border-foreground/20 data-[state=on]:bg-foreground/10 data-[state=on]:text-foreground data-[state=on]:shadow-xs data-[state=on]:hover:bg-foreground/15 data-[state=on]:hover:text-foreground",
                        children: [
                          /* @__PURE__ */ jsx47(Icon2, { className: "size-3.5" }),
                          /* @__PURE__ */ jsx47("span", { children: option.label })
                        ]
                      },
                      option.value
                    );
                  })
                }
              ),
              /* @__PURE__ */ jsxs38("div", { className: "mt-3 flex justify-end gap-2", children: [
                /* @__PURE__ */ jsx47(Button, { size: "sm", variant: "ghost", className: "h-8", onClick: onCancel, children: translate("auto.components.browser.pane.BrowserPane.fa6ea61de3", "Cancel") }),
                /* @__PURE__ */ jsxs38(
                  Button,
                  {
                    size: "sm",
                    className: "h-8 gap-1.5",
                    disabled: !trimmed,
                    onClick: () => onAdd(trimmed, intent),
                    children: [
                      /* @__PURE__ */ jsx47(MessageSquarePlus6, { className: "size-3.5" }),
                      translate("auto.components.browser.pane.BrowserPane.90d021f2ad", "Add"),
                      /* @__PURE__ */ jsxs38("span", { className: "ml-1 inline-flex items-center gap-0.5 rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-medium leading-none text-current/80", children: [
                        /* @__PURE__ */ jsx47("span", { children: submitModifierLabel }),
                        /* @__PURE__ */ jsx47(CornerDownLeft, { className: "size-3" })
                      ] })
                    ]
                  }
                )
              ] })
            ]
          }
        )
      ]
    }
  );
}

// src/renderer/components/browser-pane/annotate/browser-guest-annotate-overlays.tsx
import { Fragment as Fragment9, jsx as jsx48, jsxs as jsxs39 } from "react/jsx-runtime";
function BrowserGuestAnnotateOverlays({
  grab,
  markup,
  annotationSend,
  grabAnnotations,
  containerRef,
  webviewRef,
  browserOverlayViewport,
  markupPortalContainer,
  currentUrl
}) {
  const {
    pendingAnnotationPayload,
    handleAddBrowserAnnotation,
    handleCancelPendingBrowserAnnotation,
    grabIntent,
    grabMenuActionTakenRef,
    handleGrabCopy,
    handleGrabCopyScreenshot,
    handleGrabSendToAgent,
    grabReviewPayload,
    grabReviewSending,
    openGrabReview,
    closeGrabReview,
    handleSendGrabReview,
    grabToast,
    grabToastTimerRef,
    dismissGrabToast,
    setGrabToast
  } = grabAnnotations;
  const markupTarget = markupPortalContainer ?? containerRef.current;
  const {
    browserAnnotations,
    browserAnnotationTrayOpen,
    browserAnnotationsSending,
    handleSendBrowserAnnotationsToAgent,
    handleCopyBrowserAnnotations,
    browserAnnotationsCopied,
    handleClearBrowserAnnotations,
    handleDeleteBrowserAnnotation,
    handleUpdateBrowserAnnotation
  } = annotationSend;
  return /* @__PURE__ */ jsxs39(Fragment9, { children: [
    markup.isActive && markup.baseImage && markupTarget ? createPortal2(
      /* @__PURE__ */ jsx48(
        MarkupOverlay,
        {
          baseImage: markup.baseImage,
          busy: markup.state === "composing",
          onComplete: (input) => void markup.complete(input),
          onCancel: markup.cancel
        }
      ),
      markupTarget
    ) : null,
    pendingAnnotationPayload ? /* @__PURE__ */ jsx48(
      PendingBrowserAnnotationCard,
      {
        payload: pendingAnnotationPayload,
        resolveAnchor: (cardHeight) => getBrowserOverlayAnchor(
          pendingAnnotationPayload,
          containerRef.current,
          webviewRef.current,
          browserOverlayViewport,
          cardHeight
        ),
        portalContainer: containerRef.current,
        onAdd: handleAddBrowserAnnotation,
        onCancel: handleCancelPendingBrowserAnnotation
      }
    ) : null,
    browserAnnotations.length > 0 && browserAnnotationTrayOpen ? /* @__PURE__ */ jsx48(
      BrowserPageAnnotationTray,
      {
        browserAnnotations,
        currentUrl,
        handleSendBrowserAnnotationsToAgent,
        browserAnnotationsSending,
        handleCopyBrowserAnnotations,
        browserAnnotationsCopied,
        handleClearBrowserAnnotations,
        handleDeleteBrowserAnnotation,
        handleUpdateBrowserAnnotation
      }
    ) : null,
    /* @__PURE__ */ jsxs39(
      DropdownMenu,
      {
        open: grab.state === "confirming" && grab.contextMenu && grabIntent === "copy" && grabReviewPayload === null,
        onOpenChange: (open) => {
          if (!open && grab.state === "confirming") {
            if (grabMenuActionTakenRef.current) {
              grabMenuActionTakenRef.current = false;
              return;
            }
            grab.rearm();
          }
        },
        children: [
          /* @__PURE__ */ jsx48(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx48(
            "button",
            {
              "aria-hidden": true,
              tabIndex: -1,
              className: "pointer-events-none absolute size-px opacity-0",
              style: (() => {
                if (!grab.payload) {
                  return { left: 0, top: 0 };
                }
                const rect = grab.payload.target.rectViewport;
                const webview = webviewRef.current;
                const webviewRect = webview?.getBoundingClientRect();
                const cRect = containerRef.current?.getBoundingClientRect();
                const offsetX = (webviewRect?.left ?? 0) - (cRect?.left ?? 0);
                const offsetY = (webviewRect?.top ?? 0) - (cRect?.top ?? 0);
                return {
                  left: offsetX + rect.x + rect.width / 2,
                  top: offsetY + rect.y + rect.height / 2
                };
              })()
            }
          ) }),
          /* @__PURE__ */ jsxs39(DropdownMenuContent, { align: "start", sideOffset: 4, children: [
            /* @__PURE__ */ jsxs39(DropdownMenuItem, { onSelect: handleGrabCopy, children: [
              /* @__PURE__ */ jsx48(Copy4, { className: "size-3.5" }),
              translate("auto.components.browser.pane.BrowserPane.c2ef0359b9", "Copy Contents"),
              /* @__PURE__ */ jsx48(DropdownMenuShortcut, { children: "C" })
            ] }),
            grab.payload?.screenshot?.dataUrl?.startsWith("data:image/png;base64,") ? /* @__PURE__ */ jsxs39(DropdownMenuItem, { onSelect: handleGrabCopyScreenshot, children: [
              /* @__PURE__ */ jsx48(Image4, { className: "size-3.5" }),
              translate("auto.components.browser.pane.BrowserPane.1ded0d3168", "Copy Screenshot"),
              /* @__PURE__ */ jsx48(DropdownMenuShortcut, { children: "S" })
            ] }) : null,
            handleGrabSendToAgent && grab.payload ? /* @__PURE__ */ jsxs39(
              DropdownMenuItem,
              {
                onSelect: () => {
                  grabMenuActionTakenRef.current = true;
                  if (grab.payload) {
                    openGrabReview(grab.payload);
                  }
                },
                children: [
                  /* @__PURE__ */ jsx48(MessageSquarePlus7, { className: "size-3.5" }),
                  translate("auto.components.browser.pane.sendToAgent.grab", "Send to agent\u2026")
                ]
              }
            ) : null,
            /* @__PURE__ */ jsx48(DropdownMenuSeparator, {}),
            /* @__PURE__ */ jsx48(
              DropdownMenuItem,
              {
                onSelect: () => {
                  grabMenuActionTakenRef.current = true;
                  grab.cancel();
                },
                children: translate("auto.components.browser.pane.BrowserPane.fa6ea61de3", "Cancel")
              }
            )
          ] })
        ]
      }
    ),
    grabToast ? /* @__PURE__ */ jsx48(
      BrowserPageGrabToast,
      {
        grabToast,
        grabToastTimerRef,
        dismissGrabToast,
        setGrabToast,
        onReviewForAgent: handleGrabSendToAgent ? openGrabReview : null
      }
    ) : null,
    grabReviewPayload && handleGrabSendToAgent ? /* @__PURE__ */ jsx48(
      GrabConfirmationSheet,
      {
        payload: grabReviewPayload,
        onCopy: () => {
          void window.browserAPI.writeClipboardText(formatGrabPayloadAsText(grabReviewPayload));
          closeGrabReview();
        },
        onCopyScreenshot: grabReviewPayload.screenshot?.dataUrl?.startsWith("data:image/png;base64,") ? () => {
          void copyGrabScreenshotToClipboard(grabReviewPayload.screenshot.dataUrl);
          closeGrabReview();
        } : null,
        onAttach: () => void handleSendGrabReview(),
        onCancel: closeGrabReview,
        busy: grabReviewSending
      }
    ) : null
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-viewport-overlays.tsx
import { Fragment as Fragment10, jsx as jsx49, jsxs as jsxs40 } from "react/jsx-runtime";
function BrowserPageViewportOverlays({
  browserZoomIndicatorState,
  browserZoomPercent,
  findOpen,
  setFindOpen,
  webviewRef,
  showFailureOverlay,
  browserTab,
  failureExternalUrl,
  failedNavigationUrl,
  onUpdatePageStateRef,
  retryGuestRecoveryRef,
  navigateToUrl,
  setResourceNotice,
  containerRef,
  browserOverlayViewport,
  scopeId,
  grab,
  markup,
  annotationSend,
  grabAnnotations,
  markupPortalContainer
}) {
  return /* @__PURE__ */ jsxs40(Fragment10, { children: [
    /* @__PURE__ */ jsx49(BrowserPageZoomIndicator, { state: browserZoomIndicatorState, percent: browserZoomPercent }),
    /* @__PURE__ */ jsx49(BrowserFind, { isOpen: findOpen, onClose: () => setFindOpen(false), webviewRef }),
    showFailureOverlay && browserTab.loadError ? /* @__PURE__ */ jsx49(
      BrowserLoadFailureOverlay,
      {
        loadError: browserTab.loadError,
        externalUrl: failureExternalUrl,
        currentUrl: toDisplayUrl(failedNavigationUrl),
        httpsRecoveryUrl: toHttpsRecoveryUrl(failedNavigationUrl),
        onRetry: () => {
          const webview = webviewRef.current;
          if (!webview) {
            return;
          }
          onUpdatePageStateRef.current(browserTab.id, { loading: true });
          if (browserTab.loadError?.code === BROWSER_GUEST_RECOVERY_ERROR_CODE) {
            retryGuestRecoveryRef.current();
            return;
          }
          retryBrowserTabLoad(webview, browserTab, onUpdatePageStateRef.current);
        },
        onTryHttps: navigateToUrl,
        onCopy: (url) => {
          void window.browserAPI.writeClipboardText(url);
          setResourceNotice(
            translate("browser.loadFailure.addressCopied", "Copied the current page address.")
          );
        },
        onOpenExternal: (url) => void window.browserAPI.openExternal({ url })
      }
    ) : null,
    /* @__PURE__ */ jsx49(
      BrowserGuestAnnotateOverlays,
      {
        grab,
        markup,
        annotationSend,
        grabAnnotations,
        containerRef,
        webviewRef,
        browserOverlayViewport,
        scopeId,
        markupPortalContainer,
        currentUrl: browserTab.url
      }
    )
  ] });
}

// src/renderer/components/browser-pane/assemble-chrome/use-browser-page-find-shortcuts.ts
import { useEffect as useEffect27 } from "react";
function useBrowserPageFindShortcuts({
  browserTabId,
  workspaceId,
  isActive,
  chromeShortcutScope,
  setFindOpen
}) {
  useEffect27(() => {
    if (chromeShortcutScope === "inactive") {
      return;
    }
    const handleKeyDown = (e) => {
      if (matchBrowserShortcutEvent(e) !== "browser.find") {
        return;
      }
      if (!browserChromeShortcutOwnsEvent(chromeShortcutScope, e, workspaceId)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setFindOpen(true);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [chromeShortcutScope, setFindOpen, workspaceId]);
  useEffect27(() => {
    if (!isActive) {
      return;
    }
    return window.browserAPI.onFindInPage(
      { browserPageId: browserTabId, browserWorkspaceId: workspaceId },
      () => {
        setFindOpen(true);
      }
    );
  }, [browserTabId, isActive, setFindOpen, workspaceId]);
  useEffect27(() => {
    if (!isActive) {
      setFindOpen(false);
    }
  }, [isActive, setFindOpen]);
}

// src/renderer/components/browser-pane/assemble-chrome/browser-page-pane.tsx
import { jsx as jsx50, jsxs as jsxs41 } from "react/jsx-runtime";
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
  const pageViewport = ensureBrowserPageViewport(browserTab.id, workspaceId);
  const pageViewportScroller = pageViewport?.scroller ?? null;
  const pageViewportContainer = pageViewport?.container ?? null;
  const containerRef = useRef21(pageViewportContainer);
  useLayoutEffect10(() => {
    containerRef.current = pageViewportContainer;
  }, [pageViewportContainer]);
  useLayoutEffect10(() => {
    const preset = getBrowserViewportPreset(browserTab.viewportPresetId ?? null);
    setBrowserPageViewportPresetSize(
      browserTab.id,
      preset ? { width: preset.width, height: preset.height } : null
    );
  }, [browserTab.id, browserTab.viewportPresetId]);
  useBrowserPageViewportScrollReporting(
    browserTab.id,
    pageViewportScroller,
    browserTab.viewportPresetId ?? null
  );
  useEffect28(() => {
    const subscribe = window.browserAPI?.onScrollPage;
    if (!subscribe || !pageViewportScroller || !browserTab.viewportPresetId) {
      return;
    }
    return subscribe((event) => {
      if (event.browserPageId !== browserTab.id) {
        return;
      }
      scrollBrowserPageViewport(browserTab.id, event.deltaX, event.deltaY);
    });
  }, [browserTab.id, browserTab.viewportPresetId, pageViewportScroller]);
  const chromeHeaderRef = useRef21(null);
  const webviewRef = useRef21(null);
  const addressBarInputRef = useRef21(null);
  const dismissAddressBarSuggestionsRef = useRef21(null);
  const addressBarValueRef = useRef21(toDisplayUrl(browserTab.url));
  const browserTabUrlRef = useRef21(browserTab.url);
  const lastKnownWebviewUrlRef = useRef21(null);
  const trackNextLoadingEventRef = useRef21(false);
  const recoveryNavigationValidationRef = useRef21(
    null
  );
  const activeLoadFailureRef = useRef21(browserTab.loadError);
  const retryGuestRecoveryRef = useRef21(() => {
  });
  const onUpdatePageStateRef = useRef21(onUpdatePageState);
  const onSetUrlRef = useRef21(onSetUrl);
  const isActiveRef = useRef21(isActive);
  useLayoutEffect10(() => {
    isActiveRef.current = isActive;
  }, [isActive]);
  const handleInternalFileDragOverRef = useRef21(() => {
  });
  const handleInternalFileDropRef = useRef21(() => {
  });
  const [findOpen, setFindOpen] = useState23(false);
  const [browserOverlayViewport, setBrowserOverlayViewport] = useState23({
    scrollX: 0,
    scrollY: 0,
    version: 0
  });
  const zoom = useBrowserPageZoomFeedback(browserTab.id);
  const { resourceNotice, setResourceNotice } = useBrowserPageResourceNotices(browserTab.id);
  const [addressBarValue, setAddressBarValue] = useState23(() => toDisplayUrl(browserTab.url));
  useEffect28(() => {
    if (document.activeElement === addressBarInputRef.current) {
      return;
    }
    setAddressBarValue(toDisplayUrl(browserTab.url));
  }, [browserTab.url]);
  useEffect28(() => {
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
  const annotationSend = useBrowserPageAnnotationSend({ browserTabId: browserTab.id, scopeId });
  const grab = useGrabMode(browserTab.id);
  const markup = useBrowserPageMarkupCapture(webviewRef, {
    url: browserTab.url,
    title: browserTab.title
  });
  const grabAnnotations = useBrowserPageGrabAnnotations({
    browserTabId: browserTab.id,
    isActive,
    grab,
    containerRef,
    trackingContainer: pageViewportContainer,
    trackingScroller: pageViewportScroller,
    webviewRef,
    setBrowserOverlayViewport,
    browserAnnotationsLength: annotationSend.browserAnnotations.length,
    setBrowserAnnotationTrayOpen: annotationSend.setBrowserAnnotationTrayOpen,
    currentUrl: getLiveBrowserUrl(browserTab.id) ?? browserTab.url
  });
  const startGrabIntentRef = useRef21(grabAnnotations.startGrabIntent);
  useLayoutEffect10(() => {
    startGrabIntentRef.current = grabAnnotations.startGrabIntent;
  }, [grabAnnotations.startGrabIntent]);
  const markupIsActive = markup.isActive;
  const grabIsInteractive = grab.state !== "idle" && grab.state !== "error";
  useEffect28(() => {
    return window.browserAPI.onGrabModeToggle((pageId, intent) => {
      if (pageId === browserTab.id && !markupIsActive) {
        startGrabIntentRef.current(intent);
      }
    });
  }, [browserTab.id, markupIsActive]);
  const handlePaneKeyDown = (event) => {
    if (!isActive || chromeShortcutScope === "inactive" || markupIsActive || !browserChromeShortcutOwnsEvent(chromeShortcutScope, event.nativeEvent, workspaceId)) {
      return;
    }
    const platform = getRendererPlatform();
    const intent = isAnnotateChord(event, platform) ? "annotate" : isGrabChord(event, platform) ? "copy" : null;
    if (intent === null) {
      return;
    }
    event.preventDefault();
    startGrabIntentRef.current(intent);
  };
  const navigateToUrl = useCallback22(
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
    cancelPendingBrowserCapture: grabAnnotations.cancelPendingBrowserCapture,
    setBrowserOverlayViewport,
    setFindOpen,
    focusAddressBarNow,
    focusWebviewNow,
    paneZoomLevelRef: zoom.paneZoomLevelRef,
    viewportPresetId: browserTab.viewportPresetId ?? null,
    setBrowserZoomPercent: zoom.setBrowserZoomPercent,
    pendingAnnotationPayload: grabAnnotations.pendingAnnotationPayload,
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
  useBrowserPageFindShortcuts({
    browserTabId: browserTab.id,
    workspaceId,
    isActive,
    chromeShortcutScope,
    setFindOpen
  });
  useBrowserPageKeyboardShortcuts({
    browserTabId: browserTab.id,
    workspaceId,
    isActive,
    chromeShortcutScope,
    isActiveRef,
    webviewRef,
    paneZoomLevelRef: zoom.paneZoomLevelRef,
    setBrowserDefaultZoomLevel: zoom.setBrowserDefaultZoomLevel,
    showBrowserZoomFeedback: zoom.showBrowserZoomFeedback,
    reloadWebviewOrRecoverGuest: reload.reloadWebviewOrRecoverGuest,
    grabIsInteractive,
    handleGrabActionShortcut: grabAnnotations.handleGrabActionShortcut
  });
  const liveBrowserUrl = getLiveBrowserUrl(browserTab.id) ?? browserTab.url;
  const isBlankTab = browserTab.url === "about:blank" || browserTab.url === ORCA_BROWSER_BLANK_URL;
  const currentBrowserUrl = toDisplayUrl(liveBrowserUrl);
  const failedNavigationUrl = browserTab.loadError?.validatedUrl ?? currentBrowserUrl;
  const failureExternalUrl = normalizeExternalBrowserUrl(failedNavigationUrl);
  const showFailureOverlay = Boolean(browserTab.loadError) && !isBlankTab;
  const browserZoomIndicatorState = getBrowserPageZoomIndicatorState({
    feedbackVisible: zoom.browserZoomFeedbackVisible,
    isDefaultZoom: zoom.browserZoomPercent === zoom.browserDefaultZoomPercent
  });
  useEffect28(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }
    webview.style.pointerEvents = inputLocked ? "none" : "auto";
  }, [inputLocked]);
  useEffect28(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }
    webview.style.display = showFailureOverlay ? "none" : "flex";
  }, [showFailureOverlay]);
  return /* @__PURE__ */ jsxs41(
    "div",
    {
      "data-browser-page-pane-id": browserTab.id,
      className: cn(
        "absolute inset-0 flex min-h-0 flex-1 flex-col",
        isActive ? "pointer-events-none z-10" : isPaintable ? "pointer-events-none z-0 opacity-0" : "pointer-events-none hidden"
      ),
      inert: !isActive,
      "aria-hidden": !isActive,
      onKeyDown: handlePaneKeyDown,
      children: [
        /* @__PURE__ */ jsx50(
          BrowserPageContextMenu,
          {
            browserPageId: browserTab.id,
            scopeId,
            canGoBack: browserTab.canGoBack,
            canGoForward: browserTab.canGoForward,
            webviewRef,
            onReload: () => reload.reloadWebviewOrRecoverGuest(false)
          }
        ),
        /* @__PURE__ */ jsx50(
          BrowserPageChromeHeader,
          {
            chromeHeaderRef,
            browserTab,
            isActive,
            webviewRef,
            addressBarInputRef,
            dismissAddressBarSuggestionsRef,
            reload,
            addressBarValue,
            setAddressBarValue,
            submitAddressBar,
            navigateToUrl,
            currentUrl: liveBrowserUrl,
            grab,
            grabAnnotations,
            annotationSend,
            isBlankTab,
            markupIsActive: markup.isActive,
            markupStart: markup.start,
            markupCancel: markup.cancel,
            resourceNotice,
            setResourceNotice
          }
        ),
        pageViewport?.container ? createPortal3(
          /* @__PURE__ */ jsx50(
            BrowserPageViewportOverlays,
            {
              browserZoomIndicatorState,
              browserZoomPercent: zoom.browserZoomPercent,
              findOpen,
              setFindOpen,
              webviewRef,
              showFailureOverlay,
              browserTab,
              failureExternalUrl,
              failedNavigationUrl,
              onUpdatePageStateRef,
              retryGuestRecoveryRef,
              navigateToUrl,
              setResourceNotice,
              containerRef,
              browserOverlayViewport,
              scopeId,
              grab,
              markup,
              annotationSend,
              grabAnnotations,
              markupPortalContainer: pageViewport?.content ?? null
            }
          ),
          pageViewport.container
        ) : null
      ]
    }
  );
}

// src/renderer/components/browser-pane/assemble-chrome/DeferredBrowserContent.tsx
import { useLayoutEffect as useLayoutEffect11, useState as useState24 } from "react";
import { Fragment as Fragment11, jsx as jsx51 } from "react/jsx-runtime";
function DeferredBrowserContent({
  mountEligible,
  retainMounted = true,
  children
}) {
  const [hasCommittedMount, setHasCommittedMount] = useState24(false);
  useLayoutEffect11(() => {
    if (!retainMounted) {
      setHasCommittedMount(false);
    } else if (mountEligible && !hasCommittedMount) {
      setHasCommittedMount(true);
    }
  }, [hasCommittedMount, mountEligible, retainMounted]);
  return mountEligible || retainMounted && hasCommittedMount ? /* @__PURE__ */ jsx51(Fragment11, { children }) : null;
}

// src/renderer/components/browser-pane/assemble-chrome/browser-workspace-pane.tsx
import { jsx as jsx52, jsxs as jsxs42 } from "react/jsx-runtime";
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
  const browserPageIds = useMemo9(() => browserPages.map((page) => page.id), [browserPages]);
  const hasAdmittedPage = useAnyBrowserPageMountAdmission(browserPageIds);
  return /* @__PURE__ */ jsxs42("div", { className: "relative flex h-full min-h-0 flex-1 flex-col", children: [
    browserPages.length >= 2 ? /* @__PURE__ */ jsx52(
      BrowserPageStrip,
      {
        pages: browserPages,
        activePageId: activeBrowserPage?.id ?? null,
        onSelect: (pageId) => setActiveBrowserPage(scopeId, pageId),
        onClose: closeBrowserPage
      }
    ) : null,
    /* @__PURE__ */ jsx52("div", { className: "relative flex min-h-0 flex-1", children: browserPages.map((page) => /* @__PURE__ */ jsx52(
      DeferredBrowserContent,
      {
        retainMounted: isActive,
        mountEligible: isBrowserPagePanePaintable({
          isActive: isActive && page.id === activeBrowserPage?.id || hasAdmittedPage && isBrowserPageMountAdmitted(page.id)
        }),
        children: /* @__PURE__ */ jsx52(
          BrowserPagePane,
          {
            browserTab: page,
            workspaceId: scopeId,
            scopeId,
            sessionProfileId: page.sessionProfileId,
            sessionPartition: page.sessionPartition,
            isActive: isActive && page.id === activeBrowserPage?.id,
            chromeShortcutScope: isActive && page.id === activeBrowserPage?.id ? "owned-target" : "inactive",
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
import { Fragment as Fragment12, jsx as jsx53, jsxs as jsxs43 } from "react/jsx-runtime";
var BrowserOverlaySlot = memo(function BrowserOverlaySlot2({
  scopeId
}) {
  const isActive = useBrowserStore((state) => state.paneMountByScope[scopeId]?.active === true);
  const setSlotViewportRef = useCallback23(
    (node) => {
      registerBrowserOverlaySlotViewport(scopeId, node);
    },
    [scopeId]
  );
  const anchorName = browserScopeAnchorName(scopeId);
  const style = useMemo10(
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
  return /* @__PURE__ */ jsxs43(
    "div",
    {
      style,
      className: "min-h-0 flex-col",
      "data-orca-browser-scope-slot": scopeId,
      "data-orca-browser-anchor": anchorName,
      "data-browser-overlay-tab-id": scopeId,
      children: [
        /* @__PURE__ */ jsx53("div", { ref: setSlotViewportRef, className: "absolute inset-0 flex min-h-0 flex-col" }),
        /* @__PURE__ */ jsx53(DeferredBrowserContent, { mountEligible: isActive, children: /* @__PURE__ */ jsx53(browser_workspace_pane_default, { scopeId, isActive }) })
      ]
    }
  );
});
var BrowserPaneOverlayLayer = memo(function BrowserPaneOverlayLayer2() {
  const scopeIds = useBrowserStore(useShallow((state) => Object.keys(state.pagesByScope)));
  return /* @__PURE__ */ jsx53(Fragment12, { children: scopeIds.map((scopeId) => /* @__PURE__ */ jsx53(BrowserOverlaySlot, { scopeId }, scopeId)) });
});

// src/renderer/ipc/browser-state-ipc-bridge.ts
import { useEffect as useEffect29 } from "react";
function useBrowserStateIpcBridge() {
  useEffect29(() => {
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
  useEffect29(() => {
    const api = window.browserAPI;
    if (!api) {
      return;
    }
    return api.onGuestLoadFailed(({ browserPageId, loadError }) => {
      useBrowserStore.getState().updateBrowserPageState(browserPageId, {
        loading: false,
        loadError,
        canGoBack: false,
        canGoForward: false
      });
    });
  }, []);
  useEffect29(() => {
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
import { jsx as jsx54, jsxs as jsxs44 } from "react/jsx-runtime";
function BrowserPluginProvider(props) {
  const { host, children } = props;
  setBrowserRendererHost(host);
  useEffect30(() => {
    setBrowserRendererHost(host);
    return () => clearBrowserRendererHost(host);
  }, [host]);
  useBrowserStateIpcBridge();
  const hasBrowserApi = typeof window !== "undefined" && window.browserAPI !== void 0;
  useEffect30(() => {
    if (!hasBrowserApi) {
      return;
    }
    const state = useBrowserSessionStore.getState();
    void state.loadSettings();
    void state.fetchBrowserSessionProfiles();
    void state.loadIdentity();
  }, [hasBrowserApi]);
  return /* @__PURE__ */ jsxs44(BrowserRendererHostContext.Provider, { value: host, children: [
    children,
    hasBrowserApi ? /* @__PURE__ */ jsx54(BrowserPaneOverlayLayer, {}) : null
  ] });
}
export {
  BrowserPane,
  BrowserPluginProvider,
  BrowserSettingsPanel,
  useBrowserRendererHost
};
