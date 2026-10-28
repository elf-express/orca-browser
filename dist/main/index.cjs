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
function isFileUrl(url) {
  return url.trim().toLowerCase().startsWith("file:");
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
var CHROMIUM_ENGINE_COMMENT = "(KHTML, like Gecko)";
function cleanElectronUserAgent(userAgent) {
  if (!userAgent.includes(CHROMIUM_ENGINE_COMMENT)) {
    return userAgent;
  }
  return userAgent.replace(/\s+Electron\/\S+/, "").replace(/(\)\s+)(?:[^)\s]+\s+)*?(Chrome\/)/, "$1$2");
}
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
function shouldUseGoogleAuthIdentity(url, referrer, resourceType) {
  if (isGoogleAuthUrl(url)) {
    return true;
  }
  return resourceType !== "mainFrame" && isGoogleAuthUrl(referrer);
}
function googleAuthUserAgent() {
  const platform = process.platform === "darwin" ? "Macintosh; Intel Mac OS X 10.15" : process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : "X11; Linux x86_64";
  return `Mozilla/5.0 (${platform}; rv:140.0) Gecko/20100101 Firefox/140.0`;
}
function stripClientHints(headers) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase().startsWith("sec-ch-ua")) {
      delete headers[key];
    }
  }
}
function setUserAgentHeader(headers, value) {
  const existing = Object.keys(headers).find((key) => key.toLowerCase() === "user-agent");
  headers[existing ?? "User-Agent"] = value;
}
function currentUserAgent(headers) {
  const existing = Object.keys(headers).find((key) => key.toLowerCase() === "user-agent");
  return existing ? headers[existing] : void 0;
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
    if (!normalizedUrl || normalizedUrl === ORCA_BROWSER_BLANK_URL || isFileUrl(normalizedUrl)) {
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
function registerAllowedBrowserPartitionSource(source) {
  sources.add(source);
  return () => {
    sources.delete(source);
  };
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
      const normalizedSrc = normalizeBrowserNavigationUrl(src);
      if (!isMainWindowContents(contents) || !normalizedSrc || isFileUrl(normalizedSrc) || !isAllowedBrowserPartition(partition)) {
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
      webPreferences.webviewTag = false;
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

// src/main/browser-profiles-installer.ts
var import_node_path16 = require("path");

// src/shared/browser-ipc-channels.ts
var BROWSER_PROFILE_INVOKE_CHANNELS = [
  "browser:session:listProfiles",
  "browser:session:createProfile",
  "browser:session:deleteProfile",
  "browser:session:importCookies",
  "browser:session:resolvePartition",
  "browser:session:clearDefaultCookies",
  "browser:session:detectBrowsers",
  "browser:session:importFromBrowser",
  "browser:identity:get",
  "browser:identity:set"
];

// src/main/browser/browser-identity-mode-store.ts
var import_node_crypto = require("crypto");
var import_node_fs4 = require("fs");
var import_node_path3 = require("path");

// src/main/durable-file-write.ts
var import_node_fs2 = require("fs");
var import_node_path = require("path");

// src/main/fs-utils.ts
var import_node_fs = require("fs");
function renameFileWithWindowsRetry(source, target) {
  runFileOperationWithWindowsRetry(() => (0, import_node_fs.renameSync)(source, target));
}
function copyFileWithWindowsRetry(source, target) {
  runFileOperationWithWindowsRetry(() => (0, import_node_fs.copyFileSync)(source, target));
}
function runFileOperationWithWindowsRetry(operation) {
  for (let attempt = 1; ; attempt++) {
    try {
      operation();
      return;
    } catch (error) {
      if (shouldRetryFileOperation(error, attempt)) {
        sleepSync(attempt * 50);
        continue;
      }
      throw error;
    }
  }
}
function shouldRetryFileOperation(error, attempt) {
  return process.platform === "win32" && attempt < 6 && error instanceof Error && "code" in error && (error.code === "EPERM" || error.code === "EACCES" || error.code === "EBUSY");
}
var sleepBuffer = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
  Atomics.wait(sleepBuffer, 0, 0, ms);
}

// src/main/durable-file-write.ts
function syncDirectoryDurablySync(directory) {
  let fd = null;
  try {
    fd = (0, import_node_fs2.openSync)(directory, "r");
    (0, import_node_fs2.fsyncSync)(fd);
  } catch {
  } finally {
    if (fd !== null) {
      try {
        (0, import_node_fs2.closeSync)(fd);
      } catch {
      }
    }
  }
}
function renameDurableSync(tmpPath, finalPath) {
  renameFileWithWindowsRetry(tmpPath, finalPath);
  syncDirectoryDurablySync((0, import_node_path.dirname)(finalPath));
}
function durableWriteTempPath(finalPath, owner) {
  const ownerSuffix = owner === void 0 ? "" : `.owner-${owner}`;
  return `${finalPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}${ownerSuffix}.tmp`;
}
function writeFileDurableSync(tmpPath, finalPath, payload, mode) {
  let renamed = false;
  try {
    (0, import_node_fs2.writeFileSync)(tmpPath, payload, mode === void 0 ? void 0 : { mode });
    const fd = (0, import_node_fs2.openSync)(tmpPath, "r+");
    try {
      (0, import_node_fs2.fsyncSync)(fd);
    } finally {
      (0, import_node_fs2.closeSync)(fd);
    }
    renameDurableSync(tmpPath, finalPath);
    renamed = true;
  } finally {
    if (!renamed) {
      (0, import_node_fs2.rmSync)(tmpPath, { force: true });
    }
  }
}

// src/main/browser/browser-identity-mode-record.ts
var import_node_fs3 = require("fs");
var import_node_path2 = require("path");
var BROWSER_IDENTITY_MODE_FILE = "browser-identity-mode.json";
var BROWSER_IDENTITY_MODE_VERSION = 1;
function browserIdentityModeRecordPath(userDataPath) {
  return (0, import_node_path2.join)(userDataPath, BROWSER_IDENTITY_MODE_FILE);
}
function unhealthyResult(state) {
  return {
    state,
    appliedMode: "clean",
    configuredMode: null,
    explicitSelection: null,
    migrationNoticePending: null
  };
}
function parseRecord(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return unhealthyResult("corrupt");
  }
  if (!isBrowserIdentityModeFileInput(parsed)) {
    return unhealthyResult("corrupt");
  }
  const { version, mode, explicitSelection, migrationNoticePending } = parsed;
  if (typeof version === "number" && version > BROWSER_IDENTITY_MODE_VERSION) {
    return unhealthyResult("future");
  }
  if (version !== BROWSER_IDENTITY_MODE_VERSION || mode !== "clean" && mode !== "native" || typeof explicitSelection !== "boolean" || typeof migrationNoticePending !== "boolean") {
    return unhealthyResult("corrupt");
  }
  return {
    state: "valid",
    appliedMode: mode,
    configuredMode: mode,
    explicitSelection,
    migrationNoticePending
  };
}
function readBrowserIdentityModeRecord(userDataPath) {
  try {
    return parseRecord((0, import_node_fs3.readFileSync)(browserIdentityModeRecordPath(userDataPath), "utf-8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        state: "missing",
        appliedMode: "clean",
        configuredMode: "clean",
        explicitSelection: false,
        migrationNoticePending: false
      };
    }
    return unhealthyResult("unreadable");
  }
}
function isBrowserIdentityModeFileInput(value) {
  return typeof value === "object" && value !== null;
}

// src/main/browser/browser-identity-mode-store.ts
var modeStore = null;
var snapshotListeners = /* @__PURE__ */ new Set();
var migrationNoticeDegraded = false;
var launchMigrationNoticePending = false;
function snapshotForRead(result) {
  return { ...result, restartRequired: false };
}
function writeRecord(userDataPath, record) {
  const filePath = browserIdentityModeRecordPath(userDataPath);
  (0, import_node_fs4.mkdirSync)((0, import_node_path3.dirname)(filePath), { recursive: true });
  writeFileDurableSync(
    durableWriteTempPath(filePath),
    filePath,
    `${JSON.stringify(record, null, 2)}
`
  );
}
function backupUnhealthyRecord(userDataPath) {
  const filePath = browserIdentityModeRecordPath(userDataPath);
  const bytes = (0, import_node_fs4.readFileSync)(filePath);
  const backupPath = `${filePath}.${Date.now()}.${(0, import_node_crypto.randomUUID)().slice(0, 8)}.bak`;
  if ((0, import_node_fs4.existsSync)(backupPath)) {
    throw new Error(`Browser identity backup ${backupPath} already exists`);
  }
  writeFileDurableSync(durableWriteTempPath(backupPath), backupPath, bytes);
  return backupPath;
}
function isBrowserIdentityModeStoreInitialized() {
  return modeStore !== null;
}
function initializeBrowserIdentityModeStore(userDataPath) {
  if (modeStore) {
    throw new Error("Browser identity mode store was already initialized");
  }
  const snapshot = snapshotForRead(readBrowserIdentityModeRecord(userDataPath));
  modeStore = { userDataPath, snapshot };
  return snapshot;
}
function requireModeStore() {
  if (!modeStore) {
    throw new Error("Browser identity mode store is not initialized");
  }
  return modeStore;
}
function getBrowserIdentityModeSnapshot() {
  return requireModeStore().snapshot;
}
function getBrowserIdentityMigrationNotice() {
  const snapshot = requireModeStore().snapshot;
  return launchMigrationNoticePending || snapshot.migrationNoticePending === true ? { degraded: migrationNoticeDegraded } : null;
}
function getBrowserIdentityModeStatus() {
  return {
    identity: getBrowserIdentityModeSnapshot(),
    migrationNotice: getBrowserIdentityMigrationNotice()
  };
}
function notifySnapshotListeners(snapshot) {
  for (const listener of snapshotListeners) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error("[browser-identity] Snapshot listener failed:", error);
    }
  }
}
async function setBrowserIdentityMode(mode, options = {}) {
  const store = requireModeStore();
  const current2 = store.snapshot;
  if (current2.configuredMode === null) {
    if (!options.reset) {
      return {
        ok: false,
        error: {
          code: "browser_identity_reset_required",
          message: current2.state === "future" ? "Browser identity data was written by a newer Orca; update Orca, or reset it explicitly to overwrite it." : `Browser identity data is ${current2.state}; reset it explicitly to overwrite it.`
        },
        identity: current2
      };
    }
    try {
      backupUnhealthyRecord(store.userDataPath);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "browser_identity_backup_failed",
          message: error instanceof Error ? error.message : String(error)
        },
        identity: current2
      };
    }
  }
  const record = {
    version: BROWSER_IDENTITY_MODE_VERSION,
    mode,
    explicitSelection: true,
    migrationNoticePending: false
  };
  try {
    writeRecord(store.userDataPath, record);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "browser_identity_write_failed",
        message: error instanceof Error ? error.message : String(error)
      },
      identity: current2
    };
  }
  const identity2 = {
    state: "valid",
    appliedMode: current2.appliedMode,
    configuredMode: mode,
    explicitSelection: true,
    migrationNoticePending: false,
    restartRequired: mode !== current2.appliedMode
  };
  store.snapshot = identity2;
  launchMigrationNoticePending = false;
  migrationNoticeDegraded = false;
  notifySnapshotListeners(identity2);
  return { ok: true, identity: identity2 };
}
async function markBrowserIdentityMigrationNoticePending(userDataPath, degraded) {
  if (!modeStore) {
    initializeBrowserIdentityModeStore(userDataPath);
  }
  const store = requireModeStore();
  if (store.userDataPath !== userDataPath) {
    throw new Error("Browser identity mode store userData path changed");
  }
  const current2 = store.snapshot;
  if (current2.explicitSelection === true) {
    return false;
  }
  launchMigrationNoticePending = true;
  migrationNoticeDegraded ||= degraded;
  if (current2.configuredMode === null) {
    return false;
  }
  const record = {
    version: BROWSER_IDENTITY_MODE_VERSION,
    mode: current2.configuredMode,
    explicitSelection: current2.explicitSelection,
    migrationNoticePending: true
  };
  try {
    writeRecord(userDataPath, record);
  } catch (error) {
    console.error("[browser-identity] Could not persist retired profile notice:", error);
    return false;
  }
  store.snapshot = {
    state: "valid",
    appliedMode: current2.appliedMode,
    configuredMode: current2.configuredMode,
    explicitSelection: current2.explicitSelection,
    migrationNoticePending: true,
    restartRequired: current2.restartRequired
  };
  notifySnapshotListeners(store.snapshot);
  return true;
}

// src/main/browser/browser-session-registry.ts
var import_electron18 = require("electron");
var import_node_crypto2 = require("crypto");
var import_node_path7 = require("path");

// src/shared/orca-profiles.ts
var DEFAULT_LOCAL_ORCA_PROFILE_ID = "local-default";
var LEGACY_ORCA_BROWSER_SESSION_PARTITION_PREFIX = "persist:orca-browser-session-";
function profilePartitionHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function getOrcaProfileBrowserPartitionSegment(profileId) {
  const safe = profileId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48) || "profile";
  return `${safe}-${profilePartitionHash(profileId)}`;
}
function getOrcaProfileBrowserSessionPartition(profileId, browserSessionProfileId) {
  if (profileId === DEFAULT_LOCAL_ORCA_PROFILE_ID) {
    return `${LEGACY_ORCA_BROWSER_SESSION_PARTITION_PREFIX}${browserSessionProfileId}`;
  }
  return `persist:orca-profile-${getOrcaProfileBrowserPartitionSegment(
    profileId
  )}-browser-session-${browserSessionProfileId}`;
}

// src/main/browser/browser-session-cookie-staging.ts
var import_electron15 = require("electron");
var import_node_fs7 = require("fs");
var import_node_path6 = require("path");

// src/main/browser/browser-session-meta-store.ts
var import_node_fs5 = require("fs");
var import_node_path4 = require("path");
var BROWSER_SESSION_META_FILE_NAME = "browser-session-meta.json";
function loadBrowserSessionMeta(resolveMetadataPath, defaultPartition) {
  try {
    const raw = (0, import_node_fs5.readFileSync)(resolveMetadataPath(), "utf-8");
    const data = JSON.parse(raw);
    const legacyPendingCookieDbPath = typeof data?.pendingCookieDbPath === "string" ? data.pendingCookieDbPath : null;
    const pendingCookieImports = {};
    if (data && typeof data.pendingCookieImports === "object" && data.pendingCookieImports) {
      for (const [partition, entry] of Object.entries(data.pendingCookieImports)) {
        if (typeof entry === "string" || entry && typeof entry === "object" && typeof entry.format === "string" && typeof entry.path === "string") {
          pendingCookieImports[partition] = entry;
        }
      }
    }
    if (legacyPendingCookieDbPath && !pendingCookieImports[defaultPartition]) {
      pendingCookieImports[defaultPartition] = legacyPendingCookieDbPath;
    }
    return {
      defaultSource: data?.defaultSource ?? null,
      pendingCookieDbPath: legacyPendingCookieDbPath,
      pendingCookieImports,
      profiles: Array.isArray(data?.profiles) ? data.profiles : []
    };
  } catch {
    return {
      defaultSource: null,
      pendingCookieDbPath: null,
      pendingCookieImports: {},
      profiles: []
    };
  }
}
function persistBrowserSessionMeta(resolveMetadataPath, defaultPartition, updates) {
  try {
    const existing = loadBrowserSessionMeta(resolveMetadataPath, defaultPartition);
    const tmpPath = `${resolveMetadataPath()}.tmp`;
    (0, import_node_fs5.mkdirSync)((0, import_node_path4.dirname)(resolveMetadataPath()), { recursive: true });
    (0, import_node_fs5.writeFileSync)(tmpPath, JSON.stringify({ ...existing, ...updates }));
    (0, import_node_fs5.renameSync)(tmpPath, resolveMetadataPath());
  } catch {
  }
}

