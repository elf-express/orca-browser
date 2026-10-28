"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main/index.ts
var main_exports = {};
__export(main_exports, {
  installBrowserPlugin: () => installBrowserPlugin
});
module.exports = __toCommonJS(main_exports);

// src/shared/constants.ts
var DEFAULT_MCP_PORT = 47821;
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

// src/main/browser/browser-guest-renderer-target.ts
var import_electron = require("electron");
function resolveRendererWebContents(rendererWebContentsIdByTabId, browserTabId) {
  const rendererWcId = rendererWebContentsIdByTabId.get(browserTabId);
  if (!rendererWcId) {
    return null;
  }
  const renderer = import_electron.webContents.fromId(rendererWcId);
  if (!renderer || renderer.isDestroyed()) {
    return null;
  }
  return renderer;
}

// src/main/browser/browser-guest-context-menu.ts
var import_electron2 = require("electron");

// src/main/browser/browser-guest-navigation-state.ts
function readGuestNavigationState(guest) {
  return {
    canGoBack: guest.navigationHistory.canGoBack(),
    canGoForward: guest.navigationHistory.canGoForward()
  };
}

// src/main/browser/browser-guest-context-menu.ts
function setupGuestContextMenu(args) {
  const { browserTabId, guest, resolveRenderer } = args;
  const handler = (_event, params) => {
    const renderer = resolveRenderer(browserTabId);
    if (!renderer) {
      return;
    }
    const pageUrl = redactKagiSessionToken(guest.getURL());
    const rawLinkUrl = params.linkURL || "";
    const linkUrl = rawLinkUrl.length > 0 ? normalizeExternalBrowserUrl(rawLinkUrl) ?? normalizeBrowserNavigationUrl(rawLinkUrl) : null;
    const cursor = import_electron2.screen.getCursorScreenPoint();
    const navigationState = readGuestNavigationState(guest);
    renderer.send("browser:context-menu-requested", {
      browserPageId: browserTabId,
      x: params.x,
      y: params.y,
      screenX: cursor.x,
      screenY: cursor.y,
      pageUrl,
      linkUrl,
      // Why: forward the native selection so the renderer can Copy it directly, bypassing pages that suppress copy via oncopy handlers.
      selectionText: params.selectionText ?? "",
      ...navigationState
    });
  };
  let dismissHandler = null;
  const removeDismissListener = () => {
    if (dismissHandler) {
      try {
        guest.off("before-mouse-event", dismissHandler);
      } catch {
      }
      dismissHandler = null;
    }
  };
  const contextMenuHandler = (_event, params) => {
    handler(_event, params);
    removeDismissListener();
    dismissHandler = (_evt, mouse) => {
      if (mouse.type !== "mouseDown") {
        return;
      }
      if (mouse.button === "right") {
        return;
      }
      const renderer = resolveRenderer(browserTabId);
      if (renderer) {
        renderer.send("browser:context-menu-dismissed", { browserPageId: browserTabId });
      }
      removeDismissListener();
    };
    guest.on("before-mouse-event", dismissHandler);
  };
  guest.on("context-menu", contextMenuHandler);
  return () => {
    try {
      guest.off("context-menu", contextMenuHandler);
      removeDismissListener();
    } catch {
    }
  };
}

