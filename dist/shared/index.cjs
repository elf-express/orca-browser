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

// src/shared/index.ts
var shared_exports = {};
__export(shared_exports, {
  BROWSER_AGENT_IMAGE_NAMES: () => BROWSER_AGENT_IMAGE_NAMES,
  BROWSER_API_GLOBAL_KEY: () => BROWSER_API_GLOBAL_KEY,
  BROWSER_EVENT_CHANNELS: () => BROWSER_EVENT_CHANNELS,
  BROWSER_FAMILY_LABELS: () => BROWSER_FAMILY_LABELS,
  BROWSER_GRAB_INVOKE_CHANNELS: () => BROWSER_GRAB_INVOKE_CHANNELS,
  BROWSER_INVOKE_CHANNELS: () => BROWSER_INVOKE_CHANNELS,
  BROWSER_PAGE_ZOOM_LEVELS: () => BROWSER_PAGE_ZOOM_LEVELS,
  BROWSER_PAGE_ZOOM_MAX: () => BROWSER_PAGE_ZOOM_MAX,
  BROWSER_PAGE_ZOOM_MIN: () => BROWSER_PAGE_ZOOM_MIN,
  BROWSER_PAGE_ZOOM_STEP: () => BROWSER_PAGE_ZOOM_STEP,
  BROWSER_PROFILE_INVOKE_CHANNELS: () => BROWSER_PROFILE_INVOKE_CHANNELS,
  BROWSER_SEND_CHANNELS: () => BROWSER_SEND_CHANNELS,
  BROWSER_VIEWPORT_PRESETS: () => BROWSER_VIEWPORT_PRESETS,
  DEFAULT_BROWSER_PAGE_ZOOM_LEVEL: () => DEFAULT_BROWSER_PAGE_ZOOM_LEVEL,
  DEFAULT_BROWSER_PLUGIN_SETTINGS: () => DEFAULT_BROWSER_PLUGIN_SETTINGS,
  DEFAULT_MCP_PORT: () => DEFAULT_MCP_PORT,
  DEFAULT_SEARCH_ENGINE: () => DEFAULT_SEARCH_ENGINE,
  GRAB_BUDGET: () => GRAB_BUDGET,
  GRAB_SAFE_ATTRIBUTE_NAMES: () => GRAB_SAFE_ATTRIBUTE_NAMES,
  GRAB_SECRET_PATTERNS: () => GRAB_SECRET_PATTERNS,
  MAX_BROWSER_HISTORY_ENTRIES: () => MAX_BROWSER_HISTORY_ENTRIES,
  ORCA_BROWSER_BLANK_URL: () => ORCA_BROWSER_BLANK_URL,
  ORCA_BROWSER_GUEST_WEB_PREFERENCES: () => ORCA_BROWSER_GUEST_WEB_PREFERENCES,
  ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE: () => ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE,
  ORCA_BROWSER_PARTITION: () => ORCA_BROWSER_PARTITION,
  PACKAGE_LOG_PREFIX: () => PACKAGE_LOG_PREFIX,
  SEARCH_ENGINE_LABELS: () => SEARCH_ENGINE_LABELS,
  asBrowserFindTarget: () => asBrowserFindTarget,
  browserPageZoomLevelToPercent: () => browserPageZoomLevelToPercent,
  browserViewportPresetToOverride: () => browserViewportPresetToOverride,
  buildSearchUrl: () => buildSearchUrl,
  classifySchemeLessLocalDevAddress: () => classifySchemeLessLocalDevAddress,
  formatBrowserShortcutLabel: () => formatBrowserShortcutLabel,
  getBrowserViewportPreset: () => getBrowserViewportPreset,
  isAbsoluteFilesystemPathInput: () => isAbsoluteFilesystemPathInput,
  isAriaAttribute: () => isAriaAttribute,
  isEligibleLocalCertificateHost: () => isEligibleLocalCertificateHost,
  isFileUrl: () => isFileUrl,
  looksLikeSearchQuery: () => looksLikeSearchQuery,
  matchBrowserShortcut: () => matchBrowserShortcut,
  nextBrowserPageZoomLevel: () => nextBrowserPageZoomLevel,
  normalizeBrowserHistoryUrl: () => normalizeBrowserHistoryUrl,
  normalizeBrowserNavigationUrl: () => normalizeBrowserNavigationUrl,
  normalizeBrowserPageZoomLevel: () => normalizeBrowserPageZoomLevel,
  normalizeBrowserPluginSettings: () => normalizeBrowserPluginSettings,
  normalizeExternalBrowserUrl: () => normalizeExternalBrowserUrl,
  normalizeKagiSessionLink: () => normalizeKagiSessionLink,
  pngDataUrlToAgentImage: () => pngDataUrlToAgentImage,
  redactKagiSessionToken: () => redactKagiSessionToken,
  resolveRemoteFailureExternalUrl: () => resolveRemoteFailureExternalUrl,
  sanitizeAgentPageUrl: () => sanitizeAgentPageUrl,
  toHttpsRecoveryUrl: () => toHttpsRecoveryUrl,
  toSecureCertificateEndpoint: () => toSecureCertificateEndpoint
});
module.exports = __toCommonJS(shared_exports);

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