// src/main/browser/browser-session-persisted-profile-validation.ts
var BROWSER_SESSION_PROFILE_ID_RE = /^[\da-f-]{8}-[\da-f-]{4}-[\da-f-]{4}-[\da-f-]{4}-[\da-f-]{12}$/;
function isValidPersistedBrowserSessionProfile(profile, activeOrcaProfileId) {
  if (!profile || typeof profile !== "object") {
    return false;
  }
  const candidate = profile;
  return candidate.id !== "default" && candidate.scope !== "default" && typeof candidate.id === "string" && typeof candidate.partition === "string" && typeof candidate.label === "string" && isProfileOwnedSessionPartition(candidate.id, candidate.partition, activeOrcaProfileId);
}
function inspectRetiredBrowserSessionProfileUserAgentModes(profiles, activeOrcaProfileId) {
  let noticePending = false;
  let degraded = false;
  for (const profile of profiles) {
    if (!isRecord(profile) || !hasPersistedProfileUserAgentMode(profile)) {
      continue;
    }
    noticePending = true;
    const mode = profile.userAgentMode;
    if (mode !== "clean" && mode !== "native" || !isValidPersistedBrowserSessionProfile(profile, activeOrcaProfileId)) {
      degraded = true;
    }
  }
  return { noticePending, degraded };
}
function hasPersistedProfileUserAgentMode(profile) {
  return Object.hasOwn(profile, "userAgentMode");
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function isProfileOwnedSessionPartition(profileId, partition, activeOrcaProfileId) {
  return BROWSER_SESSION_PROFILE_ID_RE.test(profileId) && partition === getOrcaProfileBrowserSessionPartition(activeOrcaProfileId, profileId);
}

// src/main/browser/browser-cookie-staged-import.ts
var import_node_sqlite = require("sqlite");

// src/main/browser/browser-cookie-import-policy.ts
var import_node_net = require("net");
var import_tldts = require("tldts");
var GOOGLE_SOURCE_BOUND_COOKIE_NAMES = /* @__PURE__ */ new Set([
  "SIDCC",
  "__Secure-1PSIDCC",
  "__Secure-3PSIDCC",
  "__Secure-STRP",
  "AEC"
]);
function normalizeCookieDomain(domain) {
  const candidate = domain.trim().replace(/^\.+/, "");
  const isBracketedIpv6 = candidate.startsWith("[") && candidate.endsWith("]");
  if (!candidate || /[/\\@?#%]/.test(candidate) || !isBracketedIpv6 && candidate.includes(":")) {
    return null;
  }
  try {
    const parsed = new URL(`https://${candidate}/`);
    const normalized = parsed.hostname.toLowerCase();
    if (parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash || normalized.endsWith(".") || normalized.includes("..")) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}
var PUBLIC_SUFFIX_OPTIONS = { allowPrivateDomains: true };
function isListedSuffix(parsed) {
  return parsed.isIcann === true || parsed.isPrivate === true;
}
function registrableFamily(domain) {
  const host = normalizeCookieDomain(domain);
  if (!host) {
    return null;
  }
  if ((0, import_node_net.isIP)(host)) {
    return host;
  }
  if (host.startsWith("[") && host.endsWith("]") && (0, import_node_net.isIP)(host.slice(1, -1)) === 6) {
    return host;
  }
  const parsed = (0, import_tldts.parse)(host, PUBLIC_SUFFIX_OPTIONS);
  if (parsed.hostname === null) {
    return host;
  }
  if (parsed.domain === null) {
    return isListedSuffix(parsed) ? null : host;
  }
  return parsed.domain;
}
function normalizeCookieImportDomain(domain) {
  const normalized = normalizeCookieDomain(domain);
  if (!normalized) {
    return null;
  }
  const parsed = (0, import_tldts.parse)(normalized, PUBLIC_SUFFIX_OPTIONS);
  if (parsed.hostname === null) {
    return normalized.startsWith("[") && normalized.endsWith("]") ? normalized : null;
  }
  if (parsed.domain === null && isListedSuffix(parsed)) {
    return null;
  }
  return normalized;
}
var NON_TRANSPLANTABLE_DOMAINS = ["google.com"];
function isNonTransplantableCookieDomain(domain) {
  const normalized = normalizeCookieDomain(domain);
  if (!normalized) {
    return false;
  }
  return NON_TRANSPLANTABLE_DOMAINS.some(
    (root) => normalized === root || normalized.endsWith(`.${root}`)
  );
}
function isGoogleSourceBoundCookie(name, domain) {
  if (!GOOGLE_SOURCE_BOUND_COOKIE_NAMES.has(name)) {
    return false;
  }
  const normalized = normalizeCookieDomain(domain);
  return normalized === "google.com" || normalized?.endsWith(".google.com") === true;
}
function domainSuffixes(domain) {
  const labels = domain.split(".");
  return labels.map((_, index) => labels.slice(index).join("."));
}
function importDomainAncestors(domain) {
  const parsed = (0, import_tldts.parse)(domain, PUBLIC_SUFFIX_OPTIONS);
  const boundary = parsed.hostname === null ? domain : parsed.domain ?? domain;
  const ancestors = [];
  for (const suffix of domainSuffixes(domain)) {
    ancestors.push(suffix);
    if (suffix === boundary) {
      break;
    }
  }
  return ancestors;
}
function importedDomainScope(domains) {
  const exact = /* @__PURE__ */ new Set();
  const ancestors = /* @__PURE__ */ new Set();
  const descendantRoots = /* @__PURE__ */ new Set();
  const seen = /* @__PURE__ */ new Set();
  for (const domain of domains) {
    const candidate = normalizeCookieDomain(domain);
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    const normalized = normalizeCookieImportDomain(candidate);
    if (!normalized || exact.has(normalized)) {
      continue;
    }
    exact.add(normalized);
    if (normalized.includes(".")) {
      descendantRoots.add(normalized);
    }
    for (const suffix of importDomainAncestors(normalized)) {
      ancestors.add(suffix);
    }
  }
  return { exact, ancestors, descendantRoots };
}
function domainIsInImportedScope(scope, domain, hostOnly) {
  if (scope.exact.has(domain)) {
    return true;
  }
  if (!hostOnly && scope.ancestors.has(domain)) {
    return true;
  }
  return domainSuffixes(domain).some((suffix) => scope.descendantRoots.has(suffix));
}
function cookieRemovalUrl(cookie, normalizedDomain) {
  const url = new URL(`${cookie.secure ? "https" : "http"}://${normalizedDomain}/`);
  url.pathname = cookie.path?.startsWith("/") ? cookie.path : "/";
  return url.toString();
}
function replaceRemovalKey(url, name) {
  return JSON.stringify([url, name]);
}
function assertIdentitiesCoverRemovable(removable, identities) {
  const covered = new Set(
    identities.map((identity2) => replaceRemovalKey(identity2.url, identity2.name))
  );
  for (const item of removable) {
    if (!covered.has(replaceRemovalKey(item.url, item.cookie.name))) {
      throw new Error("Could not replace existing cookies; the session was left unchanged");
    }
  }
}
async function replaceCookiesForImportedDomains(store, importedDomains) {
  const scope = importedDomainScope(importedDomains);
  if (scope.exact.size === 0) {
    return { removed: [], identities: [] };
  }
  const existingCookies = await store.get({});
  const removable = [];
  for (const cookie of existingCookies) {
    const domain = cookie.domain ? normalizeCookieDomain(cookie.domain) : null;
    if (!domain || !domainIsInImportedScope(scope, domain, cookie.hostOnly === true)) {
      continue;
    }
    removable.push({ cookie, url: cookieRemovalUrl(cookie, domain) });
  }
  if (removable.length === 0) {
    return { removed: [], identities: [] };
  }
  const identities = await store.snapshotClearIdentities(removable);
  assertIdentitiesCoverRemovable(removable, identities);
  const identitiesByKey = /* @__PURE__ */ new Map();
  for (const identity2 of identities) {
    const key = replaceRemovalKey(identity2.url, identity2.name);
    const group = identitiesByKey.get(key) ?? [];
    group.push(identity2);
    identitiesByKey.set(key, group);
  }
  const removed = [];
  const attemptedKeys = /* @__PURE__ */ new Set();
  const attemptedIdentities = [];
  for (const { cookie, url } of removable) {
    const key = replaceRemovalKey(url, cookie.name);
    if (!attemptedKeys.has(key)) {
      attemptedKeys.add(key);
      attemptedIdentities.push(...identitiesByKey.get(key) ?? []);
    }
    try {
      await store.remove(url, cookie.name);
      removed.push(cookie);
    } catch (err) {
      try {
        await store.restoreClearIdentities(attemptedIdentities.toReversed());
      } catch (restoreError) {
        throw new AggregateError([err, restoreError], "Cookie replacement and rollback failed");
      }
      throw err;
    }
  }
  return { removed, identities };
}

// src/main/browser/browser-cookie-staged-import.ts
var IMPORT_SCOPE_TABLE = "orca_cookie_import_scope";
var IMPORT_SCOPE_FORMAT_VERSION = 1;
var SCOPED_COOKIE_IMPORT_FORMAT = `scoped-v${IMPORT_SCOPE_FORMAT_VERSION}`;
function quotedIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
function cookieColumns(database, schema) {
  return database.prepare(`PRAGMA ${schema}.table_info(cookies)`).all().map((row) => row.name).filter((name) => typeof name === "string");
}
function cookieTableSql(database, schema) {
  const row = database.prepare(`SELECT sql FROM ${schema}.sqlite_master WHERE type = 'table' AND name = 'cookies'`).get();
  return typeof row?.sql === "string" ? row.sql : null;
}
function isHostKeyInScope(hostKey, scope) {
  if (typeof hostKey !== "string" || isNonTransplantableCookieDomain(hostKey)) {
    return false;
  }
  const domain = normalizeCookieDomain(hostKey);
  return domain !== null && domainIsInImportedScope(scope, domain, !hostKey.startsWith("."));
}
function readImportedScope(database, schema) {
  const marker = database.prepare(`SELECT 1 AS present FROM ${schema}.sqlite_master WHERE type = 'table' AND name = ?`).get(IMPORT_SCOPE_TABLE);
  if (!marker) {
    return null;
  }
  const scopeRows = database.prepare(
    `SELECT domain, format_version FROM ${schema}.${quotedIdentifier(
      IMPORT_SCOPE_TABLE
    )} ORDER BY domain`
  ).all();
  const scopeDomains = [];
  for (const row of scopeRows) {
    if (row.format_version !== IMPORT_SCOPE_FORMAT_VERSION || typeof row.domain !== "string" || normalizeCookieImportDomain(row.domain) !== row.domain) {
      throw new Error("Staged cookie import has an invalid domain scope");
    }
    scopeDomains.push(row.domain);
  }
  if (scopeDomains.length === 0) {
    throw new Error("Staged cookie import has an invalid domain scope");
  }
  return importedDomainScope(scopeDomains);
}
function prepareStagedCookiesForImport(stagingDb, importScope) {
  if (importScope.exact.size === 0) {
    return;
  }
  stagingDb.exec(
    `CREATE TABLE IF NOT EXISTS ${quotedIdentifier(IMPORT_SCOPE_TABLE)} (domain TEXT PRIMARY KEY, format_version INTEGER NOT NULL)`
  );
  stagingDb.exec(`DELETE FROM ${quotedIdentifier(IMPORT_SCOPE_TABLE)}`);
  const insertScope = stagingDb.prepare(
    `INSERT INTO ${quotedIdentifier(IMPORT_SCOPE_TABLE)} (domain, format_version) VALUES (?, ?)`
  );
  for (const domain of importScope.exact) {
    insertScope.run(domain, IMPORT_SCOPE_FORMAT_VERSION);
  }
  const hostKeys = stagingDb.prepare("SELECT DISTINCT host_key FROM cookies").all().map((row) => row.host_key);
  const deleteByHostKey = stagingDb.prepare("DELETE FROM cookies WHERE host_key = ?");
  for (const hostKey of hostKeys) {
    if (isHostKeyInScope(hostKey, importScope)) {
      deleteByHostKey.run(hostKey);
    }
  }
}
function isScopedStagedCookieImport(stagedCookiesPath) {
  const database = new import_node_sqlite.DatabaseSync(stagedCookiesPath, { readOnly: true });
  try {
    return readImportedScope(database, "main") !== null;
  } finally {
    database.close();
  }
}
function removeCookieImportScopeMarker(liveCookiesPath) {
  const database = new import_node_sqlite.DatabaseSync(liveCookiesPath, { timeout: 1e3 });
  try {
    database.exec(`DROP TABLE IF EXISTS ${quotedIdentifier(IMPORT_SCOPE_TABLE)}`);
  } finally {
    database.close();
  }
}
function applyScopedStagedCookieImport(liveCookiesPath, stagedCookiesPath) {
  const database = new import_node_sqlite.DatabaseSync(liveCookiesPath, { timeout: 1e3 });
  let attached = false;
  let transactionOpen = false;
  try {
    database.prepare("ATTACH DATABASE ? AS staged_import").run(stagedCookiesPath);
    attached = true;
    const scope = readImportedScope(database, "staged_import");
    if (!scope) {
      return false;
    }
    const liveColumns = cookieColumns(database, "main");
    const stagedColumns = cookieColumns(database, "staged_import");
    if (!liveColumns.includes("host_key") || cookieTableSql(database, "main") !== cookieTableSql(database, "staged_import") || liveColumns.length !== stagedColumns.length || liveColumns.some((column, index) => column !== stagedColumns[index])) {
      throw new Error("Staged cookie import has an incompatible cookie schema");
    }
    const columnList = liveColumns.map(quotedIdentifier).join(", ");
    database.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const hostKeys = database.prepare("SELECT host_key FROM main.cookies UNION SELECT host_key FROM staged_import.cookies").all();
    const deleteLiveHost = database.prepare("DELETE FROM main.cookies WHERE host_key = ?");
    const insertStagedHost = database.prepare(
      `INSERT OR REPLACE INTO main.cookies (${columnList}) SELECT ${columnList} FROM staged_import.cookies WHERE host_key = ?`
    );
    for (const { host_key: hostKey } of hostKeys) {
      if (!isHostKeyInScope(hostKey, scope)) {
        continue;
      }
      deleteLiveHost.run(hostKey);
      insertStagedHost.run(hostKey);
    }
    database.exec(`DROP TABLE IF EXISTS main.${quotedIdentifier(IMPORT_SCOPE_TABLE)}`);
    database.exec("COMMIT");
    transactionOpen = false;
    return true;
  } catch (error) {
    if (transactionOpen) {
      try {
        database.exec("ROLLBACK");
      } catch {
      }
    }
    throw error;
  } finally {
    if (attached) {
      try {
        database.exec("DETACH DATABASE staged_import");
      } catch {
      }
    }
    database.close();
  }
}

// src/main/browser/chromium-cookie-path.ts
var import_node_fs6 = require("fs");
var import_node_path5 = require("path");
function resolveChromiumCookiesPath(profileDir) {
  const networkPath = (0, import_node_path5.join)(profileDir, "Network", "Cookies");
  if ((0, import_node_fs6.existsSync)(networkPath)) {
    return networkPath;
  }
  const legacyPath = (0, import_node_path5.join)(profileDir, "Cookies");
  return (0, import_node_fs6.existsSync)(legacyPath) ? legacyPath : null;
}

// src/main/browser/browser-session-cookie-staging.ts
function supportsPendingBrowserCookieImportReplay(_partition) {
  return true;
}
function unlinkStagedCookieDb(stagedPath) {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      (0, import_node_fs7.unlinkSync)(stagedPath + suffix);
    } catch {
    }
  }
}
function legacyPendingPath(entry) {
  return typeof entry === "string" ? entry : null;
}
function scopedPendingPath(entry) {
  return typeof entry !== "string" && entry.format === SCOPED_COOKIE_IMPORT_FORMAT ? entry.path : null;
}
function partitionCookiesPath(partition) {
  const partitionName = partition.replace("persist:", "");
  const partitionDir = (0, import_node_path6.join)(import_electron15.app.getPath("userData"), "Partitions", partitionName);
  return resolveChromiumCookiesPath(partitionDir) ?? (0, import_node_path6.join)(partitionDir, "Cookies");
}
function consumeStagedCookieImport(stagedPath) {
  const consumedPath = `${stagedPath}.consumed`;
  renameFileWithWindowsRetry(stagedPath, consumedPath);
  for (const path of [consumedPath, `${stagedPath}-wal`, `${stagedPath}-shm`]) {
    try {
      (0, import_node_fs7.unlinkSync)(path);
    } catch {
    }
  }
}
function applyPendingBrowserCookieImports({
  resolveMetadataPath,
  defaultPartition,
  activeOrcaProfileId
}) {
  try {
    const meta = loadBrowserSessionMeta(resolveMetadataPath, defaultPartition);
    const pendingEntries = Object.entries(meta.pendingCookieImports);
    if (pendingEntries.length === 0) {
      return;
    }
    const knownPartitions = /* @__PURE__ */ new Set([defaultPartition]);
    for (const profile of meta.profiles) {
      if (isValidPersistedBrowserSessionProfile(profile, activeOrcaProfileId)) {
        knownPartitions.add(profile.partition);
      }
    }
    const remainingEntries = { ...meta.pendingCookieImports };
    for (const [partition, pendingEntry] of pendingEntries) {
      if (!knownPartitions.has(partition)) {
        unlinkStagedCookieDb(typeof pendingEntry === "string" ? pendingEntry : pendingEntry.path);
        delete remainingEntries[partition];
        continue;
      }
      const scopedPath = scopedPendingPath(pendingEntry);
      const stagedPath = typeof pendingEntry === "string" ? pendingEntry : scopedPath;
      if (!stagedPath) {
        continue;
      }
      if (!(0, import_node_fs7.existsSync)(stagedPath)) {
        delete remainingEntries[partition];
        continue;
      }
      const liveCookiesPath = partitionCookiesPath(partition);
      try {
        (0, import_node_fs7.mkdirSync)((0, import_node_path6.join)(liveCookiesPath, ".."), { recursive: true });
        const liveCookiesExist = (0, import_node_fs7.existsSync)(liveCookiesPath);
        const markedScopedImage = isScopedStagedCookieImport(stagedPath);
        if (scopedPath && !markedScopedImage) {
          throw new Error("Scoped cookie import is missing its scope marker");
        }
        const copiedScopedImage = !liveCookiesExist && markedScopedImage;
        const appliedScopedImport = liveCookiesExist && markedScopedImage ? applyScopedStagedCookieImport(liveCookiesPath, stagedPath) : false;
        if (!appliedScopedImport) {
          (0, import_node_fs7.copyFileSync)(stagedPath, liveCookiesPath);
          let sidecarCopyFailed = false;
          for (const suffix of ["-wal", "-shm"]) {
            try {
              (0, import_node_fs7.unlinkSync)(liveCookiesPath + suffix);
            } catch {
            }
            const stagingSidecar = stagedPath + suffix;
            if (!(0, import_node_fs7.existsSync)(stagingSidecar)) {
              continue;
            }
            try {
              (0, import_node_fs7.copyFileSync)(stagingSidecar, liveCookiesPath + suffix);
            } catch {
              sidecarCopyFailed = true;
            }
          }
          if (sidecarCopyFailed) {
            continue;
          }
          if (copiedScopedImage) {
            removeCookieImportScopeMarker(liveCookiesPath);
          }
        }
        consumeStagedCookieImport(stagedPath);
        delete remainingEntries[partition];
      } catch {
      }
    }
    persistBrowserSessionMeta(resolveMetadataPath, defaultPartition, {
      pendingCookieImports: remainingEntries,
      pendingCookieDbPath: legacyPendingPath(remainingEntries[defaultPartition])
    });
  } catch {
  }
}
function setPendingBrowserCookieImport({
  resolveMetadataPath,
  defaultPartition,
  partition,
  stagingDbPath
}) {
  const meta = loadBrowserSessionMeta(resolveMetadataPath, defaultPartition);
  const pendingCookieImports = {
    ...meta.pendingCookieImports,
    [partition]: { format: SCOPED_COOKIE_IMPORT_FORMAT, path: stagingDbPath }
  };
  persistBrowserSessionMeta(resolveMetadataPath, defaultPartition, {
    pendingCookieImports,
    pendingCookieDbPath: legacyPendingPath(pendingCookieImports[defaultPartition])
  });
}
function clearPendingBrowserCookieImport({
  resolveMetadataPath,
  defaultPartition,
  partition
}) {
  const meta = loadBrowserSessionMeta(resolveMetadataPath, defaultPartition);
  if (!(partition in meta.pendingCookieImports)) {
    return;
  }
  const pendingCookieImports = { ...meta.pendingCookieImports };
  const pendingEntry = pendingCookieImports[partition];
  const stagedPath = typeof pendingEntry === "string" ? pendingEntry : pendingEntry.path;
  if ((0, import_node_fs7.existsSync)(stagedPath)) {
    try {
      consumeStagedCookieImport(stagedPath);
    } catch {
    }
  }
  delete pendingCookieImports[partition];
  persistBrowserSessionMeta(resolveMetadataPath, defaultPartition, {
    pendingCookieImports,
    pendingCookieDbPath: legacyPendingPath(pendingCookieImports[defaultPartition])
  });
  unlinkStagedCookieDb(stagedPath);
}

// src/main/browser/browser-session-partition-policies.ts
var import_electron17 = require("electron");

// src/main/browser/browser-media-access.ts
var import_electron16 = require("electron");
function requestedMediaTypes(details) {
  return new Set(details?.mediaTypes ?? []);
}
function hasSystemMediaAccess(mediaType) {
  if (process.platform !== "darwin") {
    return true;
  }
  if (mediaType === "audio") {
    return import_electron16.systemPreferences.getMediaAccessStatus("microphone") === "granted";
  }
  if (mediaType === "video") {
    return import_electron16.systemPreferences.getMediaAccessStatus("camera") === "granted";
  }
  return false;
}
async function requestSystemMediaAccess(details) {
  if (process.platform !== "darwin") {
    return true;
  }
  const mediaTypes = requestedMediaTypes(details);
  if (mediaTypes.size === 0) {
    return false;
  }
  if (mediaTypes.has("audio")) {
    const granted = await import_electron16.systemPreferences.askForMediaAccess("microphone");
    if (!granted) {
      return false;
    }
  }
  if (mediaTypes.has("video")) {
    const granted = await import_electron16.systemPreferences.askForMediaAccess("camera");
    if (!granted) {
      return false;
    }
  }
  return true;
}

// src/main/browser/browser-session-permission-policy.ts
var AUTO_GRANTED_BROWSER_PERMISSIONS = /* @__PURE__ */ new Set([
  "fullscreen",
  // Agent-browser clipboard commands execute via CDP in this session; denying
  // them breaks trusted runtime commands even when invoked with a user gesture.
  "clipboard-read",
  "clipboard-sanitized-write",
  // User-opened browser pages need these profile-scoped grants to complete
  // normal site flows like web push setup and durable app storage.
  "notifications",
  // Chromium can request this at runtime even though Electron's TS union does
  // not list it; chatgpt.com uses it to keep browser storage from eviction.
  "persistent-storage",
  // Chromium still requires user activation, so this only removes Orca's
  // otherwise unactionable denial for immersive browser apps.
  "pointerLock",
  // Orca allows unpartitioned third-party cookies, so cross-site frames already send them; denying
  // this only rejected the API and burned the caller's user gesture. Not cookies-only: the same
  // permission also hands requestStorageAccess({localStorage: true}) a handle onto unpartitioned
  // localStorage/IndexedDB, though ambient globals stay partitioned. Chrome grants the same
  // permission under the same cookie policy, so this is parity. Electron has no auto-grant, so
  // the embedder must answer, and check must agree with request or compliant sites fall back to
  // the gesture path. Revisit if Orca ever gains a cookie or storage-partitioning control: the
  // handle is gated separately and would survive, but Electron never writes the STORAGE_ACCESS
  // content setting, so cookie access would stay blocked while the promise still resolved — and
  // sites that reload on success would loop.
  "storage-access"
]);
function isAutoGrantedBrowserSessionPermission(permission) {
  return AUTO_GRANTED_BROWSER_PERMISSIONS.has(permission);
}

// src/main/browser/browser-session-ua.ts
function quoteClientHint(value) {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}
function formatClientHintBrands(brands) {
  return brands.map(({ brand, version }) => `${quoteClientHint(brand)};v=${quoteClientHint(version)}`).join(", ");
}
function applyUserAgentMetadataHeaders(headers, metadata) {
  const values = {
    "sec-ch-ua": formatClientHintBrands(metadata.brands),
    "sec-ch-ua-full-version-list": formatClientHintBrands(metadata.fullVersionList),
    "sec-ch-ua-full-version": quoteClientHint(metadata.fullVersion),
    "sec-ch-ua-platform": quoteClientHint(metadata.platform),
    "sec-ch-ua-platform-version": quoteClientHint(metadata.platformVersion),
    "sec-ch-ua-arch": quoteClientHint(metadata.architecture),
    "sec-ch-ua-model": quoteClientHint(metadata.model),
    "sec-ch-ua-mobile": metadata.mobile ? "?1" : "?0"
  };
  for (const key of Object.keys(headers)) {
    const lowerKey = key.toLowerCase();
    if (!lowerKey.startsWith("sec-ch-ua")) {
      continue;
    }
    const value = values[lowerKey];
    if (value === void 0) {
      delete headers[key];
    } else {
      headers[key] = value;
    }
  }
}
function installBrowserSessionUserAgentPolicy(sess, resolveRequestUserAgent) {
  const firefoxUa = googleAuthUserAgent();
  sess.webRequest.onBeforeSendHeaders(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (details, callback) => {
      const headers = details.requestHeaders;
      const requestUserAgent = currentUserAgent(headers);
      let effectiveUserAgent;
      try {
        effectiveUserAgent = details.webContents?.getUserAgent();
      } catch {
      }
      if (getBrowserProcessUserAgentIdentity().mode === "clean" && shouldUseGoogleAuthIdentity(details.url, details.referrer ?? "", details.resourceType ?? "")) {
        setUserAgentHeader(headers, firefoxUa);
        stripClientHints(headers);
        callback({ requestHeaders: headers });
        return;
      }
      const identity2 = resolveRequestUserAgent?.({
        session: sess,
        url: details.url,
        referrer: details.referrer,
        resourceType: details.resourceType,
        webContentsId: details.webContentsId,
        currentUserAgent: requestUserAgent,
        effectiveUserAgent
      });
      if (!identity2) {
        callback({ requestHeaders: headers });
        return;
      }
      setUserAgentHeader(headers, identity2.userAgent);
      if (identity2.kind === "google-auth") {
        stripClientHints(headers);
      } else if (identity2.kind === "mobile") {
        applyUserAgentMetadataHeaders(headers, identity2.userAgentMetadata);
      }
      callback({ requestHeaders: headers });
    }
  );
  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    sess.webRequest.onBeforeSendHeaders(null);
  };
}