// src/main/browser/browser-guest-wheel-zoom.ts
var CONTROL_MODIFIERS = /* @__PURE__ */ new Set(["control", "ctrl"]);
var MAC_COMMAND_MODIFIERS = /* @__PURE__ */ new Set(["meta", "command", "cmd"]);
var WHEEL_ZOOM_BLOCKING_MODIFIERS = /* @__PURE__ */ new Set(["alt", "shift"]);
var GUEST_WHEEL_ZOOM_DEDUPE_MS = 250;
var recentGuestWheelZoomByGuest = /* @__PURE__ */ new WeakMap();
function markGuestWheelZoom(guest, direction) {
  recentGuestWheelZoomByGuest.set(guest, { direction, at: Date.now() });
}
function consumeRecentGuestWheelZoom(guest, direction) {
  const recent = recentGuestWheelZoomByGuest.get(guest);
  if (!recent) {
    return false;
  }
  const elapsed = Date.now() - recent.at;
  if (elapsed < 0 || elapsed > GUEST_WHEEL_ZOOM_DEDUPE_MS) {
    recentGuestWheelZoomByGuest.delete(guest);
    return false;
  }
  if (recent.direction !== direction) {
    return false;
  }
  recentGuestWheelZoomByGuest.delete(guest);
  return true;
}
function hasModifier(mouse, modifiers) {
  return mouse.modifiers?.some((modifier) => modifiers.has(modifier)) ?? false;
}
function resolveGuestMouseWheelZoomDirection(mouse, platform = process.platform) {
  if (mouse.type !== "mouseWheel") {
    return null;
  }
  if (hasModifier(mouse, WHEEL_ZOOM_BLOCKING_MODIFIERS)) {
    return null;
  }
  const hasZoomModifier = hasModifier(mouse, CONTROL_MODIFIERS) || platform === "darwin" && hasModifier(mouse, MAC_COMMAND_MODIFIERS);
  if (!hasZoomModifier) {
    return null;
  }
  const deltaY = mouse.deltaY;
  if (typeof deltaY !== "number" || deltaY === 0) {
    return null;
  }
  return deltaY < 0 ? "in" : "out";
}
function setupGuestMouseWheelZoomForwarding(args) {
  const { browserTabId, guest, resolveRenderer } = args;
  const handler = (event, mouse) => {
    const direction = resolveGuestMouseWheelZoomDirection(mouse);
    if (direction) {
      event.preventDefault();
      markGuestWheelZoom(guest, direction);
      resolveRenderer(browserTabId)?.send("browser:zoomPage", {
        browserPageId: browserTabId,
        direction
      });
    }
  };
  guest.on("before-mouse-event", handler);
  return () => {
    try {
      guest.off("before-mouse-event", handler);
    } catch {
    }
  };
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

// src/main/browser/browser-guest-shortcut-dispatch.ts
function forwardGuestShortcutInput(ctx, event, input) {
  const { browserTabId, resolveRenderer, forwardBrowserPageZoom } = ctx;
  const action = matchBrowserShortcut(input, process.platform);
  if (action === "zoom.in" || action === "zoom.out" || action === "zoom.reset") {
    forwardBrowserPageZoom(
      event,
      action === "zoom.in" ? "in" : action === "zoom.out" ? "out" : "reset"
    );
    return true;
  }
  if (input.isAutoRepeat) {
    return false;
  }
  const renderer = resolveRenderer(browserTabId);
  if (!renderer) {
    return false;
  }
  if (action === "browser.focusAddressBar") {
    renderer.send("browser:focusAddressBar", { browserPageId: browserTabId });
  } else if (action === "browser.hardReload") {
    renderer.send("browser:hardReloadPage", { browserPageId: browserTabId });
  } else if (action === "browser.reload") {
    renderer.send("browser:reloadPage", { browserPageId: browserTabId });
  } else if (action === "browser.find") {
    const target = { browserPageId: browserTabId };
    renderer.send("browser:findInPage", target);
  } else if (action === "browser.back") {
    renderer.send("browser:historyNavigate", { browserPageId: browserTabId, direction: "back" });
  } else if (action === "browser.forward") {
    renderer.send("browser:historyNavigate", {
      browserPageId: browserTabId,
      direction: "forward"
    });
  } else {
    return false;
  }
  event.preventDefault();
  return true;
}

// src/main/browser/browser-guest-shortcut-forwarding.ts
function setupGuestShortcutForwarding(args) {
  const { browserTabId, guest, resolveRenderer } = args;
  const forwardBrowserPageZoom = (event, direction) => {
    event.preventDefault();
    const renderer = resolveRenderer(browserTabId);
    renderer?.send("browser:zoomPage", { browserPageId: browserTabId, direction });
  };
  const forwardContext = {
    browserTabId,
    resolveRenderer,
    forwardBrowserPageZoom
  };
  const handler = (event, input) => {
    if (input.type !== "keyDown") {
      return;
    }
    forwardGuestShortcutInput(forwardContext, event, input);
  };
  const zoomCommandHandler = (event, zoomDirection) => {
    if (zoomDirection !== "in" && zoomDirection !== "out") {
      return;
    }
    if (consumeRecentGuestWheelZoom(guest, zoomDirection)) {
      event.preventDefault();
      return;
    }
    forwardBrowserPageZoom(event, zoomDirection);
  };
  guest.on("before-input-event", handler);
  guest.on("zoom-changed", zoomCommandHandler);
  return () => {
    try {
      guest.off("before-input-event", handler);
      guest.off("zoom-changed", zoomCommandHandler);
    } catch {
    }
  };
}

// src/main/browser/browser-manager-grab.ts
var import_electron8 = require("electron");

// src/main/browser/browser-manager-viewport.ts
var import_electron7 = require("electron");

// src/main/browser/browser-manager-types.ts
function isChromiumInternalErrorUrl(url) {
  return url.startsWith("chrome-error://");
}
var SAFE_POPUP_WINDOW_OPTIONS = {
  alwaysOnTop: false,
  closable: true,
  focusable: true,
  frame: true,
  fullscreen: false,
  kiosk: false,
  modal: false,
  movable: true,
  opacity: 1,
  show: true,
  simpleFullscreen: false,
  skipTaskbar: false,
  titleBarStyle: "default",
  transparent: false,
  // Why: Electron applies these before createWindow; feature strings/opener inheritance must not relax the child's isolation.
  webPreferences: {
    allowRunningInsecureContent: false,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webviewTag: false
  }
};
function safeOrigin(rawUrl) {
  const external = normalizeExternalBrowserUrl(rawUrl);
  const urlToParse = external ?? rawUrl;
  try {
    return new URL(urlToParse).origin;
  } catch {
    return external ?? "unknown";
  }
}

// src/main/browser/browser-manager-registration.ts
var import_electron6 = require("electron");

// src/main/plugin-runtime.ts
var current = null;
function setResolvedBrowserPluginOptions(options) {
  current = options;
}
function isBrowserPluginInstalled() {
  return current !== null;
}
function getResolvedBrowserPluginOptions() {
  if (!current) {
    throw new Error("orca-browser: plugin is not installed");
  }
  return current;
}
function getBrowserHost() {
  return getResolvedBrowserPluginOptions().host;
}

// src/main/browser/browser-guest-input-gesture.ts
var ACTIVATING_INPUT_TYPES = /* @__PURE__ */ new Set([
  "mouseDown",
  "mouseUp",
  "keyDown",
  "rawKeyDown",
  "char",
  "touchStart",
  "touchEnd",
  "gestureTap",
  "pointerDown",
  "pointerUp"
]);
var BROWSER_GUEST_INPUT_GESTURE_WINDOW_MS = 1e3;
function trackBrowserGuestInputGesture(guest, now = () => Date.now()) {
  let lastGestureAt = null;
  const onInputEvent = (_event, input) => {
    if (typeof input?.type === "string" && ACTIVATING_INPUT_TYPES.has(input.type)) {
      lastGestureAt = now();
    }
  };
  let attached = false;
  try {
    guest.on("input-event", onInputEvent);
    attached = true;
  } catch {
  }
  return {
    consume: () => {
      const observedAt = lastGestureAt;
      lastGestureAt = null;
      return attached && observedAt !== null && now() - observedAt <= BROWSER_GUEST_INPUT_GESTURE_WINDOW_MS;
    },
    dispose: () => {
      lastGestureAt = null;
      if (!attached) {
        return;
      }
      attached = false;
      try {
        guest.off("input-event", onInputEvent);
      } catch {
      }
    }
  };
}

// src/main/browser/browser-popup-new-tab-intent.ts
function isNewBrowserTabPopupIntent(details) {
  return details.frameName === "" && (details.disposition === "foreground-tab" || details.disposition === "background-tab");
}

// src/main/browser/popup-origin-bar-window.ts
var import_electron3 = require("electron");
var POPUP_ORIGIN_BAR_HEIGHT = 34;
var DEFAULT_POPUP_CONTENT_WIDTH = 800;
var DEFAULT_POPUP_CONTENT_HEIGHT = 600;
var MIN_POPUP_CONTENT_WIDTH = 360;
var MIN_POPUP_CONTENT_HEIGHT = 200;
function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "[::1]";
}
function describePopupOrigin(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.origin !== "null") {
      return {
        label: parsed.origin,
        insecure: parsed.protocol === "http:" && !isLoopbackHost(parsed.hostname)
      };
    }
    if (parsed.protocol === "about:") {
      return { label: "about:blank", insecure: false };
    }
    return { label: parsed.protocol, insecure: false };
  } catch {
    return { label: "unknown", insecure: true };
  }
}
var ORIGIN_BAR_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; height: 100vh; box-sizing: border-box; padding: 0 10px;
    display: flex; align-items: center; gap: 8px;
    overflow: hidden; white-space: nowrap;
    -webkit-user-select: none; user-select: none; cursor: default;
    font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: #fff; color: #0a0a0a; border-bottom: 1px solid #e5e5e5;
  }
  #insecure { display: none; color: #e40014; font-weight: 600; }
  body.insecure #insecure { display: inline; }
  /* Elide the START of long origins so the registrable domain stays visible
     (Chrome elides the same side): rtl container puts clip+ellipsis on the
     left; the bdi keeps the ASCII origin itself rendering LTR. */
  #origin-clip { overflow: hidden; text-overflow: ellipsis; direction: rtl; }
  #origin { unicode-bidi: isolate; direction: ltr; }
  @media (prefers-color-scheme: dark) {
    body { background: #0a0a0a; color: #fafafa; border-bottom-color: rgb(255 255 255 / 0.07); }
    #insecure { color: #ff6568; }
  }
</style></head><body><span id="insecure">Not secure</span><span id="origin-clip"><bdi id="origin"></bdi></span></body></html>`;
function clampPopupContentSize(options) {
  return {
    width: Math.max(MIN_POPUP_CONTENT_WIDTH, options.width ?? DEFAULT_POPUP_CONTENT_WIDTH),
    height: Math.max(MIN_POPUP_CONTENT_HEIGHT, options.height ?? DEFAULT_POPUP_CONTENT_HEIGHT)
  };
}
function closeUnpreparedPopup(window, contentWebContents, originBarWebContents) {
  const closedListeners = [];
  let closed = false;
  window.once("closed", () => {
    closed = true;
    for (const listener of closedListeners.splice(0)) {
      listener();
    }
  });
  if (!contentWebContents.isDestroyed()) {
    contentWebContents.close();
  }
  if (!originBarWebContents.isDestroyed()) {
    originBarWebContents.close();
  }
  if (!window.isDestroyed()) {
    window.close();
  }
  return {
    contentWebContents,
    close: () => {
      if (!window.isDestroyed()) {
        window.close();
      }
    },
    onClosed: (listener) => {
      if (closed) {
        listener();
        return;
      }
      closedListeners.push(listener);
    }
  };
}
function openPopupWithOriginBar(options, initialUrl, prepareContent) {
  const { width, height } = clampPopupContentSize(options);
  const initialOrigin = describePopupOrigin(initialUrl);
  const window = new import_electron3.BaseWindow({
    width,
    height: height + POPUP_ORIGIN_BAR_HEIGHT,
    // Why: window.open features request a content size; without this the
    // native frame eats into the popup's viewport.
    useContentSize: true,
    ...typeof options.x === "number" && typeof options.y === "number" ? { x: options.x, y: options.y } : {},
    minWidth: MIN_POPUP_CONTENT_WIDTH,
    minHeight: MIN_POPUP_CONTENT_HEIGHT + POPUP_ORIGIN_BAR_HEIGHT,
    title: initialOrigin.label
  });
  const originBarView = new import_electron3.WebContentsView({
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const originBarWebContents = originBarView.webContents;
  const contentView = new import_electron3.WebContentsView({
    // Why: Electron rejects an explicitly undefined webContents; omitting it
    // lets WebContentsView create contents for Cmd/Ctrl-click popups.
    ...options.webContents === void 0 ? {} : { webContents: options.webContents },
    webPreferences: options.webPreferences
  });
  window.contentView.addChildView(contentView);
  window.contentView.addChildView(originBarView);
  const layoutViews = () => {
    const bounds = window.getContentBounds();
    originBarView.setBounds({ x: 0, y: 0, width: bounds.width, height: POPUP_ORIGIN_BAR_HEIGHT });
    contentView.setBounds({
      x: 0,
      y: POPUP_ORIGIN_BAR_HEIGHT,
      width: bounds.width,
      height: Math.max(0, bounds.height - POPUP_ORIGIN_BAR_HEIGHT)
    });
  };
  window.on("resize", layoutViews);
  window.on("enter-full-screen", layoutViews);
  window.on("leave-full-screen", layoutViews);
  layoutViews();
  const contentWebContents = contentView.webContents;
  if (prepareContent && !prepareContent(contentWebContents)) {
    return closeUnpreparedPopup(window, contentWebContents, originBarWebContents);
  }
  let currentUrl = initialUrl;
  const renderOrigin = () => {
    const { label, insecure } = describePopupOrigin(currentUrl);
    if (!window.isDestroyed()) {
      window.setTitle(label);
    }
    void originBarWebContents.executeJavaScript(
      `document.body.classList.toggle('insecure', ${insecure ? "true" : "false"});document.getElementById('origin').textContent = ${JSON.stringify(label)};`
    ).catch(() => {
    });
  };
  originBarWebContents.once("did-finish-load", renderOrigin);
  void originBarWebContents.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(ORIGIN_BAR_HTML)}`
  );
  const handleDidNavigate = (_event, url) => {
    currentUrl = url;
    renderOrigin();
  };
  contentWebContents.on("did-navigate", handleDidNavigate);
  contentWebContents.on("did-finish-load", renderOrigin);
  const handlePageTitleUpdated = (_event, title) => {
    if (!window.isDestroyed() && title) {
      window.setTitle(title);
    }
  };
  contentWebContents.on("page-title-updated", handlePageTitleUpdated);
  if (!options.webContents) {
    void contentWebContents.loadURL(initialUrl).catch(() => {
    });
  }
  const closedListeners = [];
  const handleContentDestroyed = () => {
    if (!window.isDestroyed()) {
      window.close();
    }
  };
  contentWebContents.once("destroyed", handleContentDestroyed);
  window.once("closed", () => {
    if (!contentWebContents.isDestroyed()) {
      contentWebContents.off("destroyed", handleContentDestroyed);
      contentWebContents.off("did-navigate", handleDidNavigate);
      contentWebContents.off("did-finish-load", renderOrigin);
      contentWebContents.off("page-title-updated", handlePageTitleUpdated);
      contentWebContents.close();
    }
    if (!originBarWebContents.isDestroyed()) {
      originBarWebContents.close();
    }
    for (const listener of closedListeners) {
      listener();
    }
  });
  return {
    contentWebContents,
    close: () => {
      if (!window.isDestroyed()) {
        window.close();
      }
    },
    onClosed: (listener) => {
      closedListeners.push(listener);
    }
  };
}

// src/main/browser/browser-process-user-agent.ts
var import_electron4 = require("electron");
var identity = null;
function getBrowserProcessUserAgentIdentity() {
  if (!identity) {
    throw new Error("Browser process user agent is not initialized");
  }
  return identity;
}