// src/shared/constants.ts
var DEFAULT_MCP_PORT = 47821;
var BROWSER_API_GLOBAL_KEY = "browserAPI";
var PACKAGE_LOG_PREFIX = "orca-browser:";
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

// src/shared/browser-ipc-channels.ts
var BROWSER_INVOKE_CHANNELS = [
  "browser:registerGuest",
  "browser:isGuestRegistered",
  "browser:repairGuestRegistration",
  "browser:unregisterGuest",
  "browser:activeTabChanged",
  "browser:openDevTools",
  "browser:openExternal",
  "browser:writeClipboardText",
  "browser:setViewportOverride",
  "browser:setAnnotationViewportBridge"
];
var BROWSER_EVENT_CHANNELS = [
  "browser:guest-load-failed",
  "browser:permission-denied",
  "browser:popup",
  "browser:context-menu-requested",
  "browser:context-menu-dismissed",
  "browser:open-link-in-orca-tab",
  "browser:focusAddressBar",
  "browser:reloadPage",
  "browser:hardReloadPage",
  "browser:findInPage",
  "browser:historyNavigate",
  "browser:zoomPage",
  "browser:scrollPage",
  "browser:systemResumed",
  "browser:grabModeToggle",
  "browser:grabActionShortcut"
];
var BROWSER_GRAB_INVOKE_CHANNELS = [
  "browser:setGrabMode",
  "browser:awaitGrabSelection",
  "browser:cancelGrab",
  "browser:captureSelectionScreenshot",
  "browser:extractHoverPayload"
];
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
  "browser:identity:set",
  "browser:settings:get",
  "browser:settings:set"
];
var BROWSER_SEND_CHANNELS = ["browser:reportViewportScrollState"];

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

// src/shared/browser-find-source.ts
function asBrowserFindTarget(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const target = value;
  if (typeof target.browserPageId !== "string" || target.browserPageId.length === 0) {
    return null;
  }
  if (target.browserWorkspaceId === void 0) {
    return { browserPageId: target.browserPageId };
  }
  if (typeof target.browserWorkspaceId !== "string" || target.browserWorkspaceId.length === 0) {
    return null;
  }
  return { browserPageId: target.browserPageId, browserWorkspaceId: target.browserWorkspaceId };
}