// src/main/browser/browser-session-partition-policies.ts
var configuredPartitions = /* @__PURE__ */ new Set();
var userAgentPolicyDisposerBySession = /* @__PURE__ */ new WeakMap();
function retireBrowserSessionUserAgentPolicy(sess) {
  const dispose = userAgentPolicyDisposerBySession.get(sess);
  if (!dispose) {
    return;
  }
  userAgentPolicyDisposerBySession.delete(sess);
  dispose();
}
function configureBrowserSessionUserAgentPolicy(sess, installExceptions) {
  const mode = getBrowserIdentityModeSnapshot().appliedMode;
  sess.setUserAgent(
    mode === "clean" ? cleanElectronUserAgent(sess.getUserAgent()) : sess.getUserAgent()
  );
  if (!installExceptions) {
    retireBrowserSessionUserAgentPolicy(sess);
    return;
  }
  if (userAgentPolicyDisposerBySession.has(sess)) {
    return;
  }
  userAgentPolicyDisposerBySession.set(
    sess,
    installBrowserSessionUserAgentPolicy(
      sess,
      (request) => browserManager.resolveBrowserGuestRequestUserAgent(request)
    )
  );
}
function forgetBrowserSessionPartitionConfiguration(partition) {
  configuredPartitions.delete(partition);
}
function resolvePermissionNoticeUrl(webContents10, details) {
  const requestingUrl = details?.requestingUrl;
  if (!requestingUrl) {
    return webContents10.getURL();
  }
  try {
    return new URL(requestingUrl).origin === "null" ? "" : requestingUrl;
  } catch {
    return "";
  }
}
async function installBrowserSessionPartitionPolicies(profile, options = {}) {
  const { partition } = profile;
  const sess = import_electron17.session.fromPartition(partition);
  configureBrowserSessionUserAgentPolicy(sess, options.userAgentExceptions !== false);
  if (configuredPartitions.has(partition)) {
    return;
  }
  sess.setPermissionRequestHandler((webContents10, permission, callback, details) => {
    if (permission === "media") {
      const rawUrl = resolvePermissionNoticeUrl(webContents10, details);
      void requestSystemMediaAccess(
        details
      ).then(
        (granted) => {
          if (!granted) {
            browserManager.notifyPermissionDenied({
              guestWebContentsId: webContents10.id,
              permission,
              rawUrl
            });
          }
          callback(granted);
        },
        (error) => {
          console.error("[permissions] Browser media access failed:", error);
          browserManager.notifyPermissionDenied({
            guestWebContentsId: webContents10.id,
            permission,
            rawUrl
          });
          callback(false);
        }
      );
      return;
    }
    const allowed = isAutoGrantedBrowserSessionPermission(permission);
    if (!allowed) {
      const rawUrl = resolvePermissionNoticeUrl(webContents10, details);
      browserManager.notifyPermissionDenied({
        guestWebContentsId: webContents10.id,
        permission,
        rawUrl
      });
    }
    callback(allowed);
  });
  sess.setPermissionCheckHandler((_webContents, permission, _origin, details) => {
    if (permission === "media") {
      return hasSystemMediaAccess(details?.mediaType);
    }
    return isAutoGrantedBrowserSessionPermission(permission);
  });
  sess.setDisplayMediaRequestHandler((_request, callback) => {
    callback({ video: void 0, audio: void 0 });
  });
  configuredPartitions.add(partition);
}
function clearBrowserSessionPartitionPolicies(partition, sess) {
  retireBrowserSessionUserAgentPolicy(sess);
  configuredPartitions.delete(partition);
  sess.setPermissionRequestHandler(null);
  sess.setPermissionCheckHandler(null);
  sess.setDisplayMediaRequestHandler(null);
}

// src/main/browser/browser-session-profile-retirement.ts
async function retireFailedBrowserSessionProfile(partition, sess) {
  try {
    clearBrowserSessionPartitionPolicies(partition, sess);
  } catch {
  }
}

// src/main/browser/browser-session-registry.ts
var BROWSER_DATA_DIR_NAME = "orca-browser";
var BrowserSessionRegistry = class {
  profiles = /* @__PURE__ */ new Map();
  activeOrcaProfileId = DEFAULT_LOCAL_ORCA_PROFILE_ID;
  defaultPartition = ORCA_BROWSER_PARTITION;
  userDataDir = null;
  constructor() {
    this.resetDefaultProfile();
  }
  // Why: the host's userData path is only known once the plugin is installed, so persistence stays
  // inert (and the default profile has no source) until this runs.
  configure(opts) {
    this.userDataDir = opts.userDataDir;
    this.profiles.clear();
    this.resetDefaultProfile();
  }
  /** Folder holding the plugin's own state files, including the identity record. */
  getDataDir() {
    if (!this.userDataDir) {
      throw new Error("Browser session registry is not configured");
    }
    return (0, import_node_path7.join)(this.userDataDir, BROWSER_DATA_DIR_NAME);
  }
  resetDefaultProfile() {
    const persisted = this.loadPersistedSource();
    this.profiles.set("default", {
      id: "default",
      scope: "default",
      partition: this.defaultPartition,
      label: "Default",
      source: persisted
    });
  }
  // Why: source metadata must persist across restarts (for the Settings import status) since the registry is in-memory only.
  get metadataPath() {
    return (0, import_node_path7.join)(this.getDataDir(), BROWSER_SESSION_META_FILE_NAME);
  }
  loadPersistedSource() {
    return this.loadPersistedMeta().defaultSource;
  }
  persistMeta(updates) {
    persistBrowserSessionMeta(() => this.metadataPath, this.defaultPartition, updates);
  }
  persistSource(source) {
    this.persistMeta({ defaultSource: source });
  }
  // Why: non-default profiles are in-memory only; without this they vanish on restart.
  persistProfiles() {
    const nonDefault = [...this.profiles.values()].filter((p) => p.id !== "default");
    this.persistMeta({ profiles: nonDefault });
  }
  loadPersistedMeta() {
    return loadBrowserSessionMeta(() => this.metadataPath, this.defaultPartition);
  }
  // Why: run before any webview loads, and set the UA before the first request or Electron's default UA invalidates imported cookies.
  // Why re-read defaultSource: the constructor runs before configure() (userData path unavailable), so loadPersistedSource() returned null.
  initializeBrowserSessionsFromPersistedState() {
    const meta = this.loadPersistedMeta();
    const migration = inspectRetiredBrowserSessionProfileUserAgentModes(
      meta.profiles,
      this.activeOrcaProfileId
    );
    if (migration.noticePending) {
      void markBrowserIdentityMigrationNoticePending(this.getDataDir(), migration.degraded).catch(
        (error) => console.error("[browser-identity] Migration notice failed:", error)
      );
    }
    if (meta.defaultSource) {
      const current2 = this.profiles.get("default");
      if (current2 && current2.source === null) {
        this.profiles.set("default", { ...current2, source: meta.defaultSource });
      }
    }
    if (meta.profiles.length > 0) {
      this.hydrateFromPersisted(meta.profiles);
    }
    const defaultProfile = this.getDefaultProfile();
    void installBrowserSessionPartitionPolicies(defaultProfile).catch(() => {
      console.warn(
        "[browser-session] Failed to apply policies to browser partition",
        defaultProfile.partition
      );
    });
  }
  // Why: must run before any session.fromPartition() so CookieMonster reads the staged cookies instead of overwriting them from its in-memory DB.
  applyPendingCookieImport() {
    applyPendingBrowserCookieImports({
      resolveMetadataPath: () => this.metadataPath,
      defaultPartition: this.defaultPartition,
      activeOrcaProfileId: this.activeOrcaProfileId
    });
  }
  setPendingCookieImport(partition, stagingDbPath) {
    setPendingBrowserCookieImport({
      resolveMetadataPath: () => this.metadataPath,
      defaultPartition: this.defaultPartition,
      partition,
      stagingDbPath
    });
  }
  // Why: a degraded import still rewrites the live session, so an older staged DB must stop replaying over it.
  clearPendingCookieImport(partition) {
    clearPendingBrowserCookieImport({
      resolveMetadataPath: () => this.metadataPath,
      defaultPartition: this.defaultPartition,
      partition
    });
  }
  getDefaultProfile() {
    return this.profiles.get("default");
  }
  getProfile(profileId) {
    return this.profiles.get(profileId) ?? null;
  }
  listProfiles() {
    return [...this.profiles.values()];
  }
  isAllowedPartition(partition) {
    if (partition === this.defaultPartition) {
      return true;
    }
    return [...this.profiles.values()].some((p) => p.partition === partition);
  }
  resolvePartition(profileId) {
    if (!profileId) {
      return this.defaultPartition;
    }
    return this.profiles.get(profileId)?.partition ?? this.defaultPartition;
  }
  resolveKnownPartition(profileId) {
    if (!profileId) {
      return this.defaultPartition;
    }
    return this.profiles.get(profileId)?.partition ?? null;
  }
  async createProfile(scope, label) {
    if (scope !== "isolated" && scope !== "imported") {
      return null;
    }
    const id = (0, import_node_crypto2.randomUUID)();
    const partition = getOrcaProfileBrowserSessionPartition(this.activeOrcaProfileId, id);
    const profile = {
      id,
      scope,
      partition,
      label,
      source: null
    };
    try {
      await installBrowserSessionPartitionPolicies(profile);
    } catch (error) {
      await retireFailedBrowserSessionProfile(partition, import_electron18.session.fromPartition(partition));
      throw error;
    }
    this.profiles.set(id, profile);
    this.persistProfiles();
    return profile;
  }
  updateProfileSource(profileId, source) {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return null;
    }
    const updated = { ...profile, source };
    this.profiles.set(profileId, updated);
    if (profileId === "default") {
      this.persistSource(source);
    } else {
      this.persistProfiles();
    }
    return updated;
  }
  async deleteProfile(profileId) {
    const profile = this.profiles.get(profileId);
    if (!profile || profile.scope === "default") {
      return false;
    }
    this.profiles.delete(profileId);
    this.persistProfiles();
    const meta = this.loadPersistedMeta();
    const pendingCookieImports = { ...meta.pendingCookieImports };
    delete pendingCookieImports[profile.partition];
    const defaultPendingImport = pendingCookieImports[this.defaultPartition];
    this.persistMeta({
      pendingCookieImports,
      pendingCookieDbPath: typeof defaultPendingImport === "string" ? defaultPendingImport : null
    });
    try {
      const sess = import_electron18.session.fromPartition(profile.partition);
      forgetBrowserSessionPartitionConfiguration(profile.partition);
      retireBrowserSessionUserAgentPolicy(sess);
      await sess.clearStorageData();
      await sess.clearCache();
    } catch {
    }
    return true;
  }
  // Why: lets users undo a cookie import without deleting the default profile itself.
  async clearDefaultSessionCookies() {
    try {
      const defaultProfile = this.profiles.get("default");
      if (defaultProfile) {
        this.profiles.set("default", { ...defaultProfile, source: null });
      }
      const meta = this.loadPersistedMeta();
      const pendingCookieImports = { ...meta.pendingCookieImports };
      delete pendingCookieImports[this.defaultPartition];
      this.persistMeta({
        defaultSource: null,
        pendingCookieDbPath: null,
        pendingCookieImports
      });
      const sess = import_electron18.session.fromPartition(this.defaultPartition);
      await sess.clearStorageData({ storages: ["cookies"] });
      return true;
    } catch {
      return false;
    }
  }
  hydrateFromPersisted(profiles) {
    for (const profile of profiles) {
      if (!isValidPersistedBrowserSessionProfile(profile, this.activeOrcaProfileId)) {
        continue;
      }
      this.profiles.set(profile.id, profile);
      if (profile.partition !== this.defaultPartition) {
        void installBrowserSessionPartitionPolicies(profile).catch(() => {
          console.warn(
            "[browser-session] Failed to apply policies to browser partition",
            profile.partition
          );
        });
      }
    }
  }
};
var browserSessionRegistry = new BrowserSessionRegistry();

// src/main/browser/browser-session-startup.ts
var initialized = false;
function initializeBrowserSessionsForApp(opts) {
  if (initialized) {
    return;
  }
  browserSessionRegistry.configure(opts);
  browserSessionRegistry.applyPendingCookieImport();
  browserSessionRegistry.initializeBrowserSessionsFromPersistedState();
  initialized = true;
}