// src/main/browser/browser-google-auth-ua.ts
var GOOGLE_AUTH_HOSTS = /* @__PURE__ */ new Set(["accounts.google.com", "accounts.youtube.com"]);
function isGoogleAuthUrl(rawUrl) {
  try {
    return GOOGLE_AUTH_HOSTS.has(new URL(rawUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}
function googleAuthUserAgent() {
  const platform = process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10.15" : process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : "X11; Linux x86_64";
  return `Mozilla/5.0 (${platform}; rv:140.0) Gecko/20100101 Firefox/140.0`;
}

// src/main/browser/browser-tab-identity.ts
function googleAuthTabIdentity() {
  return { kind: "google-auth", userAgent: googleAuthUserAgent() };
}
function resolveBrowserTabIdentity(args) {
  if (args.processIdentity.mode === "clean" && isGoogleAuthUrl(args.url)) {
    return googleAuthTabIdentity();
  }
  if (args.mobile) {
    return buildMobileTabIdentity(args.processIdentity.userAgent);
  }
  return { kind: "process", userAgent: args.processIdentity.userAgent };
}
function buildMobileUserAgent(chromeMajor) {
  return `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${chromeMajor}.0.0.0 Mobile/15E148 Safari/604.1`;
}
function extractChromeMajor(ua) {
  const match = ua.match(/Chrome\/(\d+)/);
  return match ? match[1] : "134";
}
function buildMobileTabIdentity(processUserAgent) {
  const chromeMajor = extractChromeMajor(processUserAgent);
  return {
    kind: "mobile",
    userAgent: buildMobileUserAgent(chromeMajor),
    userAgentMetadata: {
      brands: [
        { brand: "Google Chrome", version: chromeMajor },
        { brand: "Chromium", version: chromeMajor },
        { brand: "Not/A)Brand", version: "24" }
      ],
      fullVersionList: [
        { brand: "Google Chrome", version: `${chromeMajor}.0.0.0` },
        { brand: "Chromium", version: `${chromeMajor}.0.0.0` },
        { brand: "Not/A)Brand", version: "24.0.0.0" }
      ],
      fullVersion: `${chromeMajor}.0.0.0`,
      platform: "iOS",
      platformVersion: "17.0",
      architecture: "",
      model: "iPhone",
      mobile: true
    }
  };
}

// src/main/window/renderer-publication-throttle.ts
var REHIDE_CAPTURE_RECT = { x: 0, y: 0, width: 0, height: 0 };
var RendererPublicationThrottle = class {
  leasesByTarget = /* @__PURE__ */ new Map();
  acquire(target) {
    const leaseCount = this.leasesByTarget.get(target) ?? 0;
    if (leaseCount === 0) {
      target.setBackgroundThrottling(false);
    }
    this.leasesByTarget.set(target, leaseCount + 1);
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const remaining = (this.leasesByTarget.get(target) ?? 1) - 1;
      if (remaining > 0) {
        this.leasesByTarget.set(target, remaining);
        return;
      }
      this.leasesByTarget.delete(target);
      if (target.isDestroyed?.() !== true) {
        target.setBackgroundThrottling(true);
        if (target.isFocused?.() !== true) {
          target.capturePage(REHIDE_CAPTURE_RECT, { stayHidden: true }).catch(() => {
          });
        }
      }
    };
  }
};
var rendererPublicationThrottle = new RendererPublicationThrottle();

// src/main/browser/browser-page-initiated-tab-budget.ts
var MAX_PAGE_INITIATED_TABS_PER_WINDOW = 4;
var PAGE_INITIATED_TAB_WINDOW_MS = 2e3;
function createPageInitiatedTabBudget(maxPerWindow = MAX_PAGE_INITIATED_TABS_PER_WINDOW, windowMs = PAGE_INITIATED_TAB_WINDOW_MS) {
  let grants = [];
  return {
    tryConsume: (now) => {
      grants = grants.filter((grantedAt) => now - grantedAt < windowMs);
      if (grants.length >= maxPerWindow) {
        return false;
      }
      grants.push(now);
      return true;
    }
  };
}

// src/main/browser/browser-manager-viewport-scroll-state.ts
var import_electron5 = require("electron");
var BrowserManagerViewportScrollState = class {
  rendererWebContentsIdByTabId = /* @__PURE__ */ new Map();
  // Why both: host-side wheel panning follows the requested preset, while the tab's identity follows
  // the one Chromium actually applied. Replacement guests must not inherit a retired guest's preset.
  viewportPresetByTabId = /* @__PURE__ */ new Map();
  viewportScrollStateByTabId = /* @__PURE__ */ new Map();
  setViewportScrollState(browserTabId, rendererWebContentsId, state) {
    if (this.rendererWebContentsIdByTabId.get(browserTabId) !== rendererWebContentsId) {
      return;
    }
    if (![state.scrollLeft, state.scrollTop, state.maxScrollLeft, state.maxScrollTop].every(
      (value) => typeof value === "number" && Number.isFinite(value) && value >= 0
    )) {
      return;
    }
    this.viewportScrollStateByTabId.set(browserTabId, state);
  }
  recordViewportScrollDelta(browserTabId, deltaX, deltaY) {
    const state = this.viewportScrollStateByTabId.get(browserTabId);
    if (!state) {
      return;
    }
    this.viewportScrollStateByTabId.set(browserTabId, {
      ...state,
      scrollLeft: Math.min(state.maxScrollLeft, Math.max(0, state.scrollLeft + deltaX)),
      scrollTop: Math.min(state.maxScrollTop, Math.max(0, state.scrollTop + deltaY))
    });
  }
  canViewportScroll(browserTabId, mouse) {
    const state = this.viewportScrollStateByTabId.get(browserTabId);
    if (!state) {
      return false;
    }
    const deltaX = typeof mouse.deltaX === "number" ? mouse.deltaX : 0;
    const deltaY = typeof mouse.deltaY === "number" ? mouse.deltaY : 0;
    const canScrollAxis = (delta, position, maximum) => {
      if (delta < 0) {
        return position > 0;
      }
      if (delta > 0) {
        return position < maximum;
      }
      return false;
    };
    return canScrollAxis(deltaX, state.scrollLeft, state.maxScrollLeft) || canScrollAxis(deltaY, state.scrollTop, state.maxScrollTop);
  }
  recordAppliedViewportOverride(browserTabId, guestWebContentsId, applied) {
    const preset = this.viewportPresetByTabId.get(browserTabId);
    if (preset?.guestWebContentsId === guestWebContentsId) {
      this.viewportPresetByTabId.set(browserTabId, { ...preset, applied });
    }
  }
  resolveRendererForBrowserTab(browserTabId) {
    const rendererWebContentsId = this.rendererWebContentsIdByTabId.get(browserTabId);
    if (!rendererWebContentsId) {
      return null;
    }
    const renderer = import_electron5.webContents.fromId(rendererWebContentsId);
    if (!renderer || renderer.isDestroyed()) {
      return null;
    }
    return renderer;
  }
};

// src/main/browser/browser-manager-state.ts
var BrowserManagerState = class extends BrowserManagerViewportScrollState {
  webContentsIdByTabId = /* @__PURE__ */ new Map();
  // Why: reverse map gives O(1) guest→tab lookups on every mouse/load/permission/popup event.
  tabIdByWebContentsId = /* @__PURE__ */ new Map();
  popupOwnerContextByGuestId = /* @__PURE__ */ new Map();
  // Why: keyed by the opener tree's root so named child popups can't each mint a fresh tab quota.
  pageInitiatedTabBudgetByRootGuestId = /* @__PURE__ */ new Map();
  sessionProfileIdByPageId = /* @__PURE__ */ new Map();
  // Why: serialize per-tab setViewportOverride so rapid toggles don't interleave CDP commands and leave emulation in a wrong state.
  viewportOpsByTabId = /* @__PURE__ */ new Map();
  // Why: the confirmed CDP identity outranks getUserAgent; pending intent keeps rapid navigations
  // ordered without claiming a failed write was installed.
  cdpUserAgentOverrideStateByGuestId = /* @__PURE__ */ new Map();
  // Why: the in-flight main-frame navigation target, held only until commit or failure — getURL()
  // still reports the outgoing page until then. See resolveTabNavigationUrl.
  pendingNavigationByGuestId = /* @__PURE__ */ new Map();
  contextMenuCleanupByTabId = /* @__PURE__ */ new Map();
  grabShortcutCleanupByTabId = /* @__PURE__ */ new Map();
  shortcutForwardingCleanupByTabId = /* @__PURE__ */ new Map();
  mouseWheelZoomCleanupByTabId = /* @__PURE__ */ new Map();
  annotationViewportBridgeOpsByTabId = /* @__PURE__ */ new Map();
  scopeIdByTabId = /* @__PURE__ */ new Map();
  policyAttachedGuestIds = /* @__PURE__ */ new Set();
  policyCleanupByGuestId = /* @__PURE__ */ new Map();
  loadErrorsByGuestId = /* @__PURE__ */ new Map();
  // Why: did-start-navigation hides the overlay optimistically; stash the cleared error so did-fail-load(-3) can restore an aborted nav.
  clearedLoadErrorsByGuestId = /* @__PURE__ */ new Map();
  browserGuestStateChangedListener = null;
  pendingLoadFailuresByGuestId = /* @__PURE__ */ new Map();
  pendingPermissionEventsByGuestId = /* @__PURE__ */ new Map();
  pendingPopupEventsByGuestId = /* @__PURE__ */ new Map();
  setBrowserGuestStateChangedListener(listener) {
    this.browserGuestStateChangedListener = listener;
  }
  // Why: a debugger detach clears every CDP override Chromium holds, including the UA override and
  // device metrics, so both records must be dropped or navigation believes they still stand.
  trackDebuggerDetachForCdpOverrides(guest) {
    const onDetach = () => {
      this.cdpUserAgentOverrideStateByGuestId.delete(guest.id);
      const browserTabId = this.tabIdByWebContentsId.get(guest.id);
      if (browserTabId) {
        this.recordAppliedViewportOverride(browserTabId, guest.id, null);
      }
    };
    try {
      guest.debugger.on("detach", onDetach);
    } catch {
    }
    return () => {
      try {
        guest.debugger.off("detach", onDetach);
      } catch {
      }
    };
  }
  resolveBrowserTabIdForGuestWebContentsId(guestWebContentsId) {
    return this.resolvePopupOwnerContext(guestWebContentsId)?.browserTabId ?? null;
  }
  resolvePopupOwnerContext(guestWebContentsId) {
    const browserTabId = this.tabIdByWebContentsId.get(guestWebContentsId);
    if (browserTabId) {
      return { browserTabId, rootGuestWebContentsId: guestWebContentsId };
    }
    const inherited = this.popupOwnerContextByGuestId.get(guestWebContentsId);
    if (inherited && this.webContentsIdByTabId.get(inherited.browserTabId) === inherited.rootGuestWebContentsId) {
      return inherited;
    }
    this.popupOwnerContextByGuestId.delete(guestWebContentsId);
    return null;
  }
  /** Shared across the whole opener tree, so a chain of popups draws from one budget. */
  tryConsumePageInitiatedTab(rootGuestWebContentsId) {
    let budget = this.pageInitiatedTabBudgetByRootGuestId.get(rootGuestWebContentsId);
    if (!budget) {
      budget = createPageInitiatedTabBudget();
      this.pageInitiatedTabBudgetByRootGuestId.set(rootGuestWebContentsId, budget);
    }
    return budget.tryConsume(Date.now());
  }
};

// src/main/browser/browser-manager-visibility.ts
var BrowserManagerVisibility = class extends BrowserManagerState {
  // Why: page id -> active capture count; the renderer hears only the first hold and the last release.
  capturePaintHolds = /* @__PURE__ */ new Map();
  // Why: only pixel capture needs a drawn guest. One-way so a minimized or throttled desktop renderer
  // can't stall the capture; the capture itself retries until the page produces a frame.
  holdPaintForCapture(guestWebContentsId) {
    const browserPageId = this.resolveBrowserTabIdForGuestWebContentsId(guestWebContentsId);
    const renderer = browserPageId ? this.resolveRendererForBrowserTab(browserPageId) : null;
    if (!browserPageId || !renderer || renderer.isDestroyed()) {
      return () => {
      };
    }
    const holds = this.capturePaintHolds.get(browserPageId) ?? 0;
    this.capturePaintHolds.set(browserPageId, holds + 1);
    if (holds === 0) {
      renderer.send("browser:capturePaintHold", { browserPageId, held: true });
    }
    const releaseThrottle = rendererPublicationThrottle.acquire(renderer);
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      releaseThrottle();
      const remaining = (this.capturePaintHolds.get(browserPageId) ?? 1) - 1;
      if (remaining > 0) {
        this.capturePaintHolds.set(browserPageId, remaining);
        return;
      }
      this.capturePaintHolds.delete(browserPageId);
      if (!renderer.isDestroyed()) {
        renderer.send("browser:capturePaintHold", { browserPageId, held: false });
      }
    };
  }
};

// src/main/browser/browser-manager-navigation.ts
var BrowserManagerNavigation = class extends BrowserManagerVisibility {
  resolveBrowserGuestRequestUserAgent(request) {
    const processIdentity = getBrowserProcessUserAgentIdentity();
    const googleAuth = googleAuthTabIdentity();
    const pendingNavigation = request.webContentsId === void 0 ? void 0 : this.pendingNavigationByGuestId.get(request.webContentsId);
    const googleAuthEnabled = processIdentity.mode === "clean";
    if (googleAuthEnabled && request.currentUserAgent === googleAuth.userAgent && (!pendingNavigation || isGoogleAuthUrl(pendingNavigation.currentUrl))) {
      return googleAuth;
    }
    const standingOverride = request.webContentsId === void 0 ? void 0 : this.standingCdpUserAgentOverride(request.webContentsId);
    if (googleAuthEnabled && !standingOverride && request.effectiveUserAgent === googleAuth.userAgent && (!pendingNavigation || isGoogleAuthUrl(pendingNavigation.currentUrl))) {
      return googleAuth;
    }
    if (googleAuthEnabled && standingOverride?.userAgent === googleAuth.userAgent) {
      return googleAuth;
    }
    return resolveBrowserTabIdentity({
      url: request.url,
      mobile: standingOverride?.userAgentMetadata?.mobile === true,
      processIdentity
    });
  }
  // Why: gate on the DIRECT page id, not ownerTabId — a popup has no device-metrics override of its
  // own, so inheriting the owner tab's preset would pair a mobile UA with a desktop viewport.
  hasMobileViewportApplied(guestWebContentsId) {
    const browserPageId = this.tabIdByWebContentsId.get(guestWebContentsId);
    const preset = browserPageId ? this.viewportPresetByTabId.get(browserPageId) : void 0;
    return preset?.guestWebContentsId === guestWebContentsId && preset.applied?.mobile === true;
  }
  /**
   * The only writer of the WebContents UA. Chromium cancels a redirect, and reloads a loading
   * document, when that UA changes at any other moment; a cross-document did-start-navigation is
   * the one point where it lands on the new document alone. Call it synchronously from that event.
   */
  presentTabIdentityAtNavigationStart(guest, url, sameDocument) {
    const identity2 = this.resolveGuestTabIdentity(guest, url);
    const webContentsUserAgent = identity2.kind === "google-auth" ? identity2.userAgent : getBrowserProcessUserAgentIdentity().userAgent;
    let presentedByWebContents = guest.getUserAgent();
    if (!sameDocument && presentedByWebContents !== webContentsUserAgent) {
      guest.setUserAgent(webContentsUserAgent);
      presentedByWebContents = webContentsUserAgent;
    }
    return this.writeTabIdentityOverride(guest, identity2, presentedByWebContents);
  }
  /** Every other identity change (redirects, failed loads, preset changes) goes over CDP only. */
  retargetTabIdentity(guest, url) {
    return this.writeTabIdentityOverride(
      guest,
      this.resolveGuestTabIdentity(guest, url),
      guest.getUserAgent()
    );
  }
  resolveGuestTabIdentity(guest, url) {
    return resolveBrowserTabIdentity({
      url,
      mobile: this.hasMobileViewportApplied(guest.id),
      processIdentity: getBrowserProcessUserAgentIdentity()
    });
  }
  // Why clear rather than restate: any override without userAgentMetadata makes Chromium drop
  // navigator.userAgentData and every sec-ch-ua header, so it stands only when the WebContents UA
  // cannot present the identity itself.
  writeTabIdentityOverride(guest, identity2, presentedByWebContents) {
    const override = identity2.kind === "mobile" ? { userAgent: identity2.userAgent, userAgentMetadata: identity2.userAgentMetadata } : presentedByWebContents === identity2.userAgent ? { userAgent: "" } : (
      // Only reachable before a navigation start can rewrite the WebContents UA (a redirect
      // off the auth host, a failed load); the next cross-document navigation clears it.
      { userAgent: identity2.userAgent }
    );
    if (override.userAgent === "" && !this.standingCdpUserAgentOverride(guest.id)) {
      return Promise.resolve(true);
    }
    return this.writeCdpUserAgentOverride(guest, override);
  }
  /** The override Chromium holds or is about to hold; undefined when none stands. */
  standingCdpUserAgentOverride(guestId) {
    const state = this.cdpUserAgentOverrideStateByGuestId.get(guestId);
    const latestPending = state?.pending.at(-1);
    const current2 = latestPending && latestPending.sequence > (state?.confirmed?.sequence ?? -1) ? latestPending : state?.confirmed;
    return current2 && current2.override.userAgent !== "" ? current2.override : void 0;
  }
  canOverrideUserAgentOverCdp(guest) {
    try {
      return !guest.isDestroyed() && guest.debugger.isAttached();
    } catch {
      return false;
    }
  }
  // Why no queue: debugger.sendCommand dispatches in call order over one channel, so the later-issued
  // write wins. The sequence only keeps a failed or superseded write from being recorded as standing.
  writeCdpUserAgentOverride(guest, override) {
    if (!this.canOverrideUserAgentOverCdp(guest)) {
      return Promise.resolve(false);
    }
    const state = this.cdpUserAgentOverrideStateByGuestId.get(guest.id) ?? {
      confirmed: null,
      nextSequence: 0,
      pending: []
    };
    const operation = { sequence: ++state.nextSequence, override };
    state.pending.push(operation);
    this.cdpUserAgentOverrideStateByGuestId.set(guest.id, state);
    return guest.debugger.sendCommand("Emulation.setUserAgentOverride", override).then(
      () => this.settleCdpUserAgentOverride(guest.id, state, operation, true),
      (error) => {
        this.settleCdpUserAgentOverride(guest.id, state, operation, false);
        console.warn("[browser-manager] failed to write the tab user agent override", {
          guestWebContentsId: guest.id,
          error: error instanceof Error ? error.message : String(error)
        });
        return false;
      }
    );
  }
  settleCdpUserAgentOverride(guestId, state, operation, succeeded) {
    if (this.cdpUserAgentOverrideStateByGuestId.get(guestId) !== state) {
      return false;
    }
    if (succeeded && (state.confirmed?.sequence ?? -1) < operation.sequence) {
      state.confirmed = operation;
    }
    const pendingIndex = state.pending.indexOf(operation);
    if (pendingIndex !== -1) {
      state.pending.splice(pendingIndex, 1);
    }
    if ((state.confirmed === null || state.confirmed.override.userAgent === "") && state.pending.length === 0) {
      this.cdpUserAgentOverrideStateByGuestId.delete(guestId);
    }
    return succeeded;
  }
  startPendingNavigation(guestId, url) {
    const pending = this.pendingNavigationByGuestId.get(guestId);
    this.pendingNavigationByGuestId.set(guestId, {
      currentUrl: url,
      supersededUrls: pending ? [...pending.supersededUrls, pending.currentUrl] : []
    });
  }
  updatePendingNavigationForRedirect(guestId, url) {
    const pending = this.pendingNavigationByGuestId.get(guestId);
    if (!pending) {
      this.pendingNavigationByGuestId.set(guestId, {
        currentUrl: url,
        supersededUrls: []
      });
      return;
    }
    pending.currentUrl = url;
  }
  failPendingNavigation(guestId, failedUrl) {
    const pending = this.pendingNavigationByGuestId.get(guestId);
    if (!pending) {
      return false;
    }
    const supersededIndex = pending.supersededUrls.indexOf(failedUrl);
    if (supersededIndex !== -1) {
      pending.supersededUrls.splice(supersededIndex, 1);
      return false;
    }
    if (pending.currentUrl !== failedUrl) {
      return false;
    }
    this.pendingNavigationByGuestId.delete(guestId);
    return true;
  }
  // Why: webContents.getURL() reports the last COMMITTED url, so mid-navigation it names the host
  // the tab is leaving, not the one it is entering. Every UA writer must resolve the host through
  // here or two writers racing the same navigation will pick opposite identities.
  resolveTabNavigationUrl(guest) {
    return this.pendingNavigationByGuestId.get(guest.id)?.currentUrl ?? guest.getURL();
  }
  createPopupChildWindowWithOriginBar(openerGuest, targetUrl, options) {
    const popup = openPopupWithOriginBar(options, targetUrl);
    this.attachGuestPolicies(
      popup.contentWebContents,
      this.resolvePopupOwnerContext(openerGuest.id)
    );
    this.forwardOrQueuePopupEvent(openerGuest.id, {
      origin: safeOrigin(targetUrl),
      action: "opened-in-orca"
    });
    const closePopupWithOpener = () => popup.close();
    openerGuest.once("destroyed", closePopupWithOpener);
    popup.onClosed(() => {
      if (!openerGuest.isDestroyed()) {
        openerGuest.off("destroyed", closePopupWithOpener);
      }
    });
    return popup.contentWebContents;
  }
};

// src/main/browser/browser-manager-guest-popup-policy.ts
var BrowserManagerGuestPopupPolicy = class extends BrowserManagerNavigation {
  installGuestPopupPolicy(guest) {
    const gesture = trackBrowserGuestInputGesture(guest);
    const handleDidCreateWindow = (window) => {
      this.attachGuestPolicies(window.webContents, this.resolvePopupOwnerContext(guest.id));
    };
    guest.on("did-create-window", handleDidCreateWindow);
    guest.setWindowOpenHandler(({ url, frameName, disposition }) => {
      const clicked = gesture.consume();
      const ownerContext = this.resolvePopupOwnerContext(guest.id);
      const browserTabId = ownerContext?.browserTabId ?? null;
      const browserUrl = normalizeBrowserNavigationUrl(url);
      const externalUrl = normalizeExternalBrowserUrl(url);
      if (ownerContext && externalUrl && isNewBrowserTabPopupIntent({ frameName, disposition })) {
        if (!clicked && !this.tryConsumePageInitiatedTab(ownerContext.rootGuestWebContentsId)) {
          this.forwardOrQueuePopupEvent(guest.id, {
            origin: safeOrigin(externalUrl),
            action: "blocked"
          });
          return { action: "deny" };
        }
        if (this.openLinkInOrcaTab(
          ownerContext.browserTabId,
          externalUrl,
          disposition !== "background-tab"
        )) {
          this.forwardOrQueuePopupEvent(guest.id, {
            origin: safeOrigin(externalUrl),
            action: "opened-in-orca"
          });
        }
        return { action: "deny" };
      }
      const canOpenAsChild = Boolean(externalUrl || browserUrl === ORCA_BROWSER_BLANK_URL);
      if (browserTabId && canOpenAsChild) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: SAFE_POPUP_WINDOW_OPTIONS,
          // Why: default child windows lack an address bar; host in an Orca origin-bar window so the destination is verifiable.
          createWindow: (options) => this.createPopupChildWindowWithOriginBar(guest, url, options)
        };
      } else if (externalUrl) {
        void getBrowserHost().openExternal(redactKagiSessionToken(externalUrl));
        this.forwardOrQueuePopupEvent(guest.id, {
          origin: safeOrigin(externalUrl),
          action: "opened-external"
        });
      } else {
        this.forwardOrQueuePopupEvent(guest.id, {
          origin: safeOrigin(url),
          action: "blocked"
        });
      }
      return { action: "deny" };
    });
    return () => {
      gesture.dispose();
      try {
        guest.off("did-create-window", handleDidCreateWindow);
      } catch {
      }
    };
  }
};