// src/shared/browser-guest-web-preferences.ts
var ORCA_BROWSER_GUEST_WEB_PREFERENCES = {
  disableHtmlFullscreenWindowResize: true
};
var ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE = "disableHtmlFullscreenWindowResize=true";

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
function isWildcardBindHost(hostname) {
  const normalized = normalizeCertificateHostname(hostname);
  return normalized === "0.0.0.0" || normalized === "::";
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
function toSecureCertificateEndpoint(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "wss:") {
      return null;
    }
    const normalizedHostname = normalizeCertificateHostname(parsed.hostname);
    if (!normalizedHostname) {
      return null;
    }
    const endpointHost = normalizedHostname.includes(":") ? `[${normalizedHostname}]` : normalizedHostname;
    return `https://${endpointHost}:${parsed.port || "443"}`;
  } catch {
    return null;
  }
}
function resolveRemoteFailureExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (isWildcardBindHost(parsed.hostname) || isEligibleLocalCertificateHost(parsed.hostname)) {
      return null;
    }
  } catch {
    return null;
  }
  return normalizeExternalBrowserUrl(rawUrl);
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
function isAbsoluteFilesystemPathInput(input) {
  return UNIX_ABSOLUTE_PATH_PATTERN.test(input) || WINDOWS_ABSOLUTE_PATH_PATTERN.test(input) || WINDOWS_UNC_PATH_PATTERN.test(input);
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
var GRAB_SAFE_ATTRIBUTE_NAMES = /* @__PURE__ */ new Set([
  "id",
  "class",
  "name",
  "type",
  "role",
  "href",
  "src",
  "alt",
  "title",
  "placeholder",
  "for",
  "action",
  "method"
]);
function isAriaAttribute(name) {
  return name.startsWith("aria-");
}
var GRAB_SECRET_PATTERNS = [
  "access_token",
  "auth_token",
  "api_key",
  "apikey",
  "client_secret",
  "oauth_state",
  "x-amz-",
  "session_id",
  "sessionid",
  "csrf",
  "secret",
  "password",
  "passwd"
];

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

// src/shared/browser-plugin-settings.ts
var DEFAULT_BROWSER_PLUGIN_SETTINGS = {
  searchEngine: DEFAULT_SEARCH_ENGINE,
  importHintHidden: false
};
var SEARCH_ENGINES = ["google", "duckduckgo", "bing", "kagi"];
function normalizeBrowserPluginSettings(raw) {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_BROWSER_PLUGIN_SETTINGS };
  }
  const { searchEngine, importHintHidden } = raw;
  return {
    searchEngine: SEARCH_ENGINES.includes(searchEngine) ? searchEngine : DEFAULT_SEARCH_ENGINE,
    importHintHidden: typeof importHintHidden === "boolean" ? importHintHidden : false
  };
}

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BROWSER_AGENT_IMAGE_NAMES,
  BROWSER_API_GLOBAL_KEY,
  BROWSER_EVENT_CHANNELS,
  BROWSER_FAMILY_LABELS,
  BROWSER_GRAB_INVOKE_CHANNELS,
  BROWSER_INVOKE_CHANNELS,
  BROWSER_PAGE_ZOOM_LEVELS,
  BROWSER_PAGE_ZOOM_MAX,
  BROWSER_PAGE_ZOOM_MIN,
  BROWSER_PAGE_ZOOM_STEP,
  BROWSER_PROFILE_INVOKE_CHANNELS,
  BROWSER_SEND_CHANNELS,
  BROWSER_VIEWPORT_PRESETS,
  DEFAULT_BROWSER_PAGE_ZOOM_LEVEL,
  DEFAULT_BROWSER_PLUGIN_SETTINGS,
  DEFAULT_MCP_PORT,
  DEFAULT_SEARCH_ENGINE,
  GRAB_BUDGET,
  GRAB_SAFE_ATTRIBUTE_NAMES,
  GRAB_SECRET_PATTERNS,
  MAX_BROWSER_HISTORY_ENTRIES,
  ORCA_BROWSER_BLANK_URL,
  ORCA_BROWSER_GUEST_WEB_PREFERENCES,
  ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE,
  ORCA_BROWSER_PARTITION,
  PACKAGE_LOG_PREFIX,
  SEARCH_ENGINE_LABELS,
  asBrowserFindTarget,
  browserPageZoomLevelToPercent,
  browserViewportPresetToOverride,
  buildSearchUrl,
  classifySchemeLessLocalDevAddress,
  formatBrowserShortcutLabel,
  getBrowserViewportPreset,
  isAbsoluteFilesystemPathInput,
  isAriaAttribute,
  isEligibleLocalCertificateHost,
  isFileUrl,
  looksLikeSearchQuery,
  matchBrowserShortcut,
  nextBrowserPageZoomLevel,
  normalizeBrowserHistoryUrl,
  normalizeBrowserNavigationUrl,
  normalizeBrowserPageZoomLevel,
  normalizeBrowserPluginSettings,
  normalizeExternalBrowserUrl,
  normalizeKagiSessionLink,
  pngDataUrlToAgentImage,
  redactKagiSessionToken,
  resolveRemoteFailureExternalUrl,
  sanitizeAgentPageUrl,
  toHttpsRecoveryUrl,
  toSecureCertificateEndpoint
});