// src/main/ipc/browser-session-profile-ipc.ts
var import_electron24 = require("electron");

// src/main/browser/browser-cookie-detection.ts
var import_node_fs9 = require("fs");
var import_node_path9 = require("path");

// src/main/browser/browser-cookie-detection-types.ts
var import_node_fs8 = require("fs");
var import_node_path8 = require("path");
var CHROMIUM_BROWSERS = [
  {
    family: "chrome",
    label: "Google Chrome",
    keychainService: "Chrome Safe Storage",
    keychainAccount: "Chrome",
    macRoot: "Google/Chrome",
    winRoot: "Google/Chrome/User Data",
    linuxRoot: "google-chrome"
  },
  {
    family: "edge",
    label: "Microsoft Edge",
    keychainService: "Microsoft Edge Safe Storage",
    keychainAccount: "Microsoft Edge",
    macRoot: "Microsoft Edge",
    winRoot: "Microsoft/Edge/User Data",
    linuxRoot: "microsoft-edge"
  },
  {
    family: "arc",
    label: "Arc",
    keychainService: "Arc Safe Storage",
    keychainAccount: "Arc",
    macRoot: "Arc/User Data"
  },
  {
    family: "chromium",
    label: "Brave",
    keychainService: "Brave Safe Storage",
    keychainAccount: "Brave",
    macRoot: "BraveSoftware/Brave-Browser",
    winRoot: "BraveSoftware/Brave-Browser/User Data",
    linuxRoot: "BraveSoftware/Brave-Browser"
  },
  {
    family: "comet",
    label: "Comet",
    keychainService: "Comet Safe Storage",
    keychainAccount: "Comet",
    macRoot: "Comet",
    winRoot: "Perplexity/Comet/User Data"
    // linuxRoot intentionally omitted — Comet does not ship a Linux build as of 2026-05-15
  },
  {
    family: "helium",
    // Why: Helium breaks the '<Browser> Safe Storage' convention — its Keychain service is literally 'Helium Storage Key'.
    label: "Helium",
    keychainService: "Helium Storage Key",
    keychainAccount: "Helium",
    macRoot: "net.imput.helium"
    // winRoot/linuxRoot intentionally omitted — only the macOS install is verified
  }
];
function browserRootPath(def) {
  if (process.platform === "darwin") {
    if (!def.macRoot) {
      return null;
    }
    const home = process.env.HOME ?? "";
    return (0, import_node_path8.join)(home, "Library", "Application Support", def.macRoot);
  }
  if (process.platform === "win32") {
    if (!def.winRoot) {
      return null;
    }
    const localAppData = process.env.LOCALAPPDATA ?? "";
    if (!localAppData) {
      return null;
    }
    return (0, import_node_path8.join)(localAppData, def.winRoot);
  }
  if (!def.linuxRoot) {
    return null;
  }
  const configHome = process.env.XDG_CONFIG_HOME ?? (0, import_node_path8.join)(process.env.HOME ?? "", ".config");
  return (0, import_node_path8.join)(configHome, def.linuxRoot);
}
function isSafeBrowserProfileDirectory(directory) {
  return directory.length > 0 && directory !== "." && !directory.includes("\0") && !directory.includes("/") && !directory.includes("\\") && !directory.includes("..");
}
function discoverProfiles(browserRoot) {
  try {
    const localStatePath = (0, import_node_path8.join)(browserRoot, "Local State");
    if (!(0, import_node_fs8.existsSync)(localStatePath)) {
      return [{ name: "Default", directory: "Default" }];
    }
    const raw = (0, import_node_fs8.readFileSync)(localStatePath, "utf-8");
    const localState = JSON.parse(raw);
    const infoCache = localState?.profile?.info_cache;
    if (!infoCache || typeof infoCache !== "object") {
      return [{ name: "Default", directory: "Default" }];
    }
    const profiles = [];
    for (const [dir, info] of Object.entries(infoCache)) {
      if (!isSafeBrowserProfileDirectory(dir)) {
        continue;
      }
      const profileName = info?.name ?? dir;
      profiles.push({ name: profileName, directory: dir });
    }
    return profiles.length > 0 ? profiles : [{ name: "Default", directory: "Default" }];
  } catch {
    return [{ name: "Default", directory: "Default" }];
  }
}
function firefoxProfilesRoot() {
  if (process.platform === "darwin") {
    const home2 = process.env.HOME ?? "";
    return (0, import_node_path8.join)(home2, "Library", "Application Support", "Firefox", "Profiles");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? "";
    return appData ? (0, import_node_path8.join)(appData, "Mozilla", "Firefox", "Profiles") : null;
  }
  const home = process.env.HOME ?? "";
  return (0, import_node_path8.join)(home, ".mozilla", "firefox");
}
function discoverFirefoxProfiles() {
  const profilesRoot = firefoxProfilesRoot();
  if (!profilesRoot) {
    return [];
  }
  try {
    if (!(0, import_node_fs8.existsSync)(profilesRoot)) {
      return [];
    }
    const entries = (0, import_node_fs8.readdirSync)(profilesRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    const sorted = entries.sort((a, b) => {
      if (a.includes("default-release")) {
        return -1;
      }
      if (b.includes("default-release")) {
        return 1;
      }
      if (a.includes("default")) {
        return -1;
      }
      if (b.includes("default")) {
        return 1;
      }
      return 0;
    });
    return sorted.map((dir) => {
      const label = dir.includes(".") ? dir.split(".").slice(1).join(".") : dir;
      return { name: label, directory: dir };
    });
  } catch {
    return [];
  }
}
function detectFirefox() {
  const profilesRoot = firefoxProfilesRoot();
  if (!profilesRoot) {
    return null;
  }
  const profiles = discoverFirefoxProfiles();
  for (const profile of profiles) {
    const cookiesPath = (0, import_node_path8.join)(profilesRoot, profile.directory, "cookies.sqlite");
    if ((0, import_node_fs8.existsSync)(cookiesPath)) {
      return {
        family: "firefox",
        label: "Firefox",
        cookiesPath,
        profiles,
        selectedProfile: profile.directory
      };
    }
  }
  return null;
}

// src/main/browser/browser-cookie-detection.ts
function detectSafari() {
  if (process.platform !== "darwin") {
    return null;
  }
  const home = process.env.HOME ?? "";
  const candidates = [
    (0, import_node_path9.join)(home, "Library", "Cookies", "Cookies.binarycookies"),
    (0, import_node_path9.join)(
      home,
      "Library",
      "Containers",
      "com.apple.Safari",
      "Data",
      "Library",
      "Cookies",
      "Cookies.binarycookies"
    )
  ];
  for (const candidate of candidates) {
    if ((0, import_node_fs9.existsSync)(candidate)) {
      return {
        family: "safari",
        label: "Safari",
        cookiesPath: candidate,
        profiles: [{ name: "Default", directory: "Default" }],
        selectedProfile: "Default"
      };
    }
  }
  return null;
}
function detectInstalledBrowsers() {
  const detected = [];
  for (const browser of CHROMIUM_BROWSERS) {
    const root = browserRootPath(browser);
    if (!root) {
      continue;
    }
    const profiles = discoverProfiles(root);
    for (const profile of profiles) {
      const profileDir = (0, import_node_path9.join)(root, profile.directory);
      const cookiesPath = resolveChromiumCookiesPath(profileDir);
      if (cookiesPath) {
        detected.push({
          family: browser.family,
          label: browser.label,
          keychainService: browser.keychainService,
          keychainAccount: browser.keychainAccount,
          cookiesPath,
          profiles,
          selectedProfile: profile.directory
        });
        break;
      }
    }
  }
  const firefox = detectFirefox();
  if (firefox) {
    detected.push(firefox);
  }
  const safari = detectSafari();
  if (safari) {
    detected.push(safari);
  }
  return detected;
}
function selectBrowserProfile(browser, profileDirectory) {
  if (!isSafeBrowserProfileDirectory(profileDirectory)) {
    return null;
  }
  if (browser.family === "firefox") {
    const profilesRoot = firefoxProfilesRoot();
    if (!profilesRoot) {
      return null;
    }
    const cookiesPath2 = (0, import_node_path9.join)(profilesRoot, profileDirectory, "cookies.sqlite");
    if (!(0, import_node_fs9.existsSync)(cookiesPath2)) {
      return null;
    }
    return { ...browser, cookiesPath: cookiesPath2, selectedProfile: profileDirectory };
  }
  const browserDef = CHROMIUM_BROWSERS.find((b) => b.family === browser.family);
  if (!browserDef) {
    return null;
  }
  const root = browserRootPath(browserDef);
  if (!root) {
    return null;
  }
  const profileDir = (0, import_node_path9.join)(root, profileDirectory);
  const cookiesPath = resolveChromiumCookiesPath(profileDir);
  if (!cookiesPath) {
    return null;
  }
  return {
    ...browser,
    cookiesPath,
    selectedProfile: profileDirectory
  };
}

// src/main/browser/browser-cookie-import-pipeline.ts
var import_electron21 = require("electron");

// src/shared/map-with-concurrency.ts
function mapWithConcurrency(items, limit, fn) {
  const workerCount = concurrencyWorkerCount(limit, items.length);
  if (items.length <= workerCount) {
    return Promise.all(items.map(fn));
  }
  const results = [];
  let nextIndex = 0;
  return Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await fn(items[index], index);
      }
    })
  ).then(() => results);
}
function mapSettledWithConcurrency(items, limit, fn) {
  return mapWithConcurrency(items, limit, async (item, index) => {
    try {
      return { status: "fulfilled", value: await fn(item, index) };
    } catch (reason) {
      return { status: "rejected", reason };
    }
  });
}
function concurrencyWorkerCount(limit, itemCount) {
  const normalizedLimit = limit === Number.POSITIVE_INFINITY ? itemCount : Number.isFinite(limit) ? Math.floor(limit) : 1;
  return Math.max(1, Math.min(normalizedLimit, itemCount));
}

// src/main/browser/browser-cookie-import-clear.ts
var COOKIE_CLEAR_CONCURRENCY = 8;
var mutationLocks = /* @__PURE__ */ new WeakMap();
function cookieClearKey(url, name) {
  return JSON.stringify([url, name]);
}
async function acquireCookieMutationLock(owner) {
  const previous = mutationLocks.get(owner) ?? Promise.resolve();
  let release;
  const current2 = new Promise((resolve) => {
    release = resolve;
  });
  mutationLocks.set(
    owner,
    previous.then(() => current2)
  );
  await previous;
  return release;
}
async function withCookieMutationLock(owner, run) {
  const release = await acquireCookieMutationLock(owner);
  try {
    return await run();
  } finally {
    release();
  }
}
function removableCookieEntries(cookies, preserveFamilies, importScope) {
  const removable = [];
  for (const cookie of cookies) {
    if (isNonTransplantableCookieDomain(cookie.domain ?? "")) {
      continue;
    }
    const scopedDomain = cookie.domain ? normalizeCookieDomain(cookie.domain) : null;
    if (scopedDomain === null || !domainIsInImportedScope(importScope, scopedDomain, cookie.hostOnly === true)) {
      continue;
    }
    if (preserveFamilies.size > 0) {
      const family = registrableFamily(cookie.domain ?? "");
      if (family !== null && preserveFamilies.has(family)) {
        continue;
      }
    }
    removable.push({ cookie, url: cookieRemovalUrl(cookie, scopedDomain) });
  }
  return removable;
}
function assertClearIdentitiesCoverRemovable(removable, identities) {
  const covered = new Set(identities.map((identity2) => cookieClearKey(identity2.url, identity2.name)));
  for (const item of removable) {
    if (!covered.has(cookieClearKey(item.url, item.cookie.name))) {
      throw new Error("Could not clear existing cookies; the session was left unchanged");
    }
  }
}
function groupRemovableCookies(removable) {
  const groups = /* @__PURE__ */ new Map();
  for (const item of removable) {
    const key = cookieClearKey(item.url, item.cookie.name);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}
async function restoreClearedCookies(targetSession, identities, failures) {
  try {
    await targetSession.restoreClearIdentities(identities.toReversed());
  } catch (restoreError) {
    throw new AggregateError(
      [...failures, restoreError],
      "Could not clear existing cookies; the session was left partially cleared"
    );
  }
  throw new AggregateError(
    failures,
    "Could not clear existing cookies; existing cookies were restored"
  );
}
async function removeTransplantableCookies(targetSession, preserveFamilies, importScope) {
  return withCookieMutationLock(targetSession, async () => {
    const store = targetSession.cookies;
    if (importScope.exact.size === 0) {
      return;
    }
    const initialCookies = await store.get({});
    if (initialCookies.length === 0) {
      return;
    }
    const initialRemovable = removableCookieEntries(initialCookies, preserveFamilies, importScope);
    if (initialRemovable.length === 0) {
      return;
    }
    const identities = await targetSession.snapshotClearIdentities(initialRemovable);
    assertClearIdentitiesCoverRemovable(initialRemovable, identities);
    const removalGroups = [...groupRemovableCookies(initialRemovable).values()];
    const results = await mapSettledWithConcurrency(
      removalGroups,
      COOKIE_CLEAR_CONCURRENCY,
      async (group) => {
        for (const { cookie, url } of group) {
          await store.remove(url, cookie.name);
        }
      }
    );
    const failures = results.flatMap(
      (result) => result.status === "rejected" ? [result.reason] : []
    );
    if (failures.length > 0) {
      await restoreClearedCookies(targetSession, identities, failures);
    }
  });
}

// src/main/browser/browser-cookie-clear-store.ts
var import_electron19 = require("electron");

// src/main/browser/electron-debugger-lease.ts
var debuggerLeases = /* @__PURE__ */ new WeakMap();
function acquireElectronDebugger(webContents10) {
  if (webContents10.isDestroyed()) {
    throw new Error("Browser tab is no longer available");
  }
  const dbg = webContents10.debugger;
  let state = debuggerLeases.get(webContents10);
  if (!state) {
    state = { attachedByLease: false, owners: /* @__PURE__ */ new Set() };
    debuggerLeases.set(webContents10, state);
  }
  if (!dbg.isAttached()) {
    dbg.attach("1.3");
    state.attachedByLease = true;
  }
  const owner = /* @__PURE__ */ Symbol("electron-debugger-lease");
  state.owners.add(owner);
  let released = false;
  return {
    release: () => {
      if (released) {
        return;
      }
      released = true;
      state.owners.delete(owner);
      if (state.owners.size > 0) {
        return;
      }
      debuggerLeases.delete(webContents10);
      if (!state.attachedByLease || !dbg.isAttached()) {
        return;
      }
      try {
        dbg.detach();
      } catch {
      }
    }
  };
}

// src/main/browser/browser-cookie-identity-restore.ts
async function restoreEveryCookieIdentity(identities, restore) {
  const failures = [];
  for (const identity2 of identities) {
    try {
      await restore(identity2);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, `Could not restore ${failures.length} cookie(s)`);
  }
}

// src/main/browser/browser-cookie-source-partition.ts
var CHROMIUM_PARTITION_SITE_COLUMN = "top_frame_site_key";
var CHROMIUM_CROSS_SITE_ANCESTOR_COLUMN = "has_cross_site_ancestor";
var UNPARTITIONED = { status: "unpartitioned" };
function readSqliteFlag(raw) {
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "bigint") {
    return raw === 0n ? false : raw === 1n ? true : null;
  }
  if (typeof raw === "number") {
    return raw === 0 ? false : raw === 1 ? true : null;
  }
  return null;
}
function normalizeCookiePartitionSite(raw) {
  try {
    const site = new URL(raw);
    if (site.protocol !== "http:" && site.protocol !== "https:" || !site.hostname || site.username || site.password || site.port || site.pathname !== "/" || site.search || site.hash) {
      return null;
    }
    return site.origin;
  } catch {
    return null;
  }
}
function readChromiumRowPartition(sourceRow, sourceColumns) {
  if (!sourceColumns.has(CHROMIUM_PARTITION_SITE_COLUMN)) {
    return UNPARTITIONED;
  }
  const rawSite = sourceRow[CHROMIUM_PARTITION_SITE_COLUMN];
  if (rawSite === "") {
    return UNPARTITIONED;
  }
  if (typeof rawSite !== "string") {
    return { status: "unreadable", reason: "partition site column was not text" };
  }
  const topLevelSite = normalizeCookiePartitionSite(rawSite);
  if (!topLevelSite) {
    return { status: "unreadable", reason: "partition site column was not a valid schemeful site" };
  }
  if (!sourceColumns.has(CHROMIUM_CROSS_SITE_ANCESTOR_COLUMN)) {
    return {
      status: "unreadable",
      reason: "source schema has no cross-site-ancestor column for a partitioned cookie"
    };
  }
  const hasCrossSiteAncestor = readSqliteFlag(sourceRow[CHROMIUM_CROSS_SITE_ANCESTOR_COLUMN]);
  if (hasCrossSiteAncestor === null) {
    return { status: "unreadable", reason: "cross-site-ancestor column was not an integer flag" };
  }
  return { status: "partitioned", partitionKey: { topLevelSite, hasCrossSiteAncestor } };
}
var FIREFOX_PARTITIONED_ATTRIBUTE_COLUMN = "isPartitionedAttributeSet";
function readFirefoxRowPartition(sourceRow, sourceColumns) {
  if (!sourceColumns.has(FIREFOX_PARTITIONED_ATTRIBUTE_COLUMN)) {
    return UNPARTITIONED;
  }
  const partitionedAttribute = readSqliteFlag(sourceRow[FIREFOX_PARTITIONED_ATTRIBUTE_COLUMN]);
  if (partitionedAttribute === false) {
    return UNPARTITIONED;
  }
  if (partitionedAttribute === null) {
    return { status: "unreadable", reason: "partitioned-attribute column was not an integer flag" };
  }
  return {
    status: "unreadable",
    reason: "Firefox partitioned-attribute cookie has no cross-site-ancestor bit to read"
  };
}
function readJsonCookiePartition(raw, partitionKeyOpaque = void 0) {
  if (partitionKeyOpaque === true) {
    return { status: "unreadable", reason: "partition key was opaque" };
  }
  if (partitionKeyOpaque !== void 0 && typeof partitionKeyOpaque !== "boolean") {
    return { status: "unreadable", reason: "partitionKeyOpaque was not a boolean" };
  }
  if (raw === void 0) {
    return UNPARTITIONED;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { status: "unreadable", reason: "partitionKey was not an object with both fields" };
  }
  const { topLevelSite, hasCrossSiteAncestor } = raw;
  if (typeof topLevelSite !== "string" || topLevelSite.length === 0) {
    return { status: "unreadable", reason: "partitionKey.topLevelSite was missing or not text" };
  }
  const normalizedTopLevelSite = normalizeCookiePartitionSite(topLevelSite);
  if (!normalizedTopLevelSite) {
    return {
      status: "unreadable",
      reason: "partitionKey.topLevelSite was not a valid schemeful site"
    };
  }
  if (typeof hasCrossSiteAncestor !== "boolean") {
    return {
      status: "unreadable",
      reason: "partitionKey.hasCrossSiteAncestor was missing or not a boolean"
    };
  }
  return {
    status: "partitioned",
    partitionKey: { topLevelSite: normalizedTopLevelSite, hasCrossSiteAncestor }
  };
}