// src/main/browser/browser-manager-guest-navigation-policy.ts
var BrowserManagerGuestNavigationPolicy = class extends BrowserManagerGuestPopupPolicy {
  installGuestNavigationPolicy(guest) {
    const navigationGuard = (event, url) => {
      if (url.startsWith("blob:https://") || url.startsWith("blob:http://")) {
        return true;
      }
      if (url.startsWith("file:")) {
        event.preventDefault();
        return false;
      }
      if (!normalizeBrowserNavigationUrl(url)) {
        event.preventDefault();
        return false;
      }
      return true;
    };
    const willRedirectHandler = (event, url, _isInPlace, isMainFrame) => {
      if (!navigationGuard(event, url) || !isMainFrame || isChromiumInternalErrorUrl(url)) {
        return;
      }
      this.updatePendingNavigationForRedirect(guest.id, url);
      void this.retargetTabIdentity(guest, url);
    };
    const didFailLoadHandler = (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }
      const failedNavigationWasCurrent = this.failPendingNavigation(guest.id, validatedURL);
      if (failedNavigationWasCurrent) {
        void this.retargetTabIdentity(guest, guest.getURL());
      }
      if (errorCode === -3) {
        const clearedError = this.clearedLoadErrorsByGuestId.get(guest.id);
        if (clearedError !== void 0) {
          this.clearedLoadErrorsByGuestId.delete(guest.id);
          this.loadErrorsByGuestId.set(guest.id, clearedError);
          this.forwardOrQueueGuestLoadFailure(guest.id, clearedError);
          this.notifyBrowserGuestStateChanged(guest.id);
        }
        return;
      }
      this.clearedLoadErrorsByGuestId.delete(guest.id);
      const loadError = this.buildLoadError(
        errorCode,
        errorDescription || "This site could not be reached.",
        validatedURL || guest.getURL() || "about:blank"
      );
      this.loadErrorsByGuestId.set(guest.id, loadError);
      this.forwardOrQueueGuestLoadFailure(guest.id, loadError);
      this.notifyBrowserGuestStateChanged(guest.id);
    };
    const didStartNavigationHandler = (_event, url, isInPlace, isMainFrame) => {
      if (!isMainFrame || isChromiumInternalErrorUrl(url)) {
        return;
      }
      this.startPendingNavigation(guest.id, url);
      void this.presentTabIdentityAtNavigationStart(guest, url, isInPlace);
      this.pendingLoadFailuresByGuestId.delete(guest.id);
      const activeError = this.loadErrorsByGuestId.get(guest.id);
      if (activeError === void 0) {
        this.clearedLoadErrorsByGuestId.delete(guest.id);
        return;
      }
      this.clearedLoadErrorsByGuestId.set(guest.id, activeError);
      this.loadErrorsByGuestId.delete(guest.id);
      this.notifyBrowserGuestStateChanged(guest.id);
    };
    const didNavigateHandler = (_event, _url) => {
      this.pendingNavigationByGuestId.delete(guest.id);
      this.clearedLoadErrorsByGuestId.delete(guest.id);
      this.notifyBrowserGuestStateChanged(guest.id);
    };
    guest.on("will-navigate", navigationGuard);
    guest.on("will-redirect", willRedirectHandler);
    guest.on("did-start-navigation", didStartNavigationHandler);
    guest.on("did-navigate", didNavigateHandler);
    guest.on("did-fail-load", didFailLoadHandler);
    const handleDestroyed = () => {
      const browserTabId = this.tabIdByWebContentsId.get(guest.id);
      if (browserTabId && this.webContentsIdByTabId.get(browserTabId) === guest.id) {
        this.unregisterGuest(browserTabId, "guest-destroyed");
        return;
      }
      this.cleanupGuestPolicyAttachment(guest.id);
    };
    guest.on("destroyed", handleDestroyed);
    return () => {
      try {
        guest.off("destroyed", handleDestroyed);
      } catch {
      }
      if (!guest.isDestroyed()) {
        guest.off("will-navigate", navigationGuard);
        guest.off("will-redirect", willRedirectHandler);
        guest.off("did-start-navigation", didStartNavigationHandler);
        guest.off("did-navigate", didNavigateHandler);
        guest.off("did-fail-load", didFailLoadHandler);
      }
    };
  }
};