// src/main/browser/browser-cookie-clear-store.ts
function findPartitionWebContents(targetSession) {
  return import_electron19.webContents.getAllWebContents().find((contents) => !contents.isDestroyed() && contents.session === targetSession);
}
function cdpSameSite(sameSite) {
  if (sameSite === "strict") {
    return "Strict";
  }
  if (sameSite === "no_restriction") {
    return "None";
  }
  return sameSite === "lax" ? "Lax" : void 0;
}
function electronSameSite(sameSite) {
  if (sameSite === "Strict" || sameSite === "None") {
    return sameSite === "Strict" ? "strict" : "no_restriction";
  }
  return sameSite === "Lax" ? "lax" : "unspecified";
}
function partitionKeyFromCdp(cookie) {
  const opaque = cookie.partitionKeyOpaque;
  if (opaque === true || opaque !== void 0 && typeof opaque !== "boolean") {
    throw new Error("Could not snapshot cookie identity for an atomic clear");
  }
  const partitionKey = cookie.partitionKey;
  if (partitionKey === void 0) {
    return void 0;
  }
  const topLevelSite = normalizeCookiePartitionSite(partitionKey?.topLevelSite ?? "");
  if (!topLevelSite || typeof partitionKey?.hasCrossSiteAncestor !== "boolean") {
    throw new Error("Could not snapshot cookie identity for an atomic clear");
  }
  return {
    topLevelSite,
    hasCrossSiteAncestor: partitionKey.hasCrossSiteAncestor
  };
}
function cookieScopeKey(name, domain, path, hostOnly) {
  const normalizedDomain = domain ? normalizeCookieDomain(domain) : null;
  return normalizedDomain ? JSON.stringify([name, normalizedDomain, path || "/", hostOnly]) : null;
}
function cdpCookieScopeKey(cookie) {
  return cookieScopeKey(cookie.name, cookie.domain, cookie.path, !cookie.domain?.startsWith("."));
}
function indexCdpCookies(cookies) {
  const index = /* @__PURE__ */ new Map();
  for (const cookie of cookies) {
    const key = cdpCookieScopeKey(cookie);
    if (!key) {
      continue;
    }
    const matches = index.get(key) ?? [];
    matches.push(cookie);
    index.set(key, matches);
  }
  return index;
}
function identityFromCdpCookie(url, cdpCookie) {
  const partitionKey = partitionKeyFromCdp(cdpCookie);
  return {
    url,
    name: cdpCookie.name,
    value: cdpCookie.value,
    domain: cdpCookie.domain,
    hostOnly: !cdpCookie.domain?.startsWith("."),
    path: cdpCookie.path,
    secure: cdpCookie.secure,
    httpOnly: cdpCookie.httpOnly,
    sameSite: electronSameSite(cdpCookie.sameSite),
    ...cdpCookie.session === true || cdpCookie.expires == null ? {} : { expirationDate: cdpCookie.expires },
    ...partitionKey ? { partitionKey } : {}
  };
}
function openHiddenCookieWindow(targetSession) {
  return new import_electron19.BrowserWindow({
    show: false,
    webPreferences: {
      session: targetSession,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
}
async function leaseHiddenCookieDebugger(targetSession) {
  const window = openHiddenCookieWindow(targetSession);
  try {
    await window.loadURL("data:text/html,<!doctype html><title>cookie-clear</title>");
    const contents = window.webContents;
    if (contents.isDestroyed()) {
      throw new Error("Could not attach to the cookie session for an atomic clear");
    }
    const lease = acquireElectronDebugger(contents);
    return {
      debugger: contents.debugger,
      dispose: () => {
        lease.release();
        window.destroy();
      }
    };
  } catch (error) {
    window.destroy();
    throw error;
  }
}
async function attachCookieClearSession(targetSession) {
  const existing = findPartitionWebContents(targetSession);
  if (!existing) {
    return leaseHiddenCookieDebugger(targetSession);
  }
  try {
    const lease = acquireElectronDebugger(existing);
    return { debugger: existing.debugger, dispose: () => lease.release() };
  } catch {
    return leaseHiddenCookieDebugger(targetSession);
  }
}
function cookieClearIdentitiesFromCdp(cookies, cdpCookies) {
  const identities = [];
  const seen = /* @__PURE__ */ new Set();
  const cdpCookieIndex = indexCdpCookies(cdpCookies);
  for (const item of cookies) {
    const key = cookieScopeKey(
      item.cookie.name,
      item.cookie.domain,
      item.cookie.path,
      item.cookie.hostOnly ?? !item.cookie.domain?.startsWith(".")
    );
    const matches = key ? cdpCookieIndex.get(key) ?? [] : [];
    if (matches.length === 0) {
      throw new Error("Could not snapshot cookie identity for an atomic clear");
    }
    for (const match of matches) {
      const key2 = JSON.stringify([
        item.url,
        match.name,
        match.domain,
        match.path,
        partitionKeyFromCdp(match) ?? null
      ]);
      if (seen.has(key2)) {
        continue;
      }
      seen.add(key2);
      identities.push(identityFromCdpCookie(item.url, match));
    }
  }
  return identities;
}
function cdpSetCookieParamsFromIdentity(identity2) {
  const sameSite = cdpSameSite(identity2.sameSite);
  return {
    url: identity2.url,
    name: identity2.name,
    value: identity2.value,
    ...identity2.hostOnly ? {} : { domain: identity2.domain },
    ...identity2.path ? { path: identity2.path } : {},
    secure: identity2.secure,
    httpOnly: identity2.httpOnly,
    ...sameSite ? { sameSite } : {},
    ...identity2.expirationDate ? { expires: identity2.expirationDate } : {},
    ...identity2.partitionKey ? { partitionKey: identity2.partitionKey } : {}
  };
}
function cdpCookiesFromCommand(value) {
  if (typeof value !== "object" || value === null || !("cookies" in value)) {
    return [];
  }
  const cookies = value.cookies;
  return Array.isArray(cookies) ? cookies : [];
}
function cdpSetCookieSucceeded(value) {
  if (typeof value !== "object" || value === null || !("success" in value)) {
    return true;
  }
  return value.success !== false;
}
async function snapshotClearIdentitiesFromCdp(cookieDebugger, cookies) {
  const result = await cookieDebugger.sendCommand("Network.getAllCookies");
  return cookieClearIdentitiesFromCdp(cookies, cdpCookiesFromCommand(result));
}
async function writeIdentityWithCdp(cookieDebugger, identity2, failureLabel) {
  const result = await cookieDebugger.sendCommand(
    "Network.setCookie",
    cdpSetCookieParamsFromIdentity(identity2)
  );
  if (!cdpSetCookieSucceeded(result)) {
    throw new Error(`Could not ${failureLabel} cookie ${identity2.name}`);
  }
}
function openCookieClearStore(targetSession) {
  let attached = null;
  let pendingAttach = null;
  let disposed = false;
  const attach = async () => {
    if (disposed) {
      throw new Error("Cookie clear store was disposed");
    }
    if (attached) {
      return attached;
    }
    if (pendingAttach) {
      return pendingAttach;
    }
    const pending = attachCookieClearSession(targetSession).then((session5) => {
      if (disposed) {
        session5.dispose();
        throw new Error("Cookie clear store was disposed during debugger attachment");
      }
      attached = session5;
      return session5;
    });
    pendingAttach = pending;
    try {
      return await pending;
    } finally {
      if (pendingAttach === pending) {
        pendingAttach = null;
      }
    }
  };
  return {
    get: (filter) => targetSession.cookies.get(filter),
    remove: (url, name) => targetSession.cookies.remove(url, name),
    snapshotClearIdentities: async (cookies) => snapshotClearIdentitiesFromCdp((await attach()).debugger, cookies),
    restoreClearIdentities: async (identities) => {
      const cookieDebugger = (await attach()).debugger;
      await restoreEveryCookieIdentity(
        identities,
        (identity2) => writeIdentityWithCdp(cookieDebugger, identity2, "restore")
      );
    },
    writeCookieIdentity: async (identity2) => writeIdentityWithCdp((await attach()).debugger, identity2, "import"),
    dispose: () => {
      disposed = true;
      pendingAttach = null;
      attached?.dispose();
      attached = null;
    }
  };
}

// src/main/browser/browser-cookie-import-write.ts
var HOST_PREFIX = "__Host-";
function importedCookieIdentity(cookie, partitionKey) {
  const isHostPrefixed = cookie.name.startsWith(HOST_PREFIX);
  return {
    url: cookie.url,
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    hostOnly: isHostPrefixed,
    path: isHostPrefixed ? "/" : cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    ...cookie.expirationDate === void 0 ? {} : { expirationDate: cookie.expirationDate },
    ...partitionKey ? { partitionKey } : {}
  };
}
function planImportedCookieWrite(cookie, partition) {
  if (partition.status === "unreadable") {
    return { status: "skip", reason: partition.reason };
  }
  return {
    status: "write",
    identity: importedCookieIdentity(
      cookie,
      partition.status === "partitioned" ? partition.partitionKey : void 0
    )
  };
}
function importedCookieRemovalKey(identity2) {
  const removalUrl = new URL(identity2.url);
  const path = identity2.path ?? "/";
  removalUrl.pathname = path.startsWith("/") ? path : "/";
  return { url: removalUrl.toString(), name: identity2.name };
}
function emptyImportWritePhase() {
  return {
    attemptedKeys: [],
    importedCount: 0,
    writeRejected: 0,
    partitionSkipped: 0,
    domains: /* @__PURE__ */ new Set(),
    failure: null
  };
}
function planImportWrites(cookies) {
  const provisional = [];
  const skips = [];
  const skippedFamilies = /* @__PURE__ */ new Set();
  let hasUnrepresentableSkip = false;
  for (const cookie of cookies) {
    if (cookie.partition.status === "unreadable") {
      const family = registrableFamily(cookie.domain);
      if (family === null) {
        hasUnrepresentableSkip = true;
      } else {
        skippedFamilies.add(family);
      }
      skips.push({ cookie, reason: cookie.partition.reason });
      continue;
    }
    provisional.push(cookie);
  }
  const writes = [];
  for (const cookie of provisional) {
    const family = registrableFamily(cookie.domain);
    if (family !== null && skippedFamilies.has(family)) {
      skips.push({ cookie, reason: "family partition unreadable" });
      continue;
    }
    writes.push(cookie);
  }
  return { writes, skips, skippedFamilies, hasUnrepresentableSkip };
}
function summaryDomain(domain) {
  return domain.startsWith(".") ? domain.slice(1) : domain;
}
function firstNonPrintable(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code > 126) {
      return `pos=${index} char=U+${code.toString(16).padStart(4, "0")}`;
    }
  }
  return "none found";
}
async function writeImportedCookies(store, cookies, options) {
  const phase = emptyImportWritePhase();
  for (const cookie of cookies) {
    const plan = planImportedCookieWrite(cookie, cookie.partition);
    if (plan.status === "skip") {
      phase.partitionSkipped += 1;
      options.log(
        `  cookie skipped, unreadable partition: domain=${summaryDomain(cookie.domain)} ${plan.reason}`
      );
      continue;
    }
    phase.attemptedKeys.push(importedCookieRemovalKey(plan.identity));
    try {
      await store.writeCookieIdentity(plan.identity);
      phase.importedCount += 1;
      phase.domains.add(summaryDomain(cookie.domain));
    } catch (err) {
      phase.writeRejected += 1;
      phase.failure = err;
      if (phase.writeRejected <= 5) {
        options.log(
          `  cookie write REJECTED: domain=${summaryDomain(cookie.domain)} valLen=${cookie.value.length} badChar=${firstNonPrintable(cookie.value)} err=${String(err)}`
        );
      }
      if (options.stopOnFailure) {
        break;
      }
    }
  }
  return phase;
}

// src/main/browser/browser-cookie-import-pipeline.ts
var import_promises = require("fs/promises");

// src/main/browser/browser-cookie-import-diagnostics.ts
var import_electron20 = require("electron");
var import_node_fs10 = require("fs");
var import_node_os = require("os");
var import_node_path10 = require("path");
var _diagLog = null;
function getDiagLogPath() {
  if (!_diagLog) {
    try {
      _diagLog = (0, import_node_path10.join)(import_electron20.app.getPath("userData"), "orca-browser", "cookie-import-diag.log");
    } catch {
      _diagLog = (0, import_node_path10.join)((0, import_node_os.tmpdir)(), "orca-cookie-import-diag.log");
    }
  }
  return _diagLog;
}
function reasonWithDiagLog(reason) {
  return `${reason} Details were written to ${getDiagLogPath()}.`;
}
var COOKIE_IMPORT_ERROR_SUMMARY_MAX_CHARS = 180;
var COOKIE_IMPORT_ERROR_SCAN_MAX_CHARS = 512;
function summarizeCookieImportError(err) {
  const raw = err instanceof Error && err.message ? err.message : String(err);
  let summary = "";
  let previousWasWhitespace = false;
  const scanLimit = Math.min(raw.length, COOKIE_IMPORT_ERROR_SCAN_MAX_CHARS);
  for (let index = 0; index < scanLimit; index += 1) {
    const code = raw.charCodeAt(index);
    if (code === 32 || code >= 9 && code <= 13) {
      if (summary.length > 0 && !previousWasWhitespace) {
        summary += " ";
      }
      previousWasWhitespace = true;
      continue;
    }
    summary += raw.charAt(index);
    if (summary.length >= COOKIE_IMPORT_ERROR_SUMMARY_MAX_CHARS) {
      return summary.slice(0, COOKIE_IMPORT_ERROR_SUMMARY_MAX_CHARS);
    }
    previousWasWhitespace = false;
  }
  return summary;
}
function diag(msg) {
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}
`;
  try {
    (0, import_node_fs10.mkdirSync)((0, import_node_path10.dirname)(getDiagLogPath()), { recursive: true });
    (0, import_node_fs10.appendFileSync)(getDiagLogPath(), line);
  } catch {
  }
  console.log("[cookie-import]", msg);
}

// src/main/browser/browser-cookie-validation.ts
function databaseSameSite(raw) {
  switch (raw) {
    case 0:
      return "no_restriction";
    case 1:
      return "lax";
    case 2:
      return "strict";
    default:
      return "unspecified";
  }
}
function normalizeSameSite(raw) {
  if (typeof raw === "number") {
    return databaseSameSite(raw);
  }
  if (typeof raw !== "string") {
    return "unspecified";
  }
  const lower = raw.toLowerCase();
  if (lower === "lax") {
    return "lax";
  }
  if (lower === "strict") {
    return "strict";
  }
  if (lower === "none" || lower === "no_restriction") {
    return "no_restriction";
  }
  return "unspecified";
}
function deriveUrl(domain, secure) {
  const normalizedDomain = normalizeCookieDomain(domain);
  if (!normalizedDomain) {
    return null;
  }
  const protocol = secure ? "https" : "http";
  try {
    const url = new URL(`${protocol}://${normalizedDomain}/`);
    return url.toString();
  } catch {
    return null;
  }
}
function validateCookieEntry(raw) {
  if (typeof raw.domain !== "string" || raw.domain.trim().length === 0) {
    return null;
  }
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    return null;
  }
  if (typeof raw.value !== "string") {
    return null;
  }
  const domain = raw.domain.trim();
  const secure = raw.secure === true || raw.secure === 1;
  const url = deriveUrl(domain, secure);
  if (!url) {
    return null;
  }
  const expirationDate = typeof raw.expirationDate === "number" && raw.expirationDate > 0 ? raw.expirationDate : void 0;
  return {
    url,
    name: raw.name.trim(),
    value: raw.value,
    domain,
    path: typeof raw.path === "string" ? raw.path : "/",
    secure,
    httpOnly: raw.httpOnly === true || raw.httpOnly === 1,
    sameSite: normalizeSameSite(raw.sameSite),
    expirationDate,
    partition: readJsonCookiePartition(raw.partitionKey, raw.partitionKeyOpaque)
  };
}

// src/main/browser/browser-cookie-import-pipeline.ts
function cookieImportTarget(targetPartition) {
  const targetSession = import_electron21.session.fromPartition(targetPartition);
  return {
    partition: targetPartition,
    mutationLockOwner: targetSession,
    openWriteStore: () => openCookieClearStore(targetSession)
  };
}
async function importValidatedCookies(cookies, totalInput, target, mode, options = {}) {
  const targetPartition = target.partition;
  const importDomainCache = /* @__PURE__ */ new Map();
  const validDomainCookies = cookies.filter((cookie) => {
    let valid = importDomainCache.get(cookie.domain);
    if (valid === void 0) {
      valid = normalizeCookieImportDomain(cookie.domain) !== null;
      importDomainCache.set(cookie.domain, valid);
    }
    return valid;
  });
  const sourceBoundFiltered = validDomainCookies.filter(
    (cookie) => !isGoogleSourceBoundCookie(cookie.name, cookie.domain)
  );
  const importableCookies = sourceBoundFiltered.filter(
    (cookie) => !isNonTransplantableCookieDomain(cookie.domain)
  );
  const integritySkipped = validDomainCookies.length - sourceBoundFiltered.length;
  const nonTransplantableSkipped = sourceBoundFiltered.length - importableCookies.length;
  const googleCookiesSkipped = integritySkipped + nonTransplantableSkipped;
  const invalidDomainSkipped = cookies.length - validDomainCookies.length;
  diag(
    `importValidatedCookies: ${cookies.length} validated, ${invalidDomainSkipped} unsafe-domain skipped, ${integritySkipped} source-bound skipped, ${nonTransplantableSkipped} non-transplantable skipped of ${totalInput} total, partition="${targetPartition}"`
  );
  const plan = planImportWrites(importableCookies);
  if (plan.hasUnrepresentableSkip) {
    return {
      ok: false,
      reason: "Could not import: a cookie with an unreadable site partition has no registrable domain, so its existing session cannot be protected."
    };
  }
  if (options.canReportPartitionSkippedCookies === false && plan.skips.length > 0) {
    return {
      ok: false,
      reason: "This Orca client cannot report cookies skipped for an unreadable site partition. Update Orca on this device and try again."
    };
  }
  const partitionSkipped = plan.skips.length;
  let skipped = totalInput - importableCookies.length + partitionSkipped;
  let phase = emptyImportWritePhase();
  const cookieClearStore = plan.writes.length > 0 ? target.openWriteStore() : null;
  if (cookieClearStore) {
    const releaseMutationLock = await acquireCookieMutationLock(target.mutationLockOwner);
    let replaced = null;
    try {
      if (mode === "replace-imported-domains") {
        try {
          const replacementDomains = plan.writes.map((cookie) => cookie.domain);
          replaced = await replaceCookiesForImportedDomains(cookieClearStore, replacementDomains);
          diag(`  removed ${replaced.removed.length} existing cookies in imported domain scopes`);
        } catch (err) {
          diag(`  existing cookie replacement failed: ${summarizeCookieImportError(err)}`);
          return {
            ok: false,
            reason: reasonWithDiagLog("Could not replace existing cookies for the imported sites.")
          };
        }
      }
      const stripNonPrintable = (s) => s.replace(/[^\x20-\x7E]/g, "");
      phase = await writeImportedCookies(
        cookieClearStore,
        plan.writes.map((cookie) => ({ ...cookie, value: stripNonPrintable(cookie.value) })),
        { stopOnFailure: replaced !== null, log: diag }
      );
      skipped += phase.writeRejected;
      if (phase.failure && replaced) {
        const rollbackFailures = [];
        for (const cookie of phase.attemptedKeys.toReversed()) {
          try {
            await cookieClearStore.remove(cookie.url, cookie.name);
          } catch (err) {
            rollbackFailures.push(err);
          }
        }
        if (replaced.identities.length > 0) {
          try {
            await cookieClearStore.restoreClearIdentities(replaced.identities.toReversed());
          } catch (err) {
            rollbackFailures.push(err);
          }
        }
        if (rollbackFailures.length > 0) {
          diag(`  cookie replacement rollback failed: ${rollbackFailures.length} operation(s)`);
        }
        return {
          ok: false,
          reason: reasonWithDiagLog("Could not safely replace cookies for the imported sites.")
        };
      }
    } finally {
      try {
        cookieClearStore.dispose();
      } finally {
        releaseMutationLock();
      }
    }
  }
  diag(
    `importValidatedCookies result: imported=${phase.importedCount} skipped=${skipped} partition-unreadable=${partitionSkipped} domains=${phase.domains.size}`
  );
  const summary = {
    totalCookies: totalInput,
    importedCookies: phase.importedCount,
    skippedCookies: skipped,
    ...googleCookiesSkipped > 0 ? { googleCookiesSkipped } : {},
    ...partitionSkipped > 0 ? { partitionSkippedCookies: partitionSkipped } : {},
    domains: [...phase.domains].sort()
  };
  return { ok: true, profileId: "", summary };
}
async function pickCookieFile(parentWindow) {
  const opts = {
    title: "Import Cookies",
    filters: [
      { name: "Cookie Files", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  };
  const result = parentWindow ? await import_electron21.dialog.showOpenDialog(parentWindow, opts) : await import_electron21.dialog.showOpenDialog(opts);
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}
async function importCookiesFromFile(filePath, targetPartition) {
  let rawContent;
  try {
    rawContent = await (0, import_promises.readFile)(filePath, "utf-8");
  } catch {
    return { ok: false, reason: "Could not read the selected file." };
  }
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return { ok: false, reason: "File is not valid JSON." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, reason: "Expected a JSON array of cookie objects." };
  }
  if (parsed.length === 0) {
    return { ok: false, reason: "Cookie file is empty." };
  }
  const validated = [];
  let skipped = 0;
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) {
      skipped++;
      continue;
    }
    const cookie = validateCookieEntry(entry);
    if (cookie) {
      validated.push(cookie);
    } else {
      skipped++;
    }
  }
  if (validated.length === 0) {
    return {
      ok: false,
      reason: `No valid cookies found. ${skipped} entries were skipped due to missing or invalid fields.`
    };
  }
  return importValidatedCookies(
    validated,
    parsed.length,
    cookieImportTarget(targetPartition),
    "replace-imported-domains"
  );
}

// src/main/browser/browser-cookie-chromium-import.ts
var import_electron23 = require("electron");
var import_node_fs14 = require("fs");

// src/main/browser/browser-cookie-chromium-prepare.ts
var import_electron22 = require("electron");
var import_node_crypto4 = require("crypto");
var import_node_fs13 = require("fs");
var import_node_sqlite2 = require("sqlite");
var import_node_path14 = require("path");