// src/main/browser/browser-manager-guest-cleanup.ts
var BrowserManagerGuestCleanup = class extends BrowserManagerGuestNavigationPolicy {
  retireStaleGuestWebContents(previousWebContentsId) {
    this.cleanupGuestPolicyAttachment(previousWebContentsId);
  }
  cleanupGuestPolicyAttachment(guestWebContentsId) {
    const browserTabId = this.tabIdByWebContentsId.get(guestWebContentsId);
    const isPrimaryGuest = browserTabId !== void 0;
    if (browserTabId && this.webContentsIdByTabId.get(browserTabId) === guestWebContentsId) {
      this.webContentsIdByTabId.delete(browserTabId);
    }
    this.tabIdByWebContentsId.delete(guestWebContentsId);
    const policyCleanup = this.policyCleanupByGuestId.get(guestWebContentsId);
    if (policyCleanup) {
      policyCleanup();
      this.policyCleanupByGuestId.delete(guestWebContentsId);
    }
    this.policyAttachedGuestIds.delete(guestWebContentsId);
    this.popupOwnerContextByGuestId.delete(guestWebContentsId);
    this.pageInitiatedTabBudgetByRootGuestId.delete(guestWebContentsId);
    this.cdpUserAgentOverrideStateByGuestId.delete(guestWebContentsId);
    this.pendingNavigationByGuestId.delete(guestWebContentsId);
    if (isPrimaryGuest) {
      for (const [popupGuestId, owner] of this.popupOwnerContextByGuestId) {
        if (owner.rootGuestWebContentsId === guestWebContentsId) {
          this.popupOwnerContextByGuestId.delete(popupGuestId);
        }
      }
    }
    this.pendingLoadFailuresByGuestId.delete(guestWebContentsId);
    this.loadErrorsByGuestId.delete(guestWebContentsId);
    this.clearedLoadErrorsByGuestId.delete(guestWebContentsId);
    this.pendingPermissionEventsByGuestId.delete(guestWebContentsId);
    this.pendingPopupEventsByGuestId.delete(guestWebContentsId);
  }
};

// src/main/browser/browser-manager-guest-policy.ts
var BrowserManagerGuestPolicy = class extends BrowserManagerGuestCleanup {
  attachGuestPolicies(guest, inheritedOwnerContext = null) {
    if (this.policyAttachedGuestIds.has(guest.id)) {
      return;
    }
    this.policyAttachedGuestIds.add(guest.id);
    if (inheritedOwnerContext) {
      this.popupOwnerContextByGuestId.set(guest.id, inheritedOwnerContext);
    }
    const disposeDetachTracking = this.trackDebuggerDetachForCdpOverrides(guest);
    guest.setBackgroundThrottling(false);
    const disposePopupPolicy = this.installGuestPopupPolicy(guest);
    const disposeNavigationPolicy = this.installGuestNavigationPolicy(guest);
    this.policyCleanupByGuestId.set(guest.id, () => {
      disposeDetachTracking();
      disposePopupPolicy();
      disposeNavigationPolicy();
    });
  }
};

// src/main/browser/browser-manager-registration.ts
var BrowserManagerRegistration = class extends BrowserManagerGuestPolicy {
  registerGuest({
    browserPageId,
    scopeId,
    sessionProfileId,
    webContentsId,
    rendererWebContentsId
  }) {
    const browserTabId = browserPageId;
    if (!browserTabId) {
      return false;
    }
    this.cancelGrabOp(browserTabId, "evicted");
    const previousCleanup = this.contextMenuCleanupByTabId.get(browserTabId);
    if (previousCleanup) {
      previousCleanup();
      this.contextMenuCleanupByTabId.delete(browserTabId);
    }
    const guest = import_electron6.webContents.fromId(webContentsId);
    if (!guest || guest.isDestroyed()) {
      return false;
    }
    if (guest.getType() !== "webview") {
      return false;
    }
    if (!this.policyAttachedGuestIds.has(webContentsId)) {
      return false;
    }
    const previousWebContentsId = this.webContentsIdByTabId.get(browserTabId);
    if (previousWebContentsId !== void 0 && previousWebContentsId !== webContentsId) {
      this.retireStaleGuestWebContents(previousWebContentsId);
      this.viewportPresetByTabId.delete(browserTabId);
      this.viewportScrollStateByTabId.delete(browserTabId);
    }
    this.webContentsIdByTabId.set(browserTabId, webContentsId);
    this.tabIdByWebContentsId.set(webContentsId, browserTabId);
    this.sessionProfileIdByPageId.set(browserTabId, sessionProfileId ?? null);
    this.rendererWebContentsIdByTabId.set(browserTabId, rendererWebContentsId);
    if (scopeId) {
      this.scopeIdByTabId.set(browserTabId, scopeId);
    }
    this.setupContextMenu(browserTabId, guest);
    this.setupGrabShortcut(browserTabId, guest);
    this.setupShortcutForwarding(browserTabId, guest);
    this.setupMouseWheelZoomForwarding(browserTabId, guest);
    this.flushPendingLoadFailure(browserTabId, webContentsId);
    this.flushPendingPermissionEvents(browserTabId, webContentsId);
    this.flushPendingPopupEvents(browserTabId, webContentsId);
    return true;
  }
  unregisterGuest(browserTabId, _reason = "page-closed") {
    this.cancelGrabOp(browserTabId, "evicted");
    const guestWebContentsId = this.webContentsIdByTabId.get(browserTabId);
    if (guestWebContentsId !== void 0) {
      this.cleanupGuestPolicyAttachment(guestWebContentsId);
    }
    const cleanup = this.contextMenuCleanupByTabId.get(browserTabId);
    if (cleanup) {
      cleanup();
      this.contextMenuCleanupByTabId.delete(browserTabId);
    }
    const shortcutCleanup = this.grabShortcutCleanupByTabId.get(browserTabId);
    if (shortcutCleanup) {
      shortcutCleanup();
      this.grabShortcutCleanupByTabId.delete(browserTabId);
    }
    const fwdCleanup = this.shortcutForwardingCleanupByTabId.get(browserTabId);
    if (fwdCleanup) {
      fwdCleanup();
      this.shortcutForwardingCleanupByTabId.delete(browserTabId);
    }
    const mouseWheelZoomCleanup = this.mouseWheelZoomCleanupByTabId.get(browserTabId);
    if (mouseWheelZoomCleanup) {
      mouseWheelZoomCleanup();
      this.mouseWheelZoomCleanupByTabId.delete(browserTabId);
    }
    const wcId = this.webContentsIdByTabId.get(browserTabId);
    if (wcId !== void 0) {
      this.tabIdByWebContentsId.delete(wcId);
    }
    this.webContentsIdByTabId.delete(browserTabId);
    this.rendererWebContentsIdByTabId.delete(browserTabId);
    this.sessionProfileIdByPageId.delete(browserTabId);
    this.scopeIdByTabId.delete(browserTabId);
    this.viewportOpsByTabId.delete(browserTabId);
    this.viewportPresetByTabId.delete(browserTabId);
    this.viewportScrollStateByTabId.delete(browserTabId);
    if (wcId !== void 0) {
      this.pendingNavigationByGuestId.delete(wcId);
    }
    this.annotationViewportBridgeOpsByTabId.delete(browserTabId);
  }
  unregisterAll() {
    for (const browserTabId of this.webContentsIdByTabId.keys()) {
      this.unregisterGuest(browserTabId);
    }
    this.policyAttachedGuestIds.clear();
    for (const cleanup of this.policyCleanupByGuestId.values()) {
      cleanup();
    }
    this.policyCleanupByGuestId.clear();
    this.tabIdByWebContentsId.clear();
    this.popupOwnerContextByGuestId.clear();
    this.pageInitiatedTabBudgetByRootGuestId.clear();
    this.scopeIdByTabId.clear();
    this.sessionProfileIdByPageId.clear();
    this.viewportPresetByTabId.clear();
    this.viewportScrollStateByTabId.clear();
    this.cdpUserAgentOverrideStateByGuestId.clear();
    this.pendingNavigationByGuestId.clear();
    this.pendingLoadFailuresByGuestId.clear();
    this.loadErrorsByGuestId.clear();
    this.clearedLoadErrorsByGuestId.clear();
    this.pendingPermissionEventsByGuestId.clear();
    this.pendingPopupEventsByGuestId.clear();
    this.mouseWheelZoomCleanupByTabId.clear();
    this.annotationViewportBridgeOpsByTabId.clear();
  }
};

// src/main/browser/browser-manager-queries.ts
var BrowserManagerQueries = class extends BrowserManagerRegistration {
  getGuestWebContentsId(browserTabId) {
    return this.webContentsIdByTabId.get(browserTabId) ?? null;
  }
  getWebContentsIdByTabId() {
    return this.webContentsIdByTabId;
  }
  getTabIdForWebContentsId(webContentsId) {
    return this.tabIdByWebContentsId.get(webContentsId) ?? null;
  }
  getScopeIdForTab(browserTabId) {
    return this.scopeIdByTabId.get(browserTabId);
  }
  getRendererContextForGuest(guestWebContentsId) {
    const browserPageId = this.resolveBrowserTabIdForGuestWebContentsId(guestWebContentsId);
    if (!browserPageId) {
      return null;
    }
    const renderer = this.resolveRendererForBrowserTab(browserPageId);
    return renderer ? { browserPageId, renderer } : null;
  }
  getSessionProfileIdForTab(browserTabId) {
    return this.sessionProfileIdByPageId.get(browserTabId) ?? null;
  }
  getBrowserPageLoadError(browserPageId) {
    const webContentsId = this.webContentsIdByTabId.get(browserPageId);
    return webContentsId === void 0 ? null : this.loadErrorsByGuestId.get(webContentsId) ?? null;
  }
  // Why: centralize Kagi session-token redaction so every load-error path (did-fail-load, cert failure) strips it.
  buildLoadError(code, description, rawUrl) {
    return {
      code,
      description,
      validatedUrl: redactKagiSessionToken(rawUrl)
    };
  }
  notifyBrowserGuestStateChanged(webContentsId) {
    const browserPageId = this.tabIdByWebContentsId.get(webContentsId);
    const scopeId = browserPageId ? this.scopeIdByTabId.get(browserPageId) : null;
    if (scopeId) {
      try {
        this.browserGuestStateChangedListener?.(scopeId);
      } catch (error) {
        console.error("[browser-manager] browserGuestStateChanged listener failed", error);
      }
    }
  }
  notifyPermissionDenied(args) {
    this.forwardOrQueuePermissionDenied(args.guestWebContentsId, {
      permission: args.permission,
      origin: safeOrigin(args.rawUrl)
    });
  }
};