// src/main/browser/chromium-cookie-snapshot.ts
var import_node_fs11 = require("fs");
var import_node_os2 = require("os");
var import_node_path11 = require("path");
var SNAPSHOT_ATTEMPTS = 5;
function removeSnapshotDirectory(path) {
  (0, import_node_fs11.rmSync)(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}
function isMissingFileError(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
function readFileState(path) {
  try {
    const stats = (0, import_node_fs11.statSync)(path, { bigint: true });
    return {
      device: stats.dev,
      inode: stats.ino,
      size: stats.size,
      modifiedAt: stats.mtimeNs,
      changedAt: stats.ctimeNs
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}
function sameFileState(left, right) {
  if (!left || !right) {
    return left === right;
  }
  return left.device === right.device && left.inode === right.inode && left.size === right.size && left.modifiedAt === right.modifiedAt && left.changedAt === right.changedAt;
}
function removeAttemptFiles(databasePath) {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      (0, import_node_fs11.unlinkSync)(databasePath + suffix);
    } catch {
    }
  }
}
function copyStableAttempt(sourcePath, databasePath) {
  const sourceWalPath = `${sourcePath}-wal`;
  const databaseBefore = readFileState(sourcePath);
  const walBefore = readFileState(sourceWalPath);
  if (!databaseBefore) {
    throw new Error("Chromium cookies database does not exist");
  }
  removeAttemptFiles(databasePath);
  copyFileWithWindowsRetry(sourcePath, databasePath);
  if (walBefore) {
    try {
      copyFileWithWindowsRetry(sourceWalPath, `${databasePath}-wal`);
    } catch (error) {
      if (isMissingFileError(error)) {
        return false;
      }
      throw error;
    }
  }
  const databaseAfter = readFileState(sourcePath);
  const walAfter = readFileState(sourceWalPath);
  if (!sameFileState(databaseBefore, databaseAfter) || !sameFileState(walBefore, walAfter)) {
    return false;
  }
  const copiedDatabase = readFileState(databasePath);
  const copiedWal = readFileState(`${databasePath}-wal`);
  return copiedDatabase?.size === databaseBefore.size && (walBefore ? copiedWal?.size === walBefore.size : copiedWal === null);
}
function createChromiumCookieSnapshot(sourcePath, options = {}) {
  const snapshotDir = (0, import_node_fs11.mkdtempSync)((0, import_node_path11.join)(options.tempRoot ?? (0, import_node_os2.tmpdir)(), "orca-cookie-import-"));
  const databasePath = (0, import_node_path11.join)(snapshotDir, "Cookies");
  let keepSnapshot = false;
  try {
    for (let attempt = 0; attempt < SNAPSHOT_ATTEMPTS; attempt += 1) {
      if (copyStableAttempt(sourcePath, databasePath)) {
        keepSnapshot = true;
        return {
          databasePath,
          cleanup: () => removeSnapshotDirectory(snapshotDir)
        };
      }
    }
    throw new Error("Chromium cookies database changed while creating a snapshot");
  } finally {
    if (!keepSnapshot) {
      removeSnapshotDirectory(snapshotDir);
    }
  }
}

// src/main/browser/browser-cookie-key.ts
var import_node_crypto3 = require("crypto");
var import_node_fs12 = require("fs");
var import_node_path13 = require("path");

// src/main/process-sync.ts
var import_node_child_process = require("child_process");
var import_node_path12 = require("path");
function runProcessSync(spec) {
  const result = (0, import_node_child_process.spawnSync)(spec.program, [...spec.args], {
    encoding: "utf8",
    input: spec.input,
    timeout: spec.timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      return { code: result.status, timedOut: true, stdout: result.stdout ?? "" };
    }
    throw result.error;
  }
  return { code: result.status, timedOut: false, stdout: result.stdout ?? "" };
}
function systemRoot(env = process.env) {
  return env.SystemRoot ?? env.SYSTEMROOT ?? env.windir ?? "C:\\Windows";
}
function windowsPowerShellPath(env = process.env) {
  return import_node_path12.win32.join(systemRoot(env), "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

// src/main/browser/browser-cookie-key.ts
var PBKDF2_ITERATIONS = 1003;
var PBKDF2_KEY_LENGTH = 16;
var PBKDF2_SALT = "saltysalt";
function runKeychainCommand(program, args, timeoutMs) {
  const result = runProcessSync({ program, args, timeoutMs });
  if (result.code !== 0 || result.timedOut) {
    throw new Error(`${program} exited with code ${result.code ?? "unknown"}`);
  }
  return result.stdout.trim();
}
function getEncryptionKey(keychainService, keychainAccount, browser) {
  if (process.platform === "darwin") {
    return getMacEncryptionKey(keychainService, keychainAccount);
  }
  if (process.platform === "linux") {
    return getLinuxEncryptionKey(keychainService, keychainAccount);
  }
  if (process.platform === "win32" && browser) {
    return getWindowsEncryptionKey(browser);
  }
  return null;
}
function getMacEncryptionKey(keychainService, keychainAccount) {
  try {
    const raw = runKeychainCommand(
      "security",
      ["find-generic-password", "-s", keychainService, "-a", keychainAccount, "-w"],
      3e4
    );
    return {
      mode: "aes-128-cbc",
      keysByVersion: {
        v10: (0, import_node_crypto3.pbkdf2Sync)(raw, PBKDF2_SALT, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, "sha1")
      }
    };
  } catch {
    return null;
  }
}
function getLinuxEncryptionKey(keychainService, keychainAccount) {
  const v10Key = (0, import_node_crypto3.pbkdf2Sync)("peanuts", PBKDF2_SALT, 1, PBKDF2_KEY_LENGTH, "sha1");
  let keyringPassword = "";
  try {
    keyringPassword = runKeychainCommand(
      "secret-tool",
      ["lookup", "service", keychainService, "account", keychainAccount],
      5e3
    );
  } catch {
    try {
      const app6 = keychainAccount.toLowerCase().replaceAll(" ", "");
      keyringPassword = runKeychainCommand("secret-tool", ["lookup", "application", app6], 5e3);
    } catch {
      diag("  Linux keyring unavailable \u2014 v11 cookies cannot be decrypted");
    }
  }
  if (!keyringPassword) {
    return {
      mode: "aes-128-cbc",
      keysByVersion: { v10: v10Key },
      keyringUnavailable: true
    };
  }
  const v11Key = (0, import_node_crypto3.pbkdf2Sync)(keyringPassword, PBKDF2_SALT, 1, PBKDF2_KEY_LENGTH, "sha1");
  return { mode: "aes-128-cbc", keysByVersion: { v10: v10Key, v11: v11Key } };
}
function getWindowsEncryptionKey(browser) {
  const browserDef = CHROMIUM_BROWSERS.find((b) => b.family === browser.family);
  if (!browserDef) {
    return null;
  }
  const root = browserRootPath(browserDef);
  if (!root) {
    return null;
  }
  const localStatePath = (0, import_node_path13.join)(root, "Local State");
  if (!(0, import_node_fs12.existsSync)(localStatePath)) {
    return null;
  }
  try {
    const raw = (0, import_node_fs12.readFileSync)(localStatePath, "utf-8");
    const localState = JSON.parse(raw);
    const encryptedKeyB64 = localState?.os_crypt?.encrypted_key;
    if (typeof encryptedKeyB64 !== "string") {
      return null;
    }
    const encryptedKey = Buffer.from(encryptedKeyB64, "base64");
    const dpapiPrefix = Buffer.from("DPAPI", "utf-8");
    if (!encryptedKey.subarray(0, dpapiPrefix.length).equals(dpapiPrefix)) {
      return null;
    }
    const dpapiData = encryptedKey.subarray(dpapiPrefix.length).toString("base64");
    const script = [
      "try { Add-Type -AssemblyName System.Security.Cryptography.ProtectedData -ErrorAction Stop }",
      "catch { try { Add-Type -AssemblyName System.Security -ErrorAction Stop } catch {} };",
      "$in=[Convert]::FromBase64String([Console]::In.ReadLine());",
      "$out=[System.Security.Cryptography.ProtectedData]::Unprotect($in,$null,",
      "[System.Security.Cryptography.DataProtectionScope]::CurrentUser);",
      "[Convert]::ToBase64String($out)"
    ].join("");
    const result = runProcessSync({
      program: windowsPowerShellPath(),
      args: ["-NoProfile", "-NonInteractive", "-Command", script],
      timeoutMs: 1e4,
      input: dpapiData
    });
    if (result.code !== 0 || result.timedOut) {
      diag("  Windows DPAPI key extraction failed: PowerShell exited non-zero");
      return null;
    }
    return { key: Buffer.from(result.stdout.trim(), "base64"), mode: "aes-256-gcm" };
  } catch (err) {
    diag(`  Windows DPAPI key extraction failed: ${String(err)}`);
    return null;
  }
}

// src/main/browser/browser-cookie-chromium-prepare.ts
async function prepareChromiumCookieImport(browser, targetPartition, options, targetSession) {
  await targetSession.cookies.flushStore();
  const partitionDir = targetSession.getStoragePath();
  if (!partitionDir) {
    return {
      result: { ok: false, reason: "Target cookie database not found. Open a browser tab first." }
    };
  }
  const partitionName = targetPartition.replace("persist:", "");
  let liveCookiesPath = resolveChromiumCookiesPath(partitionDir);
  if (!liveCookiesPath) {
    try {
      await targetSession.cookies.set({ url: "https://localhost", name: "__init", value: "1" });
      await targetSession.cookies.remove("https://localhost", "__init");
      await targetSession.cookies.flushStore();
    } catch {
    }
    liveCookiesPath = resolveChromiumCookiesPath(partitionDir);
  }
  if (!liveCookiesPath) {
    return {
      result: { ok: false, reason: "Target cookie database not found. Open a browser tab first." }
    };
  }
  const stagingDir = (0, import_node_path14.join)(import_electron22.app.getPath("userData"), "orca-browser", "cookie-import-staging");
  const partitionSegment = partitionName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const stagingCookiesPath = (0, import_node_path14.join)(
    stagingDir,
    `Cookies-${partitionSegment}-${Date.now()}-${(0, import_node_crypto4.randomUUID)()}`
  );
  let stagingAvailable = false;
  if (!supportsPendingBrowserCookieImportReplay(targetPartition)) {
    diag(`  restart fallback unsupported for partition "${targetPartition}" \u2014 not staging cookies`);
  } else {
    try {
      (0, import_node_fs13.mkdirSync)(stagingDir, { recursive: true });
      copyFileWithWindowsRetry(liveCookiesPath, stagingCookiesPath);
      stagingAvailable = true;
    } catch (err) {
      const fsErr = err;
      diag(
        `  staging copy unavailable: code=${fsErr.code ?? "unknown"} errno=${fsErr.errno ?? "unknown"} syscall=${fsErr.syscall ?? "unknown"} path=${liveCookiesPath} destination=${stagingCookiesPath}`
      );
      try {
        (0, import_node_fs13.unlinkSync)(stagingCookiesPath);
      } catch {
      }
    }
  }
  let sourceSnapshot;
  try {
    sourceSnapshot = createChromiumCookieSnapshot(browser.cookiesPath);
  } catch (err) {
    try {
      (0, import_node_fs13.unlinkSync)(stagingCookiesPath);
    } catch {
    }
    diag(`  Chromium snapshot failed: ${String(err)}`);
    return {
      result: {
        ok: false,
        reason: `Could not copy ${browser.label} cookies database. Try closing ${browser.label} first.`
      }
    };
  }
  let sourceDb = null;
  let stagingDb = null;
  const closeStagingDb = () => {
    try {
      stagingDb?.close();
    } catch {
    }
    stagingDb = null;
  };
  const discardStagingFile = () => {
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        (0, import_node_fs13.unlinkSync)(stagingCookiesPath + suffix);
      } catch {
      }
    }
  };
  let ownershipTransferred = false;
  try {
    sourceDb = new import_node_sqlite2.DatabaseSync(sourceSnapshot.databasePath, { readOnly: true, readBigInts: true });
    let targetColumnInfo = null;
    let colList = null;
    let placeholders = null;
    if (stagingAvailable) {
      try {
        stagingDb = new import_node_sqlite2.DatabaseSync(stagingCookiesPath);
        stagingDb.exec("PRAGMA journal_mode = DELETE");
        targetColumnInfo = stagingDb.prepare("PRAGMA table_info(cookies)").all();
        const targetCols = targetColumnInfo.map((row) => row.name);
        colList = targetCols.join(", ");
        placeholders = targetCols.map(() => "?").join(", ");
      } catch (err) {
        diag(`  staging database unusable, restart fallback disabled: ${String(err)}`);
        stagingAvailable = false;
        targetColumnInfo = null;
        colList = null;
        placeholders = null;
        closeStagingDb();
        discardStagingFile();
      }
    }
    const sourceColumns = new Set(
      sourceDb.prepare("PRAGMA table_info(cookies)").all().map(
        (column) => column.name
      )
    );
    const sourceRows = sourceDb.prepare("SELECT * FROM cookies ORDER BY rowid").all();
    sourceDb.close();
    sourceDb = null;
    diag(`  source has ${sourceRows.length} cookies`);
    if (sourceRows.length === 0) {
      return { result: { ok: false, reason: `No cookies found in ${browser.label}.` } };
    }
    const partitionCandidates = sourceRows.flatMap((sourceRow) => {
      const domain = sourceRow.host_key;
      const name = sourceRow.name;
      return isGoogleSourceBoundCookie(name, domain) || isNonTransplantableCookieDomain(domain) ? [] : [{ sourceRow, domain, partition: readChromiumRowPartition(sourceRow, sourceColumns) }];
    });
    const nativePlan = planImportWrites(partitionCandidates);
    const plannedSourceRows = new Set(nativePlan.writes.map((candidate) => candidate.sourceRow));
    const partitionBySourceRow = new Map(
      partitionCandidates.map((candidate) => [candidate.sourceRow, candidate.partition])
    );
    if (nativePlan.hasUnrepresentableSkip) {
      return {
        result: {
          ok: false,
          reason: "Could not import: a cookie with an unreadable site partition has no registrable domain, so its existing session cannot be protected."
        }
      };
    }
    const needsSourceKey = sourceRows.some((sourceRow) => {
      const encrypted = sourceRow.encrypted_value;
      if (!(encrypted instanceof Uint8Array) || encrypted.length === 0) {
        return false;
      }
      return !isGoogleSourceBoundCookie(sourceRow.name, sourceRow.host_key) && !isNonTransplantableCookieDomain(sourceRow.host_key);
    });
    const sourceKey = needsSourceKey ? getEncryptionKey(browser.keychainService, browser.keychainAccount, browser) : null;
    if (needsSourceKey && !sourceKey) {
      return {
        result: {
          ok: false,
          reason: `Could not access ${browser.label} encryption key. The OS may have denied access.`
        }
      };
    }
    let insertStmt = null;
    const context = {
      browser,
      targetPartition,
      options,
      targetSession,
      stagingCookiesPath,
      stagingAvailable,
      sourceSnapshot,
      sourceDb,
      stagingDb,
      targetColumnInfo,
      colList,
      placeholders,
      sourceColumns,
      sourceRows,
      nativePlan,
      plannedSourceRows,
      partitionBySourceRow,
      sourceKey,
      imported: 0,
      skipped: 0,
      decryptFailed: 0,
      appBoundFailed: 0,
      keyringUnavailableFailed: 0,
      integritySkipped: 0,
      nonTransplantableSkipped: 0,
      partitionSkipped: nativePlan.skips.length,
      googleCookiesSkipped: 0,
      memoryLoaded: 0,
      memoryFailed: 0,
      domainSet: /* @__PURE__ */ new Set(),
      decryptedCookies: [],
      // Why: the staging insert needs the RAW source row, so each scanned candidate carries it.
      // A plan record holding only the derived fields compiles fine and then cannot stage.
      scanned: [],
      sourceDomainValidity: /* @__PURE__ */ new Map(),
      insertStmt,
      importScope: {
        exact: /* @__PURE__ */ new Set(),
        ancestors: /* @__PURE__ */ new Set(),
        descendantRoots: /* @__PURE__ */ new Set()
      },
      closeStagingDb,
      discardStagingFile,
      disableStaging: (reason) => {
        diag(`  staging disabled, restart fallback unavailable: ${reason}`);
        context.stagingAvailable = false;
        context.insertStmt = null;
        context.closeStagingDb();
        context.discardStagingFile();
      }
    };
    if (context.stagingDb && context.colList && context.placeholders) {
      try {
        context.insertStmt = context.stagingDb.prepare(
          `INSERT OR REPLACE INTO cookies (${context.colList}) VALUES (${context.placeholders})`
        );
        context.stagingDb.exec("BEGIN TRANSACTION");
      } catch (err) {
        context.disableStaging(String(err));
      }
    } else if (context.stagingAvailable) {
      context.disableStaging("staged database exposed no cookies columns");
    }
    if (context.nativePlan.skippedFamilies.size > 0) {
      context.disableStaging(
        `${context.nativePlan.skippedFamilies.size} preserved cookie families cannot be represented in a staged image`
      );
    }
    ownershipTransferred = true;
    return { context };
  } finally {
    if (!ownershipTransferred) {
      try {
        sourceDb?.close();
      } catch {
      }
      closeStagingDb();
      discardStagingFile();
      try {
        sourceSnapshot.cleanup();
      } catch (err) {
        diag(`  Chromium snapshot cleanup failed: ${String(err)}`);
      }
    }
  }
}

// src/main/browser/browser-cookie-sqlite.ts
var CHROMIUM_EPOCH_OFFSET = 11644473600n;
function chromiumTimestampToUnix(chromiumTs) {
  if (!chromiumTs || chromiumTs === 0n || chromiumTs === 0 || chromiumTs === "0") {
    return 0;
  }
  try {
    const ts = typeof chromiumTs === "bigint" ? chromiumTs : BigInt(typeof chromiumTs === "number" ? Math.round(chromiumTs) : chromiumTs);
    if (ts === 0n) {
      return 0;
    }
    return Math.max(Number(ts / 1000000n - CHROMIUM_EPOCH_OFFSET), 0);
  } catch {
    return 0;
  }
}
function parseSqliteDefaultValue(raw, type) {
  if (raw === null || raw === void 0) {
    return null;
  }
  if (typeof raw !== "string") {
    return typeof raw === "number" || typeof raw === "bigint" ? Number(raw) : String(raw);
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toUpperCase() === "NULL") {
    return null;
  }
  if (/^X''$/i.test(trimmed) || type.includes("BLOB")) {
    return Buffer.alloc(0);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'") || trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  if (type.includes("INT")) {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return trimmed;
}
function normalizeSqliteCookieValue(value) {
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (value === void 0 || value === null) {
    return null;
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "string") {
    return value;
  }
  return String(value);
}
function isSqliteNotNull(column) {
  return Number(column.notnull ?? 0) !== 0;
}
function fallbackChromiumCookieColumnValue(column, sourceRow) {
  const type = (column.type ?? "").toUpperCase();
  const defaultValue = parseSqliteDefaultValue(column.dflt_value, type);
  if (defaultValue !== null) {
    return defaultValue;
  }
  if (!isSqliteNotNull(column)) {
    return null;
  }
  switch (column.name) {
    case "value":
    case "encrypted_value":
      return Buffer.alloc(0);
    case "top_frame_site_key":
      return "";
    case "source_port":
      return -1;
    case "last_update_utc":
      return normalizeSqliteCookieValue(sourceRow.creation_utc) ?? 0;
    default:
      if (type.includes("BLOB")) {
        return Buffer.alloc(0);
      }
      if (type.includes("INT")) {
        return 0;
      }
      return "";
  }
}
function buildChromiumCookieInsertParams(targetColumns, sourceRow, decryptedValue) {
  return targetColumns.map((column) => {
    if (column.name === "encrypted_value") {
      return Buffer.alloc(0);
    }
    if (column.name === "value") {
      return decryptedValue;
    }
    const sourceHasColumn = Object.hasOwn(sourceRow, column.name);
    const sourceValue = sourceHasColumn ? normalizeSqliteCookieValue(sourceRow[column.name]) : null;
    if (sourceValue !== null) {
      return sourceValue;
    }
    if (sourceHasColumn && !isSqliteNotNull(column)) {
      return null;
    }
    return fallbackChromiumCookieColumnValue(column, sourceRow);
  });
}

// src/main/browser/browser-cookie-decryption.ts
var import_node_crypto5 = require("crypto");
var CHROMIUM_COOKIE_HMAC_LEN = 32;
function hasHmacPrefix(buf) {
  if (buf.length <= CHROMIUM_COOKIE_HMAC_LEN) {
    return false;
  }
  let nonPrintable = 0;
  for (let i = 0; i < CHROMIUM_COOKIE_HMAC_LEN; i++) {
    if (buf[i] < 32 || buf[i] > 126) {
      nonPrintable++;
    }
  }
  return nonPrintable >= 8;
}
function hasHostKeyHashPrefix(buf, hostKey) {
  return buf.length >= CHROMIUM_COOKIE_HMAC_LEN && buf.subarray(0, CHROMIUM_COOKIE_HMAC_LEN).equals((0, import_node_crypto5.createHash)("sha256").update(hostKey).digest());
}
function stripHmac(buf, hostKey) {
  return hasHostKeyHashPrefix(buf, hostKey) || hasHmacPrefix(buf) ? buf.subarray(CHROMIUM_COOKIE_HMAC_LEN) : buf;
}
function cookieEncryptionVersion(encryptedBuffer) {
  if (encryptedBuffer.length < 3) {
    return null;
  }
  const version = encryptedBuffer.subarray(0, 3).toString("utf-8");
  return /^v\d\d$/.test(version) ? version : null;
}
function buildUndecryptableWarning(counts) {
  if (counts.decryptFailed === 0) {
    return void 0;
  }
  const unknownFailed = counts.decryptFailed - counts.appBoundFailed - counts.keyringUnavailableFailed;
  const rankedCauses = [
    { reason: "app-bound-encryption", count: counts.appBoundFailed },
    { reason: "linux-keyring-unavailable", count: counts.keyringUnavailableFailed },
    { reason: "unknown", count: unknownFailed }
  ].sort((left, right) => right.count - left.count);
  const [dominant, runnerUp] = rankedCauses;
  if (dominant.reason === "unknown" || dominant.count === runnerUp.count) {
    return { code: "cookies-undecryptable", failedCookies: counts.decryptFailed, reason: "unknown" };
  }
  const otherFailedCookies = counts.decryptFailed - dominant.count;
  return {
    code: "cookies-undecryptable",
    failedCookies: dominant.count,
    reason: dominant.reason,
    ...otherFailedCookies > 0 ? { otherFailedCookies } : {}
  };
}
function decryptCookieValueRaw(encryptedBuffer, keyResult, hostKey) {
  if (!encryptedBuffer || encryptedBuffer.length === 0) {
    return null;
  }
  const version = encryptedBuffer.subarray(0, 3).toString("utf-8");
  if (!/^v\d\d$/.test(version)) {
    return null;
  }
  if (keyResult.mode === "aes-256-gcm") {
    return decryptAes256Gcm(encryptedBuffer.subarray(3), keyResult.key, hostKey);
  }
  const key = version === "v10" || version === "v11" ? keyResult.keysByVersion[version] : void 0;
  if (!key) {
    return null;
  }
  const ciphertext = encryptedBuffer.subarray(3);
  if (!ciphertext.length) {
    return null;
  }
  try {
    const iv = Buffer.alloc(16, " ");
    const decipher = (0, import_node_crypto5.createDecipheriv)("aes-128-cbc", key, iv);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return stripHmac(decrypted, hostKey);
  } catch {
    return null;
  }
}
function decryptAes256Gcm(payload, key, hostKey) {
  if (payload.length < 12 + 16) {
    return null;
  }
  const nonce = payload.subarray(0, 12);
  const authTag = payload.subarray(-16);
  const ciphertext = payload.subarray(12, -16);
  try {
    const decipher = (0, import_node_crypto5.createDecipheriv)("aes-256-gcm", key, nonce);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return stripHmac(decrypted, hostKey);
  } catch {
    return null;
  }
}

// src/main/browser/browser-cookie-chromium-scan.ts
function scanChromiumCookieRows(context) {
  const { sourceRows, sourceKey, plannedSourceRows, partitionBySourceRow, targetColumnInfo } = context;
  for (const sourceRow of sourceRows) {
    const domain = sourceRow.host_key;
    const name = sourceRow.name;
    if (isGoogleSourceBoundCookie(name, domain)) {
      context.integritySkipped++;
      continue;
    }
    if (isNonTransplantableCookieDomain(domain)) {
      context.nonTransplantableSkipped++;
      continue;
    }
    const encRaw = sourceRow.encrypted_value;
    const encBuf = encRaw instanceof Uint8Array ? Buffer.from(encRaw) : null;
    const plainRaw = sourceRow.value;
    let decryptedValue;
    if (encBuf && encBuf.length > 0) {
      const version = cookieEncryptionVersion(encBuf);
      const appBoundIneligible = version === "v20";
      const keyringIneligible = version === "v11" && sourceKey?.mode === "aes-128-cbc" && sourceKey.keyringUnavailable === true;
      const raw = sourceKey && !appBoundIneligible && !keyringIneligible ? decryptCookieValueRaw(encBuf, sourceKey, domain) : null;
      if (!raw) {
        context.decryptFailed++;
        if (appBoundIneligible) {
          context.appBoundFailed++;
        } else if (keyringIneligible) {
          context.keyringUnavailableFailed++;
        }
        context.skipped++;
        continue;
      }
      decryptedValue = raw;
    } else if (plainRaw instanceof Uint8Array) {
      decryptedValue = Buffer.from(plainRaw);
    } else if (typeof plainRaw === "string") {
      decryptedValue = Buffer.from(plainRaw, "latin1");
    } else {
      decryptedValue = Buffer.alloc(0);
    }
    let validDomain = context.sourceDomainValidity.get(domain);
    if (validDomain === void 0) {
      validDomain = normalizeCookieImportDomain(domain) !== null;
      context.sourceDomainValidity.set(domain, validDomain);
    }
    if (!validDomain) {
      context.skipped++;
      continue;
    }
    if (!plannedSourceRows.has(sourceRow)) {
      context.skipped++;
      continue;
    }
    const path = sourceRow.path;
    const secure = sourceRow.is_secure === 1n;
    const httpOnly = sourceRow.is_httponly === 1n;
    const sameSite = databaseSameSite(Number(sourceRow.samesite ?? -1));
    const expiresUtc = chromiumTimestampToUnix(sourceRow.expires_utc);
    const partition = partitionBySourceRow.get(sourceRow);
    const value = decryptedValue.toString("latin1");
    context.scanned.push({
      entry: {
        decryptedValue,
        value,
        domain,
        name,
        path,
        secure,
        httpOnly,
        sameSite,
        expirationDate: expiresUtc > 0 ? expiresUtc : void 0,
        partition
      },
      sourceRow
    });
  }
  for (const { entry } of context.scanned) {
    context.domainSet.add(entry.domain.startsWith(".") ? entry.domain.slice(1) : entry.domain);
  }
  context.importScope = importedDomainScope([...context.domainSet]);
  if (context.stagingDb && context.insertStmt) {
    try {
      prepareStagedCookiesForImport(context.stagingDb, context.importScope);
    } catch (err) {
      context.disableStaging(String(err));
    }
  }
  for (const { entry, sourceRow } of context.scanned) {
    context.decryptedCookies.push(entry);
    if (context.insertStmt && targetColumnInfo) {
      try {
        const params = buildChromiumCookieInsertParams(
          targetColumnInfo,
          sourceRow,
          entry.decryptedValue
        );
        context.insertStmt.run(...params);
      } catch (err) {
        context.disableStaging(String(err));
      }
    }
    context.imported++;
  }
  diag(
    `  skipped ${context.integritySkipped} Google integrity cookies (SIDCC/STRP/AEC) and ${context.nonTransplantableSkipped} non-transplantable-domain cookies`
  );
  context.googleCookiesSkipped = context.integritySkipped + context.nonTransplantableSkipped;
  context.undecryptableWarning = buildUndecryptableWarning({
    decryptFailed: context.decryptFailed,
    appBoundFailed: context.appBoundFailed,
    keyringUnavailableFailed: context.keyringUnavailableFailed
  });
  if (context.partitionSkipped > 0 && context.options.canReportPartitionSkippedCookies === false) {
    context.closeStagingDb();
    context.discardStagingFile();
    return {
      ok: false,
      reason: "This Orca client cannot report cookies skipped for an unreadable site partition. Update Orca on this device and try again."
    };
  }
  return null;
}

// src/main/browser/browser-cookie-chromium-finalize.ts
async function finalizeChromiumCookieImport(context) {
  if (context.decryptedCookies.length === 0) {
    const zeroPathWarning = context.undecryptableWarning;
    context.closeStagingDb();
    context.discardStagingFile();
    return {
      ok: true,
      profileId: "",
      summary: {
        totalCookies: context.sourceRows.length,
        importedCookies: 0,
        skippedCookies: context.skipped + context.integritySkipped + context.nonTransplantableSkipped,
        ...context.googleCookiesSkipped > 0 ? { googleCookiesSkipped: context.googleCookiesSkipped } : {},
        // Why: partition skips are a breakdown of skippedCookies, never an addition to it, so
        // totalCookies === importedCookies + skippedCookies keeps holding on this path too.
        ...context.partitionSkipped > 0 ? { partitionSkippedCookies: context.partitionSkipped } : {},
        domains: [],
        // Why: a profile whose rows cannot be decrypted returns here, and without this it is
        // reported as a successful empty import.
        ...zeroPathWarning ? { warning: zeroPathWarning } : {}
      }
    };
  }
  if (context.stagingDb) {
    try {
      context.stagingDb.exec("COMMIT");
      context.closeStagingDb();
      diag(
        `  SQLite staging complete: ${context.imported} cookies, ${context.domainSet.size} domains`
      );
    } catch (err) {
      context.disableStaging(String(err));
    }
  } else {
    diag(`  staging skipped: ${context.imported} cookies will load in-memory only`);
  }
  const cookieClearStore = openCookieClearStore(context.targetSession);
  try {
    await removeTransplantableCookies(
      {
        cookies: cookieClearStore,
        snapshotClearIdentities: (cookies) => cookieClearStore.snapshotClearIdentities(cookies),
        restoreClearIdentities: (identities) => cookieClearStore.restoreClearIdentities(identities)
      },
      // Why (STA-4300): the families this import declined to write must not be removed either.
      // Passing them here keeps their coordinates out of the removal plan AND out of the CDP
      // snapshot taken from it, so they are never submitted to any mutation.
      context.nativePlan.skippedFamilies,
      context.importScope
    );
    diag(
      `  cleared existing cookies for ${context.domainSet.size} imported domains before loading ${context.decryptedCookies.length} imported cookies`
    );
    const writable = [];
    for (const cookie of context.decryptedCookies) {
      const url = deriveUrl(cookie.domain, cookie.secure);
      if (!url) {
        context.memoryFailed++;
        continue;
      }
      writable.push({ ...cookie, url });
    }
    const phase = await writeImportedCookies(cookieClearStore, writable, {
      stopOnFailure: false,
      log: diag
    });
    context.memoryLoaded = phase.importedCount;
    context.memoryFailed += phase.writeRejected;
  } finally {
    cookieClearStore.dispose();
  }
  diag(
    `  memory load: ${context.memoryLoaded} OK, ${context.memoryFailed} failed, ${context.partitionSkipped} partition-unreadable`
  );
  let warning;
  if (context.memoryFailed > 0 && context.stagingAvailable) {
    browserSessionRegistry.setPendingCookieImport(
      context.targetPartition,
      context.stagingCookiesPath
    );
    diag(
      `  staged at ${context.stagingCookiesPath} for ${context.memoryFailed} cookies that need restart`
    );
  } else if (context.memoryFailed > 0) {
    browserSessionRegistry.clearPendingCookieImport(context.targetPartition);
    context.discardStagingFile();
    diag(`  ${context.memoryFailed} cookies need a restart but staging is unavailable \u2014 skipped`);
    warning = {
      code: "restart-fallback-unavailable",
      loadedCookies: context.memoryLoaded,
      failedCookies: context.memoryFailed
    };
  } else {
    browserSessionRegistry.clearPendingCookieImport(context.targetPartition);
    context.discardStagingFile();
    diag("  all cookies loaded in-memory \u2014 no restart needed");
  }
  if (!warning && context.undecryptableWarning) {
    warning = context.undecryptableWarning;
  }
  const summary = {
    totalCookies: context.sourceRows.length,
    importedCookies: context.imported,
    skippedCookies: context.skipped + context.integritySkipped + context.nonTransplantableSkipped,
    ...context.googleCookiesSkipped > 0 ? { googleCookiesSkipped: context.googleCookiesSkipped } : {},
    ...context.partitionSkipped > 0 ? { partitionSkippedCookies: context.partitionSkipped } : {},
    domains: [...context.domainSet].sort(),
    ...warning ? { warning } : {}
  };
  return { ok: true, profileId: "", summary };
}

// src/main/browser/browser-cookie-chromium-import.ts
async function importChromiumCookies(browser, targetPartition, options = {}) {
  diag(`importCookiesFromBrowser: browser=${browser.family} partition="${targetPartition}"`);
  if (!(0, import_node_fs14.existsSync)(browser.cookiesPath)) {
    diag(`  cookies DB not found: ${browser.cookiesPath}`);
    return { ok: false, reason: `${browser.label} cookies database not found.` };
  }
  const targetSession = import_electron23.session.fromPartition(targetPartition);
  return withCookieMutationLock(targetSession, async () => {
    let context = null;
    try {
      const preparation = await prepareChromiumCookieImport(
        browser,
        targetPartition,
        options,
        targetSession
      );
      if ("result" in preparation) {
        return preparation.result;
      }
      context = preparation.context;
      const scanResult = scanChromiumCookieRows(context);
      if (scanResult) {
        return scanResult;
      }
      return await finalizeChromiumCookieImport(context);
    } catch (err) {
      if (context) {
        try {
          context.sourceDb?.close();
        } catch {
        }
        context.closeStagingDb();
        context.discardStagingFile();
      }
      diag(`  SQLite import failed: ${String(err)}`);
      return {
        ok: false,
        reason: reasonWithDiagLog(
          `Could not import cookies from ${browser.label}: ${summarizeCookieImportError(err)}.`
        )
      };
    } finally {
      if (context) {
        try {
          context.sourceSnapshot.cleanup();
        } catch (err) {
          diag(`  Chromium snapshot cleanup failed: ${String(err)}`);
        }
      }
    }
  });
}

// src/main/browser/browser-cookie-firefox-import.ts
var import_node_sqlite3 = require("sqlite");
var import_node_fs15 = require("fs");
var import_node_os3 = require("os");
var import_node_path15 = require("path");
async function importCookiesFromFirefox(browser, targetPartition, options) {
  diag(`importCookiesFromFirefox: partition="${targetPartition}"`);
  const tmpDir = (0, import_node_fs15.mkdtempSync)((0, import_node_path15.join)((0, import_node_os3.tmpdir)(), "orca-cookie-import-"));
  const tmpCookiesPath = (0, import_node_path15.join)(tmpDir, "cookies.sqlite");
  try {
    (0, import_node_fs15.copyFileSync)(browser.cookiesPath, tmpCookiesPath);
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = browser.cookiesPath + suffix;
      if ((0, import_node_fs15.existsSync)(sidecar)) {
        try {
          (0, import_node_fs15.copyFileSync)(sidecar, tmpCookiesPath + suffix);
        } catch {
        }
      }
    }
  } catch {
    (0, import_node_fs15.rmSync)(tmpDir, { recursive: true, force: true });
    return {
      ok: false,
      reason: "Could not copy Firefox cookies database. Try closing Firefox first."
    };
  }
  try {
    const db = new import_node_sqlite3.DatabaseSync(tmpCookiesPath, { readOnly: true });
    const firefoxColumns = new Set(
      db.prepare("PRAGMA table_info(moz_cookies)").all().map(
        (column) => column.name
      )
    );
    const partitionColumn = firefoxColumns.has("isPartitionedAttributeSet") ? ", isPartitionedAttributeSet" : "";
    const rows = db.prepare(
      `SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite${partitionColumn} FROM moz_cookies`
    ).all();
    db.close();
    diag(`  Firefox source has ${rows.length} cookies`);
    if (rows.length === 0) {
      (0, import_node_fs15.rmSync)(tmpDir, { recursive: true, force: true });
      return { ok: false, reason: "No cookies found in Firefox." };
    }
    const now = Math.floor(Date.now() / 1e3);
    const validated = [];
    for (const row of rows) {
      if (!row.name || !row.host) {
        continue;
      }
      if (row.expiry > 0 && row.expiry < now) {
        continue;
      }
      const domain = row.host;
      const secure = row.isSecure === 1;
      const url = deriveUrl(domain, secure);
      if (!url) {
        continue;
      }
      validated.push({
        url,
        name: row.name,
        value: row.value ?? "",
        domain,
        path: row.path || "/",
        secure,
        httpOnly: row.isHttpOnly === 1,
        sameSite: databaseSameSite(row.sameSite),
        expirationDate: row.expiry > 0 ? row.expiry : void 0,
        partition: readFirefoxRowPartition(row, firefoxColumns)
      });
    }
    (0, import_node_fs15.rmSync)(tmpDir, { recursive: true, force: true });
    if (validated.length === 0) {
      return { ok: false, reason: "No valid cookies found in Firefox." };
    }
    return importValidatedCookies(
      validated,
      rows.length,
      cookieImportTarget(targetPartition),
      "replace-imported-domains",
      options
    );
  } catch (err) {
    (0, import_node_fs15.rmSync)(tmpDir, { recursive: true, force: true });
    diag(`  Firefox import failed: ${String(err)}`);
    return {
      ok: false,
      reason: "Could not import cookies from Firefox. Try closing Firefox first."
    };
  }
}

// src/main/browser/browser-cookie-safari-import.ts
var import_node_fs16 = require("fs");

// src/main/browser/browser-cookie-safari-parser.ts
var MAC_EPOCH_DELTA = 978307200;
function decodeSafariBinaryCookies(buffer) {
  if (buffer.length < 8) {
    return [];
  }
  if (buffer.subarray(0, 4).toString("utf8") !== "cook") {
    return [];
  }
  const pageCount = buffer.readUInt32BE(4);
  let cursor = 8;
  if (cursor + pageCount * 4 > buffer.length) {
    return [];
  }
  const pageSizes = [];
  for (let i = 0; i < pageCount; i++) {
    pageSizes.push(buffer.readUInt32BE(cursor));
    cursor += 4;
  }
  const cookies = [];
  for (const pageSize of pageSizes) {
    const page = buffer.subarray(cursor, cursor + pageSize);
    cursor += pageSize;
    appendSafariCookies(cookies, decodeSafariPage(page));
  }
  return cookies;
}
function appendSafariCookies(target, cookies) {
  for (const cookie of cookies) {
    target.push(cookie);
  }
}
function decodeSafariPage(page) {
  if (page.length < 16) {
    return [];
  }
  if (page.readUInt32BE(0) !== 256) {
    return [];
  }
  const cookieCount = page.readUInt32LE(4);
  if (8 + cookieCount * 4 > page.length) {
    return [];
  }
  const offsets = [];
  let cursor = 8;
  for (let i = 0; i < cookieCount; i++) {
    offsets.push(page.readUInt32LE(cursor));
    cursor += 4;
  }
  const cookies = [];
  for (const offset of offsets) {
    const cookie = decodeSafariCookie(page.subarray(offset));
    if (cookie) {
      cookies.push(cookie);
    }
  }
  return cookies;
}
function decodeSafariCookie(buf) {
  if (buf.length < 48) {
    return null;
  }
  const size = Math.min(buf.readUInt32LE(0), buf.length);
  if (size < 48) {
    return null;
  }
  const flags = buf.readUInt32LE(8);
  const secure = (flags & 1) !== 0;
  const httpOnly = (flags & 4) !== 0;
  const urlOffset = buf.readUInt32LE(16);
  const nameOffset = buf.readUInt32LE(20);
  const pathOffset = buf.readUInt32LE(24);
  const valueOffset = buf.readUInt32LE(28);
  const expiration = buf.length >= 48 ? buf.readDoubleLE(40) : 0;
  const name = readCString(buf, nameOffset, size);
  if (!name) {
    return null;
  }
  const value = readCString(buf, valueOffset, size) ?? "";
  const path = readCString(buf, pathOffset, size) ?? "/";
  const rawUrl = readCString(buf, urlOffset, size) ?? "";
  const domain = rawUrl.startsWith(".") ? rawUrl : rawUrl || null;
  if (!domain) {
    return null;
  }
  const url = deriveUrl(domain, secure);
  if (!url) {
    return null;
  }
  const expirationDate = expiration > 0 ? Math.round(expiration + MAC_EPOCH_DELTA) : void 0;
  return {
    url,
    name,
    value,
    domain,
    path,
    secure,
    httpOnly,
    sameSite: "unspecified",
    expirationDate,
    // Why: Cookies.binarycookies has no partition field — Safari's format predates CHIPS, so every
    // decoded cookie is genuinely unpartitioned rather than missing an identity.
    partition: { status: "unpartitioned" }
  };
}
function readCString(buf, offset, end) {
  if (offset < 0 || offset >= end) {
    return null;
  }
  let cursor = offset;
  while (cursor < end && buf[cursor] !== 0) {
    cursor++;
  }
  if (cursor >= end) {
    return null;
  }
  return buf.toString("utf8", offset, cursor);
}

// src/main/browser/browser-cookie-safari-import.ts
async function importCookiesFromSafari(browser, targetPartition) {
  diag(`importCookiesFromSafari: partition="${targetPartition}"`);
  let data;
  try {
    data = (0, import_node_fs16.readFileSync)(browser.cookiesPath);
  } catch (err) {
    diag(`  Safari read failed: ${String(err)}`);
    const isPermError = err instanceof Error && "code" in err && err.code === "EPERM";
    if (isPermError) {
      return {
        ok: false,
        reason: "macOS denied access to Safari cookies. Grant Full Disk Access to Orca in System Settings \u2192 Privacy & Security \u2192 Full Disk Access."
      };
    }
    return { ok: false, reason: "Could not read Safari cookies." };
  }
  try {
    const cookies = decodeSafariBinaryCookies(data);
    diag(`  Safari source has ${cookies.length} cookies`);
    if (cookies.length === 0) {
      return { ok: false, reason: "No cookies found in Safari." };
    }
    const now = Math.floor(Date.now() / 1e3);
    const valid = cookies.filter((c) => !c.expirationDate || c.expirationDate > now);
    if (valid.length === 0) {
      return { ok: false, reason: "All Safari cookies are expired." };
    }
    return importValidatedCookies(
      valid,
      cookies.length,
      cookieImportTarget(targetPartition),
      "replace-imported-domains"
    );
  } catch (err) {
    diag(`  Safari import failed: ${String(err)}`);
    return { ok: false, reason: "Could not import cookies from Safari." };
  }
}

// src/main/browser/browser-cookie-import.ts
function detectInstalledBrowsers2() {
  return detectInstalledBrowsers();
}
function selectBrowserProfile2(browser, profileDirectory) {
  return selectBrowserProfile(browser, profileDirectory);
}
async function pickCookieFile2(parentWindow) {
  return pickCookieFile(parentWindow);
}
async function importCookiesFromFile2(filePath, targetPartition) {
  return importCookiesFromFile(filePath, targetPartition);
}
async function importCookiesFromBrowser(browser, targetPartition, options = {}) {
  if (browser.family === "firefox") {
    return importCookiesFromFirefox(browser, targetPartition, options);
  }
  if (browser.family === "safari") {
    return importCookiesFromSafari(browser, targetPartition);
  }
  return importChromiumCookies(browser, targetPartition, options);
}

// src/main/ipc/browser-session-profile-ipc.ts
function registerBrowserSessionProfileHandlers() {
  import_electron24.ipcMain.removeHandler("browser:session:listProfiles");
  import_electron24.ipcMain.removeHandler("browser:session:createProfile");
  import_electron24.ipcMain.removeHandler("browser:session:deleteProfile");
  import_electron24.ipcMain.removeHandler("browser:identity:get");
  import_electron24.ipcMain.removeHandler("browser:identity:set");
  import_electron24.ipcMain.removeHandler("browser:session:importCookies");
  import_electron24.ipcMain.removeHandler("browser:session:resolvePartition");
  import_electron24.ipcMain.handle("browser:session:listProfiles", (event) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return [];
    }
    return browserSessionRegistry.listProfiles();
  });
  import_electron24.ipcMain.handle(
    "browser:session:createProfile",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return null;
      }
      return await browserSessionRegistry.createProfile(args.scope, args.label);
    }
  );
  import_electron24.ipcMain.handle("browser:identity:get", (event) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return null;
    }
    return getBrowserIdentityModeStatus();
  });
  import_electron24.ipcMain.handle("browser:identity:set", async (event, mode) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return null;
    }
    if (mode !== "clean" && mode !== "native") {
      throw new Error(`Unsupported browser identity mode: ${String(mode)}`);
    }
    return setBrowserIdentityMode(mode);
  });
  import_electron24.ipcMain.handle(
    "browser:session:deleteProfile",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return false;
      }
      return browserSessionRegistry.deleteProfile(args.profileId);
    }
  );
  import_electron24.ipcMain.handle(
    "browser:session:importCookies",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return { ok: false, reason: "Not authorized" };
      }
      const profile = browserSessionRegistry.getProfile(args.profileId);
      if (!profile) {
        return { ok: false, reason: "Session profile not found." };
      }
      const parent = getBrowserHost().getMainWindow();
      const filePath = await pickCookieFile2(parent);
      if (!filePath) {
        return { ok: false, reason: "canceled" };
      }
      const result = await importCookiesFromFile2(filePath, profile.partition);
      if (result.ok) {
        browserSessionRegistry.updateProfileSource(args.profileId, {
          browserFamily: "manual",
          importedAt: Date.now()
        });
        return { ...result, profileId: args.profileId };
      }
      return result;
    }
  );
  import_electron24.ipcMain.handle(
    "browser:session:resolvePartition",
    (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return null;
      }
      return browserSessionRegistry.resolvePartition(args.profileId);
    }
  );
  import_electron24.ipcMain.removeHandler("browser:session:clearDefaultCookies");
  import_electron24.ipcMain.handle("browser:session:clearDefaultCookies", async (event) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false;
    }
    return browserSessionRegistry.clearDefaultSessionCookies();
  });
  import_electron24.ipcMain.removeHandler("browser:session:detectBrowsers");
  import_electron24.ipcMain.removeHandler("browser:session:importFromBrowser");
  import_electron24.ipcMain.handle("browser:session:detectBrowsers", (event) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return [];
    }
    return detectedBrowserPickerEntries();
  });
  import_electron24.ipcMain.handle(
    "browser:session:importFromBrowser",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return { ok: false, reason: "Not authorized" };
      }
      const profile = browserSessionRegistry.getProfile(args.profileId);
      if (!profile) {
        return { ok: false, reason: "Session profile not found." };
      }
      if (args.browserProfile && (/[/\\]/.test(args.browserProfile) || args.browserProfile.includes(".."))) {
        return { ok: false, reason: "Invalid browser profile name." };
      }
      const browsers = detectInstalledBrowsers2();
      let browser = browsers.find((b) => b.family === args.browserFamily);
      if (!browser) {
        return { ok: false, reason: "Browser not found on this system." };
      }
      if (args.browserProfile && args.browserProfile !== browser.selectedProfile) {
        const reselected = selectBrowserProfile2(browser, args.browserProfile);
        if (!reselected) {
          return {
            ok: false,
            reason: `No cookies database found for profile "${args.browserProfile}".`
          };
        }
        browser = reselected;
      }
      const result = await importCookiesFromBrowser(browser, profile.partition);
      if (result.ok) {
        const profileName = browser.profiles.find((p) => p.directory === browser.selectedProfile)?.name ?? browser.selectedProfile;
        browserSessionRegistry.updateProfileSource(args.profileId, {
          browserFamily: browser.family,
          profileName,
          importedAt: Date.now()
        });
        return { ...result, profileId: args.profileId };
      }
      return result;
    }
  );
}
function detectedBrowserPickerEntries() {
  return detectInstalledBrowsers2().map((browser) => ({
    family: browser.family,
    label: browser.label,
    profiles: browser.profiles,
    selectedProfile: browser.selectedProfile
  }));
}

// src/main/browser-profiles-installer.ts
var import_electron25 = require("electron");
var installBrowserProfiles = (options) => {
  const { userDataDir } = options.host;
  if (!isBrowserIdentityModeStoreInitialized()) {
    initializeBrowserIdentityModeStore((0, import_node_path16.join)(userDataDir, "orca-browser"));
  }
  browserSessionRegistry.configure({ userDataDir });
  initializeBrowserSessionsForApp({ userDataDir });
  const unregisterPartitionSource = registerAllowedBrowserPartitionSource(
    (partition) => browserSessionRegistry.isAllowedPartition(partition)
  );
  registerBrowserSessionProfileHandlers();
  return () => {
    for (const channel of BROWSER_PROFILE_INVOKE_CHANNELS) {
      import_electron25.ipcMain.removeHandler(channel);
    }
    unregisterPartitionSource();
  };
};

// src/main/plugin-installers.ts
var pluginInstallers = [
  installBrowserCore,
  installBrowserProfiles
];

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