// src/main/browser/browser-manager-viewport.ts
var BrowserManagerViewport = class extends BrowserManagerQueries {
  // Why: guests are isolated from the plugin's preload bridge, so main owns the devtools escape hatch after a tab→guest lookup.
  async openDevTools(browserTabId) {
    const webContentsId = this.webContentsIdByTabId.get(browserTabId);
    if (!webContentsId) {
      return false;
    }
    const guest = import_electron7.webContents.fromId(webContentsId);
    if (!guest || guest.isDestroyed()) {
      this.unregisterGuest(browserTabId);
      return false;
    }
    guest.openDevTools({ mode: "detach" });
    return true;
  }
};

// src/main/browser/browser-manager-grab.ts
var BrowserManagerGrab = class extends BrowserManagerViewport {
  /** Validate that the sender owns browserTabId; returns the guest WebContents or null. */
  getAuthorizedGuest(browserTabId, senderWebContentsId) {
    const registeredRenderer = this.rendererWebContentsIdByTabId.get(browserTabId);
    if (registeredRenderer == null || registeredRenderer !== senderWebContentsId) {
      return null;
    }
    const guestId = this.webContentsIdByTabId.get(browserTabId);
    if (guestId == null) {
      return null;
    }
    const guest = import_electron8.webContents.fromId(guestId);
    if (!guest || guest.isDestroyed()) {
      this.unregisterGuest(browserTabId);
      return null;
    }
    return guest;
  }
  // Grab is not part of this phase; these keep the base-class contract with no behavior.
  setupGrabShortcut(_browserTabId, _guest) {
  }
  hasActiveGrabOp(_browserTabId) {
    return false;
  }
  cancelGrabOp(_browserTabId, _reason) {
  }
};

// src/main/browser/browser-manager-bindings.ts
var BrowserManagerBindings = class extends BrowserManagerGrab {
  setupContextMenu(browserTabId, guest) {
    this.contextMenuCleanupByTabId.set(
      browserTabId,
      setupGuestContextMenu({
        browserTabId,
        guest,
        resolveRenderer: (tabId) => this.resolveRendererForBrowserTab(tabId)
      })
    );
  }
  // Why: a focused webview guest is a separate process, so its key events never reach the renderer; intercept and forward app shortcuts.
  setupShortcutForwarding(browserTabId, guest) {
    const previousCleanup = this.shortcutForwardingCleanupByTabId.get(browserTabId);
    if (previousCleanup) {
      previousCleanup();
      this.shortcutForwardingCleanupByTabId.delete(browserTabId);
    }
    this.shortcutForwardingCleanupByTabId.set(
      browserTabId,
      setupGuestShortcutForwarding({
        browserTabId,
        guest,
        resolveRenderer: (tabId) => resolveRendererWebContents(this.rendererWebContentsIdByTabId, tabId)
      })
    );
  }
  setupMouseWheelZoomForwarding(browserTabId, guest) {
    const previousCleanup = this.mouseWheelZoomCleanupByTabId.get(browserTabId);
    if (previousCleanup) {
      previousCleanup();
      this.mouseWheelZoomCleanupByTabId.delete(browserTabId);
    }
    this.mouseWheelZoomCleanupByTabId.set(
      browserTabId,
      setupGuestMouseWheelZoomForwarding({
        browserTabId,
        guest,
        resolveRenderer: (tabId) => resolveRendererWebContents(this.rendererWebContentsIdByTabId, tabId),
        isViewportPresetActive: () => {
          const state = this.viewportPresetByTabId.get(browserTabId);
          return state?.guestWebContentsId === guest.id && state.requested !== null;
        },
        canViewportScroll: (mouse) => this.canViewportScroll(browserTabId, mouse),
        onViewportWheelConsumed: (deltaX, deltaY) => this.recordViewportScrollDelta(browserTabId, deltaX, deltaY)
      })
    );
  }
};

// src/main/browser/browser-manager-event-forwarding.ts
var BrowserManagerEventForwarding = class extends BrowserManagerBindings {
  forwardOrQueueGuestLoadFailure(guestWebContentsId, loadError) {
    const browserTabId = this.tabIdByWebContentsId.get(guestWebContentsId);
    if (!browserTabId) {
      this.pendingLoadFailuresByGuestId.set(guestWebContentsId, loadError);
      return;
    }
    this.sendGuestLoadFailure(browserTabId, loadError);
  }
  forwardOrQueuePermissionDenied(guestWebContentsId, event) {
    const browserTabId = this.resolveBrowserTabIdForGuestWebContentsId(guestWebContentsId);
    if (!browserTabId) {
      const pending = this.pendingPermissionEventsByGuestId.get(guestWebContentsId) ?? [];
      pending.push(event);
      if (pending.length > 5) {
        pending.shift();
      }
      this.pendingPermissionEventsByGuestId.set(guestWebContentsId, pending);
      return;
    }
    this.sendPermissionDenied(browserTabId, event);
  }
  flushPendingPermissionEvents(browserTabId, guestWebContentsId) {
    const pending = this.pendingPermissionEventsByGuestId.get(guestWebContentsId);
    if (!pending?.length) {
      return;
    }
    this.pendingPermissionEventsByGuestId.delete(guestWebContentsId);
    for (const event of pending) {
      this.sendPermissionDenied(browserTabId, event);
    }
  }
  sendPermissionDenied(browserTabId, event) {
    const renderer = this.resolveRendererForBrowserTab(browserTabId);
    if (!renderer) {
      return;
    }
    renderer.send("browser:permission-denied", {
      browserPageId: browserTabId,
      ...event
    });
  }
  forwardOrQueuePopupEvent(guestWebContentsId, event) {
    const browserTabId = this.resolveBrowserTabIdForGuestWebContentsId(guestWebContentsId);
    if (!browserTabId) {
      const pending = this.pendingPopupEventsByGuestId.get(guestWebContentsId) ?? [];
      pending.push(event);
      if (pending.length > 5) {
        pending.shift();
      }
      this.pendingPopupEventsByGuestId.set(guestWebContentsId, pending);
      return;
    }
    this.sendPopupEvent(browserTabId, event);
  }
  flushPendingPopupEvents(browserTabId, guestWebContentsId) {
    const pending = this.pendingPopupEventsByGuestId.get(guestWebContentsId);
    if (!pending?.length) {
      return;
    }
    this.pendingPopupEventsByGuestId.delete(guestWebContentsId);
    for (const event of pending) {
      this.sendPopupEvent(browserTabId, event);
    }
  }
  sendPopupEvent(browserTabId, event) {
    const renderer = this.resolveRendererForBrowserTab(browserTabId);
    if (!renderer) {
      return;
    }
    renderer.send("browser:popup", {
      browserPageId: browserTabId,
      ...event
    });
  }
  flushPendingLoadFailure(browserTabId, guestWebContentsId) {
    const pending = this.pendingLoadFailuresByGuestId.get(guestWebContentsId);
    if (!pending) {
      return;
    }
    this.pendingLoadFailuresByGuestId.delete(guestWebContentsId);
    this.sendGuestLoadFailure(browserTabId, pending);
  }
  sendGuestLoadFailure(browserTabId, loadError) {
    const renderer = this.resolveRendererForBrowserTab(browserTabId);
    if (!renderer) {
      return;
    }
    renderer.send("browser:guest-load-failed", {
      browserPageId: browserTabId,
      loadError: {
        ...loadError,
        validatedUrl: redactKagiSessionToken(loadError.validatedUrl)
      }
    });
  }
};

// src/main/browser/browser-manager-final.ts
var BrowserManagerFinal = class extends BrowserManagerEventForwarding {
  openLinkInOrcaTab(browserTabId, rawUrl, activate) {
    const renderer = this.resolveRendererForBrowserTab(browserTabId);
    if (!renderer) {
      return false;
    }
    const normalizedUrl = normalizeBrowserNavigationUrl(rawUrl);
    if (!normalizedUrl || normalizedUrl === ORCA_BROWSER_BLANK_URL) {
      return false;
    }
    renderer.send("browser:open-link-in-orca-tab", {
      browserPageId: browserTabId,
      url: normalizedUrl,
      ...activate === false ? { activate: false } : {}
    });
    return true;
  }
};

// src/main/browser/browser-manager.ts
var BrowserManager = class extends BrowserManagerFinal {
};
var browserManager = new BrowserManager();

// src/main/browser/browser-system-resume-forwarding.ts
var import_electron9 = require("electron");
function installSystemResumeForwarding(getMainWindow) {
  const onResume = () => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send("browser:systemResumed");
  };
  import_electron9.powerMonitor.on("resume", onResume);
  return () => {
    import_electron9.powerMonitor.removeListener("resume", onResume);
  };
}

// src/main/ipc/browser-guest-view-ipc.ts
var import_electron10 = require("electron");

// src/main/ipc/browser-renderer-trust.ts
function isTrustedBrowserRenderer(sender) {
  return !sender.isDestroyed() && sender.getType() === "window" && sender.id === getBrowserHost().getMainWindow()?.webContents.id;
}

// src/main/ipc/browser-guest-view-ipc.ts
function registerBrowserGuestViewHandlers() {
  import_electron10.ipcMain.removeHandler("browser:openDevTools");
  import_electron10.ipcMain.handle("browser:openDevTools", (event, args) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false;
    }
    return browserManager.openDevTools(args.browserPageId);
  });
  return () => {
    import_electron10.ipcMain.removeHandler("browser:openDevTools");
  };
}

// src/main/ipc/browser-host-ipc.ts
var import_electron11 = require("electron");
var HOST_CHANNELS = ["browser:openExternal", "browser:writeClipboardText"];
function registerBrowserHostHandlers() {
  for (const channel of HOST_CHANNELS) {
    import_electron11.ipcMain.removeHandler(channel);
  }
  import_electron11.ipcMain.handle(
    "browser:openExternal",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender) || typeof args?.url !== "string") {
        return false;
      }
      const url = normalizeExternalBrowserUrl(args.url);
      if (!url) {
        return false;
      }
      await getBrowserHost().openExternal(url);
      return true;
    }
  );
  import_electron11.ipcMain.handle("browser:writeClipboardText", (event, text) => {
    if (!isTrustedBrowserRenderer(event.sender) || typeof text !== "string") {
      return;
    }
    import_electron11.clipboard.writeText(text);
  });
  return () => {
    for (const channel of HOST_CHANNELS) {
      import_electron11.ipcMain.removeHandler(channel);
    }
  };
}

// src/main/ipc/browser.ts
var import_electron13 = require("electron");

// src/main/ipc/browser-tab-registration-wait.ts
var import_electron12 = require("electron");
var pendingTabRegistrations = /* @__PURE__ */ new Map();
var pendingScopeTabRegistrations = /* @__PURE__ */ new Map();
var pendingAnyTabRegistrations = /* @__PURE__ */ new Set();
function resolvePendingRegistrations(registrationResolvers) {
  if (!registrationResolvers) {
    return;
  }
  for (const pendingResolve of registrationResolvers) {
    pendingResolve();
  }
}
function isLiveBrowserWebContentsId(webContentsId) {
  if (webContentsId == null) {
    return false;
  }
  const guest = import_electron12.webContents.fromId(webContentsId);
  return Boolean(guest && !guest.isDestroyed());
}
function resolveTabRegistrationWaiters(browserPageId, scopeId) {
  const pendingResolves = pendingTabRegistrations.get(browserPageId);
  pendingTabRegistrations.delete(browserPageId);
  resolvePendingRegistrations(pendingResolves);
  const pendingScopeResolves = pendingScopeTabRegistrations.get(scopeId);
  pendingScopeTabRegistrations.delete(scopeId);
  resolvePendingRegistrations(pendingScopeResolves);
  const pendingAnyResolves = new Set(pendingAnyTabRegistrations);
  pendingAnyTabRegistrations.clear();
  resolvePendingRegistrations(pendingAnyResolves);
}

// src/main/ipc/browser.ts
var BROWSER_HANDLER_CHANNELS = [
  "browser:registerGuest",
  "browser:isGuestRegistered",
  "browser:repairGuestRegistration",
  "browser:unregisterGuest",
  "browser:activeTabChanged"
];
function registerBrowserHandlers() {
  for (const channel of BROWSER_HANDLER_CHANNELS) {
    import_electron13.ipcMain.removeHandler(channel);
  }
  const registerGuest = (event, args, repairPolicies) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false;
    }
    if (!args || typeof args.browserPageId !== "string" || typeof args.scopeId !== "string" || typeof args.webContentsId !== "number") {
      return false;
    }
    if (repairPolicies) {
      const guest = import_electron13.webContents.fromId(args.webContentsId);
      if (!guest || guest.isDestroyed() || guest.getType() !== "webview" || guest.hostWebContents?.id !== event.sender.id) {
        return false;
      }
      browserManager.attachGuestPolicies(guest);
    }
    const registered = browserManager.registerGuest({
      ...args,
      rendererWebContentsId: event.sender.id
    });
    if (!registered) {
      return false;
    }
    resolveTabRegistrationWaiters(args.browserPageId, args.scopeId);
    return true;
  };
  import_electron13.ipcMain.handle(
    "browser:registerGuest",
    (event, args) => registerGuest(event, args, false)
  );
  import_electron13.ipcMain.handle(
    "browser:repairGuestRegistration",
    (event, args) => registerGuest(event, args, true)
  );
  import_electron13.ipcMain.handle(
    "browser:isGuestRegistered",
    (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender) || typeof args?.browserPageId !== "string" || typeof args.webContentsId !== "number") {
        return false;
      }
      return browserManager.getGuestWebContentsId(args.browserPageId) === args.webContentsId && isLiveBrowserWebContentsId(args.webContentsId);
    }
  );
  import_electron13.ipcMain.handle("browser:unregisterGuest", (event, args) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false;
    }
    if (typeof args?.browserPageId !== "string") {
      return false;
    }
    browserManager.unregisterGuest(args.browserPageId);
    return true;
  });
  import_electron13.ipcMain.handle("browser:activeTabChanged", (event, _args) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false;
    }
    return false;
  });
  return () => {
    for (const channel of BROWSER_HANDLER_CHANNELS) {
      import_electron13.ipcMain.removeHandler(channel);
    }
  };
}

// src/main/window/main-window-webview-security.ts
var import_electron14 = require("electron");

// src/shared/browser-guest-web-preferences.ts
var ORCA_BROWSER_GUEST_WEB_PREFERENCES = {
  disableHtmlFullscreenWindowResize: true
};

// src/main/browser/browser-partition-allowlist.ts
var sources = /* @__PURE__ */ new Set();
function isAllowedBrowserPartition(partition) {
  if (partition === ORCA_BROWSER_PARTITION) {
    return true;
  }
  for (const source of sources) {
    if (source(partition)) {
      return true;
    }
  }
  return false;
}

// src/main/window/main-window-webview-security.ts
function installWebviewSecurity(getMainWindow) {
  const isMainWindowContents = (contents) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed?.()) {
      return false;
    }
    return mainWindow.webContents.id === contents.id;
  };
  const disposers = /* @__PURE__ */ new Map();
  const guard = (contents) => {
    if (contents.getType() !== "window" || disposers.has(contents.id)) {
      return;
    }
    const onWillAttach = (event, webPreferences, params) => {
      const src = typeof params.src === "string" ? params.src : "";
      const partition = typeof webPreferences.partition === "string" ? webPreferences.partition : "";
      if (!isMainWindowContents(contents) || !normalizeBrowserNavigationUrl(src) || !isAllowedBrowserPartition(partition)) {
        event.preventDefault();
        return;
      }
      delete params.preload;
      delete webPreferences.preload;
      delete webPreferences.preloadURL;
      delete webPreferences.additionalArguments;
      webPreferences.nodeIntegration = false;
      webPreferences.nodeIntegrationInSubFrames = false;
      webPreferences.enableBlinkFeatures = "";
      webPreferences.disableBlinkFeatures = "";
      webPreferences.webSecurity = true;
      webPreferences.allowRunningInsecureContent = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      Object.assign(webPreferences, ORCA_BROWSER_GUEST_WEB_PREFERENCES);
      webPreferences.partition = partition;
    };
    const onDidAttach = (_event, guest) => {
      if (!isMainWindowContents(contents)) {
        return;
      }
      browserManager.attachGuestPolicies(guest);
    };
    contents.on("will-attach-webview", onWillAttach);
    contents.on("did-attach-webview", onDidAttach);
    disposers.set(contents.id, () => {
      try {
        contents.off("will-attach-webview", onWillAttach);
        contents.off("did-attach-webview", onDidAttach);
      } catch {
      }
    });
  };
  const onWebContentsCreated = (_event, contents) => {
    guard(contents);
  };
  for (const contents of import_electron14.webContents.getAllWebContents()) {
    guard(contents);
  }
  import_electron14.app.on("web-contents-created", onWebContentsCreated);
  return () => {
    import_electron14.app.off("web-contents-created", onWebContentsCreated);
    for (const dispose of disposers.values()) {
      dispose();
    }
    disposers.clear();
  };
}

// src/main/browser-core-installer.ts
var installBrowserCore = (options) => {
  const { host } = options;
  const getMainWindow = () => host.getMainWindow();
  const disposers = [
    registerBrowserHandlers(),
    registerBrowserGuestViewHandlers(),
    registerBrowserHostHandlers(),
    installWebviewSecurity(getMainWindow),
    installSystemResumeForwarding(getMainWindow)
  ];
  return () => {
    for (const dispose of disposers.reverse()) {
      dispose();
    }
    browserManager.unregisterAll();
  };
};

// src/main/plugin-installers.ts
var pluginInstallers = [installBrowserCore];

// src/main/plugin-options.ts
function resolveBrowserPluginOptions(opts) {
  const mcpPort = opts.mcp?.port ?? DEFAULT_MCP_PORT;
  if (!Number.isInteger(mcpPort) || mcpPort < 1024 || mcpPort > 65535) {
    throw new RangeError("orca-browser: mcp.port must be an integer between 1024 and 65535");
  }
  return { host: opts.host, mcpPort };
}

// src/main/index.ts
function installBrowserPlugin(opts) {
  if (isBrowserPluginInstalled()) {
    throw new Error(
      "orca-browser: installBrowserPlugin() was already called; dispose the previous handle first"
    );
  }
  const options = resolveBrowserPluginOptions(opts);
  const { logger } = options.host;
  setResolvedBrowserPluginOptions(options);
  const disposers = [];
  const runDisposers = async () => {
    for (const disposer of disposers.splice(0).reverse()) {
      try {
        await disposer();
      } catch (err) {
        logger.error("orca-browser: dispose failed", { error: String(err) });
      }
    }
  };
  try {
    for (const installer of pluginInstallers) {
      const disposer = installer(options);
      if (disposer) {
        disposers.push(disposer);
      }
    }
    logger.info("orca-browser: installed", { mcpPort: options.mcpPort });
  } catch (err) {
    setResolvedBrowserPluginOptions(null);
    void runDisposers();
    throw err;
  }
  let disposePromise = null;
  return {
    dispose: () => disposePromise ??= runDisposers().then(() => {
      setResolvedBrowserPluginOptions(null);
    })
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  installBrowserPlugin
});
