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
  getMcpEndpoint: () => getMcpEndpoint,
  getMcpStatus: () => getMcpStatus,
  installBrowserPlugin: () => installBrowserPlugin,
  rotateMcpToken: () => rotateMcpToken
});
module.exports = __toCommonJS(main_exports);

// node_modules/.pnpm/tsup@8.5.1_postcss@8.5.32_typescript@5.9.3/node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// src/main/mcp/install-agent-automation.ts
var import_node_path8 = require("node:path");

// src/main/browser/browser-error.ts
var BrowserError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  code;
};

// src/main/browser/agent-browser-bridge-process.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_module = require("node:module");

// src/main/browser/run-process.ts
var import_node_child_process = require("node:child_process");
function runProcess(spec) {
  return new Promise((resolve, reject) => {
    (0, import_node_child_process.execFile)(
      spec.program,
      [...spec.args],
      {
        env: spec.env,
        timeout: spec.timeoutMs,
        maxBuffer: spec.maxOutputBytes,
        windowsHide: true,
        encoding: "utf8"
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ code: 0, signal: null, stdout, stderr, timedOut: false });
          return;
        }
        const failure = error;
        if (failure.killed && failure.signal) {
          resolve({ code: null, signal: failure.signal, stdout, stderr, timedOut: true });
          return;
        }
        if (typeof failure.code === "number") {
          resolve({ code: failure.code, signal: null, stdout, stderr, timedOut: false });
          return;
        }
        reject(error);
      }
    );
  });
}

// src/main/browser/agent-browser-orphan-sweep.ts
var ORCA_TAB_SESSION_PREFIX = "orca-tab-";
var SWEEP_TIMEOUT_MS = 5e3;
var SWEEP_MAX_OUTPUT_BYTES = 256 * 1024;
function parseSessionNames(stdout) {
  let envelope;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    return [];
  }
  const sessions = envelope?.data?.sessions;
  if (!Array.isArray(sessions)) {
    return [];
  }
  return sessions.filter((name) => typeof name === "string" && name.length > 0);
}
async function sweepOrphanedAgentBrowserSessions(options) {
  if (!options.ownsSocketDirectory || process.env.ORCA_DISABLE_AGENT_BROWSER_SWEEP === "1") {
    return [];
  }
  let listed;
  try {
    const result = await runProcess({
      program: options.binaryPath,
      args: ["session", "list", "--json"],
      env: options.env,
      timeoutMs: SWEEP_TIMEOUT_MS,
      maxOutputBytes: SWEEP_MAX_OUTPUT_BYTES
    });
    listed = result.timedOut ? [] : parseSessionNames(result.stdout);
  } catch {
    return [];
  }
  const closed = [];
  for (const sessionName of listed) {
    if (!sessionName.startsWith(ORCA_TAB_SESSION_PREFIX) || options.isSessionLive?.(sessionName)) {
      continue;
    }
    try {
      await runProcess({
        program: options.binaryPath,
        args: ["--session", sessionName, "close"],
        env: options.env,
        timeoutMs: SWEEP_TIMEOUT_MS,
        maxOutputBytes: SWEEP_MAX_OUTPUT_BYTES
      });
      closed.push(sessionName);
    } catch {
    }
  }
  return closed;
}

// src/main/browser/agent-browser-bridge-types.ts
var EXEC_TIMEOUT_MS = 9e4;
var CONSECUTIVE_TIMEOUT_LIMIT = 3;
var WAIT_PROCESS_TIMEOUT_GRACE_MS = 1e3;
var STALE_SESSION_CLOSE_TIMEOUT_MS = 3e3;
var AGENT_BROWSER_EXIT_DRAIN_MS = 500;
var AGENT_BROWSER_CLEANUP_TIMEOUT_MS = 5e3;
var AGENT_BROWSER_CLEANUP_CONCURRENCY = 4;
var EMBEDDED_NAVIGATION_TIMEOUT_MS = 3e4;
var AGENT_BROWSER_TEXT_ARGUMENT_MAX_BYTES = 8 * 1024;
var AGENT_BROWSER_CLIPBOARD_WRITE_MAX_BYTES = AGENT_BROWSER_TEXT_ARGUMENT_MAX_BYTES;

// src/main/browser/agent-browser-bridge-process.ts
function agentBrowserNativeName() {
  const ext = process.platform === "win32" ? ".exe" : "";
  return `agent-browser-${process.platform}-${process.arch}${ext}`;
}
function defaultAgentBrowserPackageBinDirs() {
  const dirs = [];
  const add = (resolveManifest) => {
    try {
      const dir = (0, import_node_path.join)((0, import_node_path.dirname)(resolveManifest()), "bin");
      if (!dirs.includes(dir)) {
        dirs.push(dir);
      }
    } catch {
    }
  };
  const localRequire = (0, import_node_module.createRequire)(importMetaUrl);
  add(() => localRequire.resolve("agent-browser/package.json"));
  add(() => {
    const pluginManifest = localRequire.resolve("@elf-express/orca-browser/package.json");
    return (0, import_node_module.createRequire)(pluginManifest).resolve("agent-browser/package.json");
  });
  return dirs;
}
function resolveAgentBrowserBinary(options) {
  const name = agentBrowserNativeName();
  const bundled = (0, import_node_path.join)(options.resourcesPath, name);
  const packageCandidates = (options.packageBinDirs ?? defaultAgentBrowserPackageBinDirs()).map(
    (dir) => (0, import_node_path.join)(dir, name)
  );
  const expectedPaths = [.../* @__PURE__ */ new Set([bundled, ...packageCandidates])];
  if ((0, import_node_fs.existsSync)(bundled)) {
    return { found: true, path: bundled };
  }
  for (const candidate of packageCandidates) {
    if (!(0, import_node_fs.existsSync)(candidate)) {
      continue;
    }
    if (process.platform !== "win32") {
      try {
        (0, import_node_fs.accessSync)(candidate, import_node_fs.constants.X_OK);
      } catch {
        (0, import_node_fs.chmodSync)(candidate, 493);
      }
    }
    return { found: true, path: candidate };
  }
  return { found: false, expectedPaths };
}
function parseShellArgs(input) {
  const args = [];
  let current3 = "";
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === " " && !inDouble && !inSingle) {
      if (current3) {
        args.push(current3);
        current3 = "";
      }
    } else {
      current3 += ch;
    }
  }
  if (current3) {
    args.push(current3);
  }
  return args;
}
function stripAgentBrowserTargetArgs(args) {
  const stripped = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--cdp" || arg === "--session") {
      index++;
      continue;
    }
    if (arg.startsWith("--cdp=") || arg.startsWith("--session=")) {
      continue;
    }
    stripped.push(arg);
  }
  return stripped;
}
function classifyErrorCode(message) {
  if (/unknown ref|ref not found|element not found: @e/i.test(message)) {
    return "browser_stale_ref";
  }
  return "browser_error";
}
function isAbortedNavigationError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const { code, errno } = error;
  return code === "ERR_ABORTED" || errno === -3;
}
function isWebContentsLoading(wc) {
  try {
    return wc.isLoading();
  } catch {
    return false;
  }
}
function waitForAbortedNavigationReplacement(wc, browserPageId, timeoutMs) {
  if (!isWebContentsLoading(wc)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout = null;
    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      wc.removeListener("did-stop-loading", onDidStopLoading);
      wc.removeListener("destroyed", onDestroyed);
      if (timeout) {
        clearTimeout(timeout);
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const onDidStopLoading = () => finish();
    const onDestroyed = () => finish();
    wc.on("did-stop-loading", onDidStopLoading);
    wc.on("destroyed", onDestroyed);
    timeout = setTimeout(
      () => finish(
        new BrowserError(
          "browser_error",
          `Failed to navigate browser page ${browserPageId}: Browser navigation timed out after ${EMBEDDED_NAVIGATION_TIMEOUT_MS}ms`
        )
      ),
      timeoutMs
    );
    timeout.unref?.();
    if (!isWebContentsLoading(wc)) {
      finish();
    }
  });
}
function isTabClosedTransportError(message) {
  return /session destroyed while command|session destroyed while commands|connection refused|cdp discovery methods failed|websocket connect failed/i.test(
    message
  );
}
function pageUnavailableMessageForSession(sessionName) {
  const prefix = ORCA_TAB_SESSION_PREFIX;
  const browserPageId = sessionName.startsWith(prefix) ? sessionName.slice(prefix.length) : null;
  return browserPageId ? `Browser page ${browserPageId} is no longer available` : "Browser tab is no longer available";
}

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

// src/main/browser/cdp-keyboard-us-layout.ts
var CDP_MODIFIER_BITS = {
  alt: 1,
  option: 1,
  ctrl: 2,
  control: 2,
  cmd: 4,
  command: 4,
  meta: 4,
  super: 4,
  win: 4,
  shift: 8
};
var CDP_NAMED_KEYS = {
  enter: [13, "Enter", "Enter", "\r"],
  return: [13, "Enter", "Enter", "\r"],
  tab: [9, "Tab", "Tab", null],
  backspace: [8, "Backspace", "Backspace", null],
  delete: [46, "Delete", "Delete", null],
  del: [46, "Delete", "Delete", null],
  escape: [27, "Escape", "Escape", null],
  esc: [27, "Escape", "Escape", null],
  space: [32, " ", "Space", " "],
  spacebar: [32, " ", "Space", " "],
  arrowup: [38, "ArrowUp", "ArrowUp", null],
  up: [38, "ArrowUp", "ArrowUp", null],
  arrowdown: [40, "ArrowDown", "ArrowDown", null],
  down: [40, "ArrowDown", "ArrowDown", null],
  arrowleft: [37, "ArrowLeft", "ArrowLeft", null],
  left: [37, "ArrowLeft", "ArrowLeft", null],
  arrowright: [39, "ArrowRight", "ArrowRight", null],
  right: [39, "ArrowRight", "ArrowRight", null],
  home: [36, "Home", "Home", null],
  end: [35, "End", "End", null],
  pageup: [33, "PageUp", "PageUp", null],
  pgup: [33, "PageUp", "PageUp", null],
  pagedown: [34, "PageDown", "PageDown", null],
  pgdn: [34, "PageDown", "PageDown", null],
  pgdown: [34, "PageDown", "PageDown", null],
  insert: [45, "Insert", "Insert", null],
  ins: [45, "Insert", "Insert", null],
  contextmenu: [93, "ContextMenu", "ContextMenu", null],
  apps: [93, "ContextMenu", "ContextMenu", null],
  capslock: [20, "CapsLock", "CapsLock", null],
  numlock: [144, "NumLock", "NumLock", null],
  scrolllock: [145, "ScrollLock", "ScrollLock", null],
  pause: [19, "Pause", "Pause", null],
  printscreen: [44, "PrintScreen", "PrintScreen", null],
  shift: [16, "Shift", "ShiftLeft", null],
  control: [17, "Control", "ControlLeft", null],
  ctrl: [17, "Control", "ControlLeft", null],
  alt: [18, "Alt", "AltLeft", null],
  option: [18, "Alt", "AltLeft", null],
  meta: [91, "Meta", "MetaLeft", null],
  cmd: [91, "Meta", "MetaLeft", null],
  command: [91, "Meta", "MetaLeft", null]
};
var US_SHIFTED_CHARS = {
  "~": "`",
  "!": "1",
  "@": "2",
  "#": "3",
  $: "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
  ")": "0",
  _: "-",
  "+": "=",
  "{": "[",
  "}": "]",
  "|": "\\",
  ":": ";",
  '"': "'",
  "<": ",",
  ">": ".",
  "?": "/"
};
var US_SHIFT_OF = {};
for (const shifted of Object.keys(US_SHIFTED_CHARS)) {
  US_SHIFT_OF[US_SHIFTED_CHARS[shifted]] = shifted;
}
var US_PUNCTUATION_KEYS = {
  " ": [32, "Space"],
  ";": [186, "Semicolon"],
  "=": [187, "Equal"],
  ",": [188, "Comma"],
  "-": [189, "Minus"],
  ".": [190, "Period"],
  "/": [191, "Slash"],
  "`": [192, "Backquote"],
  "[": [219, "BracketLeft"],
  "\\": [220, "Backslash"],
  "]": [221, "BracketRight"],
  "'": [222, "Quote"]
};
function usKeyboardKeyForChar(ch) {
  if (ch >= "a" && ch <= "z") {
    return { keyCode: ch.charCodeAt(0) - 32, code: `Key${ch.toUpperCase()}`, shift: false };
  }
  if (ch >= "A" && ch <= "Z") {
    return { keyCode: ch.charCodeAt(0), code: `Key${ch}`, shift: true };
  }
  if (ch >= "0" && ch <= "9") {
    return { keyCode: ch.charCodeAt(0), code: `Digit${ch}`, shift: false };
  }
  if (Object.hasOwn(US_SHIFTED_CHARS, ch)) {
    const base = usKeyboardKeyForChar(US_SHIFTED_CHARS[ch]);
    return base === null ? null : { keyCode: base.keyCode, code: base.code, shift: true };
  }
  if (Object.hasOwn(US_PUNCTUATION_KEYS, ch)) {
    return { keyCode: US_PUNCTUATION_KEYS[ch][0], code: US_PUNCTUATION_KEYS[ch][1], shift: false };
  }
  return null;
}
function imeFallbackKeyEvent(raw) {
  if (raw.length !== 1) {
    return null;
  }
  const codePoint = raw.charCodeAt(0);
  if (codePoint < 160 || codePoint >= 55296 && codePoint <= 57343) {
    return null;
  }
  return { keyCode: 229, key: raw, code: "", modifiers: 0, location: 0, selfModifier: 0, text: raw };
}
function parseCdpKeyEvent(raw) {
  if (raw.length === 0) {
    return null;
  }
  let rest = raw;
  let modifiers = 0;
  while (rest.length > 1) {
    const plus = rest.indexOf("+");
    if (plus <= 0) {
      break;
    }
    const name = rest.slice(0, plus).toLowerCase();
    if (!Object.hasOwn(CDP_MODIFIER_BITS, name)) {
      break;
    }
    modifiers |= CDP_MODIFIER_BITS[name];
    rest = rest.slice(plus + 1);
  }
  if (rest.length === 0) {
    return null;
  }
  let keyCode;
  let key;
  let code;
  let text;
  let location = 0;
  let selfModifier = 0;
  if (rest.length === 1) {
    const mapped = usKeyboardKeyForChar(rest);
    if (mapped === null) {
      return null;
    }
    keyCode = mapped.keyCode;
    key = rest;
    code = mapped.code;
    text = rest;
    const capitalShortcut = rest >= "A" && rest <= "Z" && (modifiers & ~8) !== 0;
    if (capitalShortcut) {
      key = rest.toLowerCase();
      text = key;
    } else if (mapped.shift) {
      modifiers |= 8;
    }
  } else if (Object.hasOwn(CDP_NAMED_KEYS, rest.toLowerCase())) {
    const name = rest.toLowerCase();
    const named = CDP_NAMED_KEYS[name];
    keyCode = named[0];
    key = named[1];
    code = named[2];
    text = named[3];
    selfModifier = CDP_MODIFIER_BITS[name] ?? 0;
    if (selfModifier !== 0) {
      modifiers |= selfModifier;
      location = 1;
    }
  } else {
    const functionKey = /^f([1-9]|1[0-9]|2[0-4])$/i.exec(rest);
    if (functionKey === null) {
      return null;
    }
    keyCode = 111 + Number(functionKey[1]);
    key = `F${functionKey[1]}`;
    code = key;
    text = null;
  }
  if (text !== null && (modifiers & 8) !== 0) {
    text = Object.hasOwn(US_SHIFT_OF, text) ? US_SHIFT_OF[text] : text.toUpperCase();
    if (rest.length === 1) {
      key = text;
    }
  }
  if ((modifiers & ~8) !== 0) {
    text = null;
  }
  return { keyCode, key, code, modifiers, location, selfModifier, text };
}

// src/main/browser/agent-browser-bridge-capture-commands.ts
var import_node_fs4 = require("node:fs");

// src/main/browser/cdp-screenshot.ts
var SCREENSHOT_TIMEOUT_MS = 8e3;
var FRAME_PROBE_OFFSETS_MS = [250, 750, 1750, 3750];
var FRAME_PROBE_PARAMS = {
  format: "jpeg",
  quality: 1,
  clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 }
};
var FALLBACK_CAPTURE_TIMEOUT_MS = 1e3;
var SCREENSHOT_TIMEOUT_MESSAGE = "Screenshot timed out \u2014 the browser page did not draw a frame.";
function applyFallbackClip(image, params) {
  if (params?.captureBeyondViewport) {
    return null;
  }
  const clip = params?.clip;
  if (!clip || typeof clip !== "object") {
    return image;
  }
  const clipRect = clip;
  const x = typeof clipRect.x === "number" ? clipRect.x : Number.NaN;
  const y = typeof clipRect.y === "number" ? clipRect.y : Number.NaN;
  const width = typeof clipRect.width === "number" ? clipRect.width : Number.NaN;
  const height = typeof clipRect.height === "number" ? clipRect.height : Number.NaN;
  const scale = typeof clipRect.scale === "number" && Number.isFinite(clipRect.scale) && clipRect.scale > 0 ? clipRect.scale : 1;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  const cropRect = {
    x: Math.round(x * scale),
    y: Math.round(y * scale),
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
  const imageSize = image.getSize();
  if (cropRect.x < 0 || cropRect.y < 0 || cropRect.width <= 0 || cropRect.height <= 0 || cropRect.x + cropRect.width > imageSize.width || cropRect.y + cropRect.height > imageSize.height) {
    return null;
  }
  return image.crop(cropRect);
}
function encodeNativeImageScreenshot(image, params) {
  if (image.isEmpty()) {
    return null;
  }
  const clippedImage = applyFallbackClip(image, params);
  if (!clippedImage || clippedImage.isEmpty()) {
    return null;
  }
  const format = params?.format === "jpeg" ? "jpeg" : "png";
  const quality = typeof params?.quality === "number" && Number.isFinite(params.quality) ? Math.max(0, Math.min(100, Math.round(params.quality))) : void 0;
  const buffer = format === "jpeg" ? clippedImage.toJPEG(quality ?? 90) : clippedImage.toPNG();
  return { data: buffer.toString("base64") };
}
function getLayoutClip(metrics) {
  const size = metrics.cssContentSize ?? metrics.contentSize;
  const width = size?.width;
  const height = size?.height;
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0 || typeof height !== "number" || !Number.isFinite(height) || height <= 0) {
    return null;
  }
  return {
    x: 0,
    y: 0,
    width: Math.ceil(width),
    height: Math.ceil(height),
    scale: 1
  };
}
function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}
function captureUntilDrawn(webContents10, params) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (settle) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(deadline);
      probes.forEach(clearTimeout);
      settle();
    };
    const send = (requestParams) => {
      if (webContents10.isDestroyed()) {
        finish(() => reject(new Error("WebContents destroyed")));
        return null;
      }
      if (!webContents10.debugger.isAttached()) {
        finish(() => reject(new Error("Debugger detached")));
        return null;
      }
      try {
        webContents10.invalidate();
      } catch {
      }
      return webContents10.debugger.sendCommand("Page.captureScreenshot", requestParams);
    };
    const deadline = setTimeout(() => finish(() => resolve(null)), SCREENSHOT_TIMEOUT_MS);
    const probes = FRAME_PROBE_OFFSETS_MS.map(
      (offsetMs) => setTimeout(() => send(FRAME_PROBE_PARAMS)?.catch(() => {
      }), offsetMs)
    );
    send(params)?.then(
      (result) => finish(() => resolve(result?.data ? { data: result.data } : null)),
      (error) => finish(() => reject(error instanceof Error ? error : new Error(String(error))))
    );
  });
}
async function captureFullPageScreenshot(webContents10, format, holdPaint) {
  if (webContents10.isDestroyed()) {
    throw new Error("WebContents destroyed");
  }
  if (!webContents10.debugger.isAttached()) {
    throw new Error("Debugger not attached");
  }
  const release = holdPaint();
  try {
    const layoutMetrics = webContents10.debugger.sendCommand("Page.getLayoutMetrics", {});
    const metrics = await withTimeout(
      layoutMetrics,
      SCREENSHOT_TIMEOUT_MS,
      "Screenshot timed out \u2014 the browser page did not respond."
    );
    const clip = getLayoutClip(metrics);
    if (!clip) {
      throw new Error("Unable to determine full-page screenshot bounds");
    }
    const frame = await captureUntilDrawn(webContents10, {
      format,
      captureBeyondViewport: true,
      clip
    });
    if (!frame) {
      throw new Error(SCREENSHOT_TIMEOUT_MESSAGE);
    }
    return { data: frame.data, format };
  } finally {
    release();
  }
}
async function captureScreenshot(webContents10, params, holdPaint) {
  if (webContents10.isDestroyed()) {
    throw new Error("WebContents destroyed");
  }
  if (!webContents10.debugger.isAttached()) {
    throw new Error("Debugger not attached");
  }
  const screenshotParams = {};
  if (params?.format) {
    screenshotParams.format = params.format;
  }
  if (params?.quality) {
    screenshotParams.quality = params.quality;
  }
  if (params?.clip) {
    screenshotParams.clip = params.clip;
  }
  if (params?.captureBeyondViewport != null) {
    screenshotParams.captureBeyondViewport = params.captureBeyondViewport;
  }
  if (params?.fromSurface != null) {
    screenshotParams.fromSurface = params.fromSurface;
  }
  const release = holdPaint();
  try {
    const frame = await captureUntilDrawn(webContents10, screenshotParams);
    if (frame) {
      return frame;
    }
    const fallback = await withTimeout(
      Promise.resolve().then(() => webContents10.capturePage()),
      FALLBACK_CAPTURE_TIMEOUT_MS,
      SCREENSHOT_TIMEOUT_MESSAGE
    ).then((image) => encodeNativeImageScreenshot(image, params)).catch(() => null);
    if (fallback) {
      return fallback;
    }
    throw new Error(SCREENSHOT_TIMEOUT_MESSAGE);
  } finally {
    release();
  }
}

// src/shared/event-loop-yield.ts
var pendingRendererYields = /* @__PURE__ */ new Map();
var nextRendererYieldId = 0;
var rendererYieldChannel = null;
function isVitestEnvironment() {
  return typeof process !== "undefined" && process.env?.VITEST === "true";
}
function getRendererYieldChannel() {
  if (!rendererYieldChannel) {
    rendererYieldChannel = new globalThis.MessageChannel();
    rendererYieldChannel.port1.onmessage = (event) => {
      const yieldId = event.data;
      const resolve = typeof yieldId === "number" ? pendingRendererYields.get(yieldId) : void 0;
      if (!resolve) {
        return;
      }
      pendingRendererYields.delete(yieldId);
      resolve();
    };
  }
  return rendererYieldChannel;
}
function yieldToEventLoop() {
  return new Promise((resolve) => {
    if (isVitestEnvironment()) {
      globalThis.setTimeout(resolve, 0);
      return;
    }
    const setImmediate = globalThis.setImmediate;
    if (typeof window === "undefined" && setImmediate) {
      setImmediate(resolve);
      return;
    }
    if (typeof globalThis.MessageChannel === "function") {
      const yieldId = nextRendererYieldId;
      nextRendererYieldId += 1;
      pendingRendererYields.set(yieldId, resolve);
      getRendererYieldChannel().port2.postMessage(yieldId);
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
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
function getUtf8ChunkEndIndex(text, startIndex, maxBytes) {
  let bytes = 0;
  let endIndex = startIndex;
  while (endIndex < text.length) {
    const codePoint = readUtf8CodePointAt(text, endIndex);
    const codePointBytes = getUtf8ByteLengthForCodePoint(codePoint);
    if (bytes > 0 && bytes + codePointBytes > maxBytes) {
      break;
    }
    bytes += codePointBytes;
    endIndex += codePoint > 65535 ? 2 : 1;
  }
  return endIndex;
}
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
var CLIPBOARD_TEXT_WRITE_TOO_LARGE_ERROR = "Clipboard text is too large to copy safely.";
var CLIPBOARD_TEXT_MEASURE_YIELD_CODE_UNITS = 256 * 1024;
function measureClipboardTextByteLength(text, options = {}) {
  return measureUtf8ByteLength(text, options);
}
async function measureClipboardTextByteLengthWithYield(text, options = {}) {
  const stopAfterBytes = options.stopAfterBytes;
  const yieldAfterCodeUnits = Math.max(
    1,
    options.yieldAfterCodeUnits ?? CLIPBOARD_TEXT_MEASURE_YIELD_CODE_UNITS
  );
  const yieldBetweenBatches = options.yieldToEventLoop ?? yieldToEventLoop;
  let nextYieldAt = yieldAfterCodeUnits;
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
    if (index >= nextYieldAt) {
      await yieldBetweenBatches();
      nextYieldAt = index + yieldAfterCodeUnits;
    }
  }
  return { byteLength, exceededLimit: false };
}
async function isClipboardTextByteLengthOverLimitWithYield(text, maxBytes, options = {}) {
  if (text.length > maxBytes) {
    return true;
  }
  return (await measureClipboardTextByteLengthWithYield(text, {
    stopAfterBytes: maxBytes,
    yieldAfterCodeUnits: options.yieldAfterCodeUnits,
    yieldToEventLoop: options.yieldToEventLoop
  })).exceededLimit;
}
function getClipboardTextWriteMaxBytes(options, fallback = CLIPBOARD_TEXT_WRITE_MAX_BYTES) {
  return Number.isFinite(options?.maxBytes) && (options?.maxBytes ?? 0) > 0 ? Math.floor(options?.maxBytes ?? fallback) : fallback;
}
async function assertClipboardTextWriteWithinLimitWithYield(text, options) {
  const maxBytes = getClipboardTextWriteMaxBytes(options);
  if (await isClipboardTextByteLengthOverLimitWithYield(text, maxBytes)) {
    throw new Error(CLIPBOARD_TEXT_WRITE_TOO_LARGE_ERROR);
  }
  return text;
}

// src/main/browser/agent-browser-bridge-mouse.ts
var CDP_POINTER_BUTTON_ORDER = ["left", "right", "middle", "back", "forward"];
var CDP_POINTER_BUTTON_MASKS = {
  left: 1,
  right: 2,
  middle: 4,
  back: 8,
  forward: 16
};
function normalizeCdpMouseButton(button) {
  return button === "middle" || button === "right" ? button : "left";
}
function normalizeCdpPointerButton(button) {
  return button === "back" || button === "forward" ? button : normalizeCdpMouseButton(button);
}
function cdpPointerButtonMask(button) {
  return CDP_POINTER_BUTTON_MASKS[button];
}
function cdpPointerButtonFromMask(buttons) {
  for (const button of CDP_POINTER_BUTTON_ORDER) {
    if ((buttons & CDP_POINTER_BUTTON_MASKS[button]) !== 0) {
      return button;
    }
  }
  return "none";
}
function cdpMouseModifierMask(modifiers) {
  if (!modifiers || modifiers.length === 0) {
    return 0;
  }
  let mask = 0;
  for (const modifier of modifiers) {
    if (modifier === "alt") {
      mask |= 1;
    } else if (modifier === "ctrl") {
      mask |= 2;
    } else if (modifier === "cmd") {
      mask |= 4;
    } else if (modifier === "shift") {
      mask |= 8;
    }
  }
  return mask;
}
function readClickPoint(value, fallback) {
  const point = value && typeof value === "object" ? value : null;
  const x = point?.x;
  const y = point?.y;
  if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) {
    return fallback;
  }
  return { x, y, adjusted: point?.adjusted === true, handled: point?.handled === true };
}
function mobileTouchClickExpression(x, y, radius, allowDomActivation) {
  return `(() => {
    const inputX = ${JSON.stringify(x)};
    const inputY = ${JSON.stringify(y)};
    const radius = ${JSON.stringify(radius)};
    const allowDomActivation = ${JSON.stringify(allowDomActivation)};
    const selector = [
      'a[href]',
      'button',
      'input',
      'textarea',
      'select',
      'summary',
      'label',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="switch"]',
      '[onclick]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const isUsable = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
        style.visibility !== 'hidden' && style.pointerEvents !== 'none';
    };
    const dispatchClick = (target, clickX, clickY) => {
      try {
        if (typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      } catch {
        try { target.focus(); } catch {}
      }
      if (typeof target.click === 'function') {
        target.click();
        return true;
      }
      const init = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: clickX,
        clientY: clickY,
        screenX: clickX,
        screenY: clickY,
        button: 0,
        buttons: 1
      };
      try {
        if (typeof PointerEvent === 'function') {
          target.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'touch', pointerId: 1 }));
          target.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, pointerType: 'touch', pointerId: 1 }));
        }
      } catch {}
      target.dispatchEvent(new MouseEvent('mousedown', init));
      target.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
      target.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
      return true;
    };
    const clickableFor = (el) => {
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        if (node.matches(selector)) return node;
        if (window.getComputedStyle(node).cursor === 'pointer') return node;
      }
      return null;
    };
    const offsets = [[0, 0]];
    for (const distance of [radius * 0.45, radius, radius * 1.35]) {
      for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4, Math.PI,
        Math.PI * 5 / 4, Math.PI * 3 / 2, Math.PI * 7 / 4]) {
        offsets.push([Math.cos(angle) * distance, Math.sin(angle) * distance]);
      }
    }
    let best = null;
    for (const [dx, dy] of offsets) {
      const px = inputX + dx;
      const py = inputY + dy;
      if (px < 0 || py < 0 || px > window.innerWidth || py > window.innerHeight) continue;
      for (const el of document.elementsFromPoint(px, py)) {
        const target = clickableFor(el);
        if (!target || !isUsable(target)) continue;
        const rect = target.getBoundingClientRect();
        const clickX = clamp(inputX, rect.left + 1, rect.right - 1);
        const clickY = clamp(inputY, rect.top + 1, rect.bottom - 1);
        const score = Math.hypot(clickX - inputX, clickY - inputY) + Math.hypot(dx, dy) * 0.25;
        if (!best || score < best.score) best = { score, x: clickX, y: clickY, target };
        break;
      }
    }
    if (best && allowDomActivation && dispatchClick(best.target, best.x, best.y)) {
      return { x: best.x, y: best.y, adjusted: true, handled: true };
    }
    if (best) {
      return { x: best.x, y: best.y, adjusted: true, handled: false };
    }
    return { x: inputX, y: inputY, adjusted: false, handled: false };
  })()`;
}
async function resolveMobileTouchClickPoint(dbg, x, y, radius, allowDomActivation) {
  const fallback = { x, y, adjusted: false, handled: false };
  if (typeof radius !== "number" || !Number.isFinite(radius) || radius <= 0) {
    return fallback;
  }
  try {
    const result = await dbg.sendCommand("Runtime.evaluate", {
      expression: mobileTouchClickExpression(x, y, radius, allowDomActivation),
      returnByValue: true,
      silent: true
    });
    const raw = result && typeof result === "object" ? result : null;
    const evaluated = raw?.result && typeof raw.result === "object" ? raw.result : null;
    return readClickPoint(evaluated?.value, fallback);
  } catch {
    return fallback;
  }
}

// src/main/browser/cdp-pointer-input.ts
var MULTI_CLICK_INTERVAL_MS = 500;
var MULTI_CLICK_SLOP_PX = 2;
var pointerStates = /* @__PURE__ */ new WeakMap();
function cdpPointerStateFor(webContents10) {
  let state = pointerStates.get(webContents10);
  if (!state) {
    state = {
      x: 0,
      y: 0,
      button: "none",
      buttons: 0,
      clickCount: 1,
      lastClick: null
    };
    pointerStates.set(webContents10, state);
  }
  return state;
}
function trackCdpClickCount(state, button) {
  const now = Date.now();
  const previous = state.lastClick;
  const repeated = previous !== null && previous.button === button && Math.abs(previous.x - state.x) <= MULTI_CLICK_SLOP_PX && Math.abs(previous.y - state.y) <= MULTI_CLICK_SLOP_PX && now - previous.at <= MULTI_CLICK_INTERVAL_MS;
  const count = repeated ? previous.count >= 3 ? 1 : previous.count + 1 : 1;
  state.lastClick = { button, x: state.x, y: state.y, at: now, count };
  return count;
}
function assertFinitePointerValues(values) {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) {
      throw new BrowserError("browser_error", `Pointer input requires a finite ${name}`);
    }
  }
}
function pressCdpPointerButton(state, button) {
  state.button = button;
  state.buttons |= cdpPointerButtonMask(button);
  state.clickCount = trackCdpClickCount(state, button);
}
function releaseCdpPointerButton(state, button) {
  state.buttons &= ~cdpPointerButtonMask(button);
  state.button = cdpPointerButtonFromMask(state.buttons);
}
function resolveCdpPointerReleaseButton(state) {
  return state.button === "none" ? void 0 : state.button;
}

// src/main/browser/browser-text-insertion.ts
var BROWSER_TEXT_INSERT_CHUNK_BYTES = 64 * 1024;
function* iterateBrowserTextInsertionChunks(text, maxChunkBytes = BROWSER_TEXT_INSERT_CHUNK_BYTES) {
  if (text.length === 0) {
    return;
  }
  const normalizedMax = Number.isFinite(maxChunkBytes) && maxChunkBytes > 0 ? maxChunkBytes : 1;
  const measurement = measureClipboardTextByteLength(text, { stopAfterBytes: normalizedMax });
  if (!measurement.exceededLimit) {
    yield text;
    return;
  }
  let startIndex = 0;
  while (startIndex < text.length) {
    const endIndex = getUtf8ChunkEndIndex(text, startIndex, normalizedMax);
    yield text.slice(startIndex, endIndex);
    startIndex = endIndex;
  }
}

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

// src/main/browser/agent-browser-bridge-input.ts
function focusedValueSetExpression(valueExpression, options) {
  const nextValue = options?.append ? ["String(target.value ?? '') + ", valueExpression].join("") : valueExpression;
  const dispatchEvents = options?.dispatchEvents ? " target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('change', { bubbles: true }));" : "";
  return [
    "(() => { const el = document.activeElement; if (el) {",
    // Why: ARIA spinbutton wrappers can hold focus while a contained or controlled input owns the value.
    ` const editableSelector = "input:not([type='hidden']):not([type='button']):not([type='checkbox']):not([type='radio']):not([type='file']):not([type='image']):not([type='reset']):not([type='submit']), textarea";`,
    " const isEditable = (node) => !!node && (node.matches?.(editableSelector) ?? (node.tagName === 'TEXTAREA' || (node.tagName === 'INPUT' && !/^(hidden|button|checkbox|radio|file|image|reset|submit)$/i.test(node.getAttribute?.('type') ?? ''))));",
    " const findEditable = (root) => root?.querySelector?.(editableSelector) ?? null;",
    " let target = el;",
    " if (!isEditable(target) && target.getAttribute?.('role') === 'spinbutton') {",
    "   const controls = target.getAttribute('aria-controls');",
    "   if (controls) { for (const id of controls.split(/\\s+/)) { if (!id) continue; const controlled = document.getElementById(id); if (isEditable(controlled)) { target = controlled; break; } const descendant = findEditable(controlled); if (descendant) { target = descendant; break; } } }",
    "   if (target === el) { const descendant = findEditable(target); if (descendant) target = descendant; }",
    " }",
    " const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set;",
    " const nextValue = ",
    nextValue,
    "; if (nativeSetter) { nativeSetter.call(target, nextValue); } else { target.value = nextValue; }",
    dispatchEvents,
    " } })()"
  ].join("");
}
function focusedRichTextEditExpression(valueExpression, options) {
  const selectAll = options?.selectAll ? "true" : "false";
  return [
    "(() => {",
    " const target = document.activeElement;",
    " const value = ",
    valueExpression,
    ";",
    ` const selectAll = ${selectAll};`,
    " const isEditable = target?.isContentEditable === true || /^(|true|plaintext-only)$/i.test(target?.getAttribute?.('contenteditable') ?? 'false');",
    " if (!target || target === document.body || !isEditable) { throw new Error('Focused rich-text target is unavailable'); }",
    " if (selectAll) {",
    "   if (typeof window.getSelection !== 'function') { throw new Error('Rich-text selection is unavailable'); }",
    "   const selection = window.getSelection();",
    "   if (!selection) { throw new Error('Rich-text selection is unavailable'); }",
    "   selection.selectAllChildren(target);",
    " }",
    " const editCommand = selectAll && value.length === 0 ? 'delete' : 'insertText';",
    " let edited = false;",
    " try {",
    "   edited = document.execCommand(editCommand, false, value) === true;",
    " } catch { edited = false; }",
    " if (!edited) { throw new Error('Browser rich-text editing command failed'); }",
    " })()"
  ].join("");
}
function isExplicitContentEditableResult(result) {
  const value = result && typeof result === "object" ? result.value : void 0;
  return typeof value === "string" && /^(|true|plaintext-only)$/i.test(value);
}

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

// src/main/browser/cdp-ws-proxy.ts
var import_ws3 = require("ws");
var import_node_http = require("node:http");

// src/main/browser/cdp-client-response-writer.ts
var import_ws = require("ws");

// src/shared/ws-outbound-backpressure-queue.ts
var DEFAULT_SOFT_CAP_BYTES = 8 * 1024 * 1024;
var DEFAULT_MAX_QUEUED_BYTES = 64 * 1024 * 1024;
var DEFAULT_MAX_QUEUED_FRAMES = 4096;
var DEFAULT_DRAIN_POLL_MS = 25;
var QUEUE_COMPACTION_HEAD_THRESHOLD = 64;
function createWsOutboundBackpressureQueue(options) {
  const softCapBytes = options.softCapBytes ?? DEFAULT_SOFT_CAP_BYTES;
  const maxQueuedBytes = options.maxQueuedBytes ?? DEFAULT_MAX_QUEUED_BYTES;
  const maxFrameBytes = options.maxFrameBytes ?? maxQueuedBytes;
  const maxQueuedFrames = options.maxQueuedFrames ?? DEFAULT_MAX_QUEUED_FRAMES;
  const drainPollMs = options.drainPollMs ?? DEFAULT_DRAIN_POLL_MS;
  const configuredDrainFramesPerTurn = options.maxDrainFramesPerTurn;
  const maxDrainFramesPerTurn = typeof configuredDrainFramesPerTurn === "number" && Number.isSafeInteger(configuredDrainFramesPerTurn) && configuredDrainFramesPerTurn > 0 ? configuredDrainFramesPerTurn : Number.POSITIVE_INFINITY;
  const setTimer = options.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
  const clearTimer = options.clearTimer ?? ((timer2) => clearTimeout(timer2));
  const bufferedAmount = () => {
    const value = options.getBufferedAmount();
    return Number.isFinite(value) ? value : 0;
  };
  const queue2 = [];
  let queueHead = 0;
  let queued = 0;
  let queuedFrames = 0;
  let timer = null;
  let overflowed = false;
  let disposed = false;
  const stopTimer = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };
  const dropBacklog = () => {
    while (queueHead < queue2.length) {
      const entry = queue2[queueHead++];
      if (entry?.retained) {
        entry.retained = false;
        entry.frame = null;
        entry.releaseQueuedBytes();
      }
    }
    queue2.length = 0;
    queueHead = 0;
    queued = 0;
    queuedFrames = 0;
    stopTimer();
  };
  const failOverflow = (cap) => {
    if (disposed || overflowed) {
      return;
    }
    overflowed = true;
    const evidence = {
      cap,
      queuedBytes: queued,
      queuedFrames,
      maxQueuedBytes,
      maxQueuedFrames,
      maxFrameBytes
    };
    dropBacklog();
    options.onOverflow(evidence);
  };
  const sendFrame = (frame) => {
    try {
      options.send(frame);
      return true;
    } catch {
      failOverflow("sendFailed");
      return false;
    }
  };
  const advanceQueueHead = () => {
    while (queueHead < queue2.length && !queue2[queueHead]?.retained) {
      queueHead += 1;
    }
  };
  const resetDrainedQueue = () => {
    queue2.length = 0;
    queueHead = 0;
    stopTimer();
  };
  const releaseEntry = (entry) => {
    if (!entry.retained) {
      return false;
    }
    entry.retained = false;
    entry.frame = null;
    queued -= entry.bytes;
    queuedFrames -= 1;
    entry.releaseQueuedBytes();
    return true;
  };
  const cancelEntry = (entry) => {
    if (!releaseEntry(entry)) {
      return false;
    }
    const index = queue2.indexOf(entry, queueHead);
    if (index !== -1) {
      queue2[index] = void 0;
    }
    advanceQueueHead();
    if (queuedFrames === 0) {
      resetDrainedQueue();
    }
    return true;
  };
  const drain = () => {
    timer = null;
    if (disposed || overflowed) {
      return;
    }
    if (!options.isWritable()) {
      dropBacklog();
      return;
    }
    advanceQueueHead();
    let drainedFrames = 0;
    while (queuedFrames > 0 && drainedFrames < maxDrainFramesPerTurn && bufferedAmount() <= softCapBytes && (options.canSend?.(queue2[queueHead].bytes, true) ?? true)) {
      const entry = queue2[queueHead++];
      queue2[queueHead - 1] = void 0;
      const frame = entry.frame;
      releaseEntry(entry);
      advanceQueueHead();
      if (queueHead >= QUEUE_COMPACTION_HEAD_THRESHOLD) {
        queue2.splice(0, queueHead);
        queueHead = 0;
      }
      if (!sendFrame(frame)) {
        return;
      }
      drainedFrames += 1;
    }
    if (queuedFrames > 0) {
      const nextDrainDelay = drainedFrames >= maxDrainFramesPerTurn ? 0 : drainPollMs;
      timer = setTimer(drain, nextDrainDelay);
    } else {
      resetDrainedQueue();
    }
  };
  const isIdle = (bytes) => queuedFrames === 0 && options.isWritable() && bufferedAmount() <= softCapBytes && (options.canSend?.(bytes, false) ?? true);
  const enqueueCancelable = (frame) => {
    if (disposed || overflowed) {
      return { accepted: false, queued: false, cancel: () => false };
    }
    const bytes = options.byteLengthOf(frame);
    if (!Number.isFinite(bytes) || bytes < 0 || bytes > maxFrameBytes) {
      failOverflow("maxFrameBytes");
      return { accepted: false, queued: false, cancel: () => false };
    }
    if (isIdle(bytes)) {
      return {
        accepted: sendFrame(frame),
        queued: false,
        cancel: () => false
      };
    }
    const queuedBytesClaim = options.claimQueuedBytes?.(bytes);
    if (options.claimQueuedBytes && !queuedBytesClaim) {
      failOverflow("claimQueuedBytes");
      return { accepted: false, queued: false, cancel: () => false };
    }
    const entry = {
      frame,
      bytes,
      releaseQueuedBytes: queuedBytesClaim ?? (() => void 0),
      retained: true
    };
    queue2.push(entry);
    queued += bytes;
    queuedFrames += 1;
    if (queued > maxQueuedBytes || queuedFrames > maxQueuedFrames) {
      failOverflow(queued > maxQueuedBytes ? "maxQueuedBytes" : "maxQueuedFrames");
      return { accepted: false, queued: false, cancel: () => false };
    }
    if (timer === null) {
      timer = setTimer(drain, drainPollMs);
    }
    return {
      accepted: true,
      queued: true,
      cancel: () => cancelEntry(entry)
    };
  };
  return {
    enqueue(frame) {
      return enqueueCancelable(frame).accepted;
    },
    enqueueCancelable,
    isIdle,
    queuedBytes: () => queued,
    evidence: () => ({
      queuedBytes: queued,
      queuedFrames,
      storageSlots: queue2.length
    }),
    dispose() {
      disposed = true;
      dropBacklog();
    }
  };
}

// src/main/browser/cdp-client-response-writer.ts
var CdpClientResponseWriter = class {
  constructor(getClient) {
    this.getClient = getClient;
  }
  getClient;
  responseSessionIdsByClient = /* @__PURE__ */ new WeakMap();
  outboundByClient = /* @__PURE__ */ new WeakMap();
  send(payload, client = this.getClient()) {
    const responsePayload = client ? this.addResponseSessionId(payload, client) : payload;
    if (client?.readyState === import_ws.WebSocket.OPEN) {
      this.outboundQueue(client).enqueue(JSON.stringify(responsePayload));
    }
  }
  outboundQueue(client) {
    const existing = this.outboundByClient.get(client);
    if (existing) {
      return existing.queue;
    }
    const queue2 = createWsOutboundBackpressureQueue({
      send: (frame) => client.send(frame),
      byteLengthOf: (frame) => Buffer.byteLength(frame),
      getBufferedAmount: () => client.bufferedAmount,
      isWritable: () => client.readyState === import_ws.WebSocket.OPEN,
      onOverflow: (evidence) => {
        console.warn("[cdp] outbound queue overflow; terminating automation client:", {
          cap: evidence.cap,
          queuedBytes: evidence.queuedBytes,
          queuedFrames: evidence.queuedFrames,
          maxQueuedBytes: evidence.maxQueuedBytes,
          maxQueuedFrames: evidence.maxQueuedFrames
        });
        client.terminate();
      },
      // Preserve large PDF/screenshot replies on a draining connection; queued bursts stay capped.
      maxFrameBytes: Number.POSITIVE_INFINITY,
      maxDrainFramesPerTurn: 128
    });
    const onClose = () => this.forgetClient(client);
    this.outboundByClient.set(client, { queue: queue2, onClose });
    client.once("close", onClose);
    return queue2;
  }
  addResponseSessionId(payload, client) {
    if (typeof payload !== "object" || payload === null) {
      return payload;
    }
    const clientId = payload.id;
    if (typeof clientId !== "number") {
      return payload;
    }
    const responseSessionIds = this.responseSessionIdsByClient.get(client);
    const sessionId = responseSessionIds?.get(clientId);
    responseSessionIds?.delete(clientId);
    return sessionId ? { ...payload, sessionId } : payload;
  }
  sendResult(clientId, result, client = this.getClient()) {
    this.send({ id: clientId, result }, client);
  }
  sendError(clientId, message, client = this.getClient()) {
    this.send({ id: clientId, error: { code: -32e3, message } }, client);
  }
  isActiveClient(client) {
    return this.getClient() === client && client.readyState === import_ws.WebSocket.OPEN;
  }
  recordRequestSessionId(client, clientId, msg) {
    const responseSessionIds = this.responseSessionIdsByClient.get(client) ?? /* @__PURE__ */ new Map();
    if (msg.sessionId) {
      responseSessionIds.set(clientId, msg.sessionId);
    } else {
      responseSessionIds.delete(clientId);
    }
    this.responseSessionIdsByClient.set(client, responseSessionIds);
  }
  forgetClient(client) {
    this.responseSessionIdsByClient.delete(client);
    const outbound = this.outboundByClient.get(client);
    if (outbound) {
      this.outboundByClient.delete(client);
      client.off("close", outbound.onClose);
      outbound.queue.dispose();
    }
  }
};

// src/main/browser/cdp-synthetic-session-registry.ts
var CdpSyntheticSessionRegistry = class {
  // Why: agent-browser filters events by sessionId from Target.attachToTarget.
  clientSessionId = void 0;
  clientSessionIds = /* @__PURE__ */ new Set();
  clientBrowserSessionIds = /* @__PURE__ */ new Set();
  nextClientSessionOrdinal = 0;
  nextClientBrowserSessionOrdinal = 0;
  get primarySessionId() {
    return this.clientSessionId;
  }
  clear() {
    this.clientSessionId = void 0;
    this.clientSessionIds.clear();
    this.clientBrowserSessionIds.clear();
    this.nextClientSessionOrdinal = 0;
    this.nextClientBrowserSessionOrdinal = 0;
  }
  attachPageSession() {
    const sessionId = this.nextSyntheticPageSessionId();
    this.clientSessionIds.add(sessionId);
    this.clientSessionId ??= sessionId;
    return sessionId;
  }
  attachBrowserSession() {
    const sessionId = this.nextSyntheticBrowserSessionId();
    this.clientBrowserSessionIds.add(sessionId);
    return sessionId;
  }
  detachSession(detachedSessionId) {
    if (typeof detachedSessionId === "string") {
      this.clientSessionIds.delete(detachedSessionId);
      this.clientBrowserSessionIds.delete(detachedSessionId);
      if (detachedSessionId === this.clientSessionId) {
        this.clientSessionId = this.clientSessionIds.values().next().value;
      }
    }
  }
  resolveDebuggerSessionId(msgSessionId) {
    const syntheticSession = msgSessionId && this.clientSessionIds.has(msgSessionId) || msgSessionId && this.clientBrowserSessionIds.has(msgSessionId);
    return msgSessionId && !syntheticSession ? msgSessionId : void 0;
  }
  nextSyntheticPageSessionId() {
    this.nextClientSessionOrdinal += 1;
    return this.nextClientSessionOrdinal === 1 ? "orca-proxy-session" : `orca-proxy-session-${this.nextClientSessionOrdinal}`;
  }
  nextSyntheticBrowserSessionId() {
    this.nextClientBrowserSessionOrdinal += 1;
    return this.nextClientBrowserSessionOrdinal === 1 ? "orca-proxy-browser-session" : `orca-proxy-browser-session-${this.nextClientBrowserSessionOrdinal}`;
  }
};

// src/main/browser/cdp-target-discovery.ts
var CdpTargetDiscovery = class {
  constructor(webContents10, responder, sessions, getWebSocketDebuggerUrl) {
    this.webContents = webContents10;
    this.responder = responder;
    this.sessions = sessions;
    this.getWebSocketDebuggerUrl = getWebSocketDebuggerUrl;
  }
  webContents;
  responder;
  sessions;
  getWebSocketDebuggerUrl;
  /** `url` is the request path with the proxy's path secret already removed. */
  handleHttpRequest(req, res, url = req.url ?? "") {
    if (url === "/json/version" || url === "/json/version/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      const chromeVersion = process.versions.chrome ?? "134.0.0.0";
      res.end(
        JSON.stringify({
          Browser: `Chrome/${chromeVersion}`,
          "Protocol-Version": "1.3",
          webSocketDebuggerUrl: this.getWebSocketDebuggerUrl()
        })
      );
      return;
    }
    if (url === "/json" || url === "/json/" || url === "/json/list" || url === "/json/list/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          {
            ...this.buildTargetInfo(),
            id: "orca-proxy-target",
            webSocketDebuggerUrl: this.getWebSocketDebuggerUrl()
          }
        ])
      );
      return;
    }
    res.writeHead(404);
    res.end();
  }
  /** Returns true when the command was answered locally and needs no forwarding. */
  handleCommand(client, clientId, msg) {
    if (msg.method === "Target.getTargets") {
      this.responder.sendResult(clientId, { targetInfos: [this.buildTargetInfo()] }, client);
      return true;
    }
    if (msg.method === "Target.getTargetInfo") {
      this.responder.sendResult(clientId, { targetInfo: this.buildTargetInfo() }, client);
      return true;
    }
    if (msg.method === "Target.setDiscoverTargets" || msg.method === "Target.detachFromTarget") {
      if (msg.method === "Target.detachFromTarget") {
        const detachedSessionId = msg.params?.sessionId;
        this.sessions.detachSession(detachedSessionId);
      }
      this.responder.sendResult(clientId, {}, client);
      return true;
    }
    if (msg.method === "Target.attachToBrowserTarget") {
      const sessionId = this.sessions.attachBrowserSession();
      this.responder.sendResult(clientId, { sessionId }, client);
      return true;
    }
    if (msg.method === "Target.attachToTarget") {
      const sessionId = this.sessions.attachPageSession();
      this.responder.sendResult(clientId, { sessionId }, client);
      return true;
    }
    if (msg.method === "Browser.getVersion") {
      const chromeVersion = process.versions.chrome ?? "134.0.0.0";
      this.responder.sendResult(
        clientId,
        {
          protocolVersion: "1.3",
          product: `Chrome/${chromeVersion}`,
          userAgent: "",
          jsVersion: ""
        },
        client
      );
      return true;
    }
    return false;
  }
  buildTargetInfo() {
    const destroyed = this.webContents.isDestroyed();
    return {
      targetId: "orca-proxy-target",
      type: "page",
      title: destroyed ? "" : this.webContents.getTitle(),
      url: destroyed ? "" : this.webContents.getURL(),
      attached: true,
      canAccessOpener: false
    };
  }
};

// src/main/browser/cdp-debugger-channel.ts
var import_ws2 = require("ws");

// src/main/browser/guest-cdp-command.ts
var VIEW_RESIZING_CDP_METHODS = /* @__PURE__ */ new Set([
  "Emulation.setDeviceMetricsOverride",
  "Emulation.setVisibleSize"
]);
function sendGuestCdpCommand(guest, method, params, sessionId) {
  if (VIEW_RESIZING_CDP_METHODS.has(method) && (guest.isDestroyed() || guest.isCrashed())) {
    return Promise.reject(
      new BrowserError(
        "browser_cdp_error",
        "The page crashed; its viewport can be changed again once it reloads."
      )
    );
  }
  return Promise.resolve(
    sessionId === void 0 ? guest.debugger.sendCommand(method, params) : guest.debugger.sendCommand(method, params, sessionId)
  );
}

// src/main/browser/cdp-debugger-channel.ts
var CdpDebuggerChannel = class {
  constructor(webContents10, responder, sessions, getClient, onDetached) {
    this.webContents = webContents10;
    this.responder = responder;
    this.sessions = sessions;
    this.getClient = getClient;
    this.onDetached = onDetached;
  }
  webContents;
  responder;
  sessions;
  getClient;
  onDetached;
  debuggerMessageHandler = null;
  debuggerDetachHandler = null;
  debuggerLease = null;
  attached = false;
  async attachDebugger() {
    if (this.attached) {
      return;
    }
    try {
      this.debuggerLease = acquireElectronDebugger(this.webContents);
    } catch {
      throw new Error("Could not attach debugger. DevTools may already be open for this tab.");
    }
    this.attached = true;
    try {
      await this.webContents.debugger.sendCommand("Page.enable", {});
    } catch {
    }
    this.debuggerMessageHandler = (_event, ...rest) => {
      const [method, params, sessionId] = rest;
      const client = this.getClient();
      if (!client || client.readyState !== import_ws2.WebSocket.OPEN) {
        return;
      }
      const msg = { method, params };
      msg.sessionId = sessionId || this.sessions.primarySessionId;
      this.responder.send(msg, client);
    };
    this.debuggerDetachHandler = () => {
      this.attached = false;
      const lease = this.debuggerLease;
      this.debuggerLease = null;
      lease?.release();
      this.onDetached();
    };
    this.webContents.debugger.on("message", this.debuggerMessageHandler);
    this.webContents.debugger.on("detach", this.debuggerDetachHandler);
  }
  detachDebugger() {
    if (this.debuggerMessageHandler) {
      this.webContents.debugger.removeListener("message", this.debuggerMessageHandler);
      this.debuggerMessageHandler = null;
    }
    if (this.debuggerDetachHandler) {
      this.webContents.debugger.removeListener("detach", this.debuggerDetachHandler);
      this.debuggerDetachHandler = null;
    }
    const lease = this.debuggerLease;
    this.debuggerLease = null;
    lease?.release();
    this.attached = false;
  }
  sendDebuggerCommand(method, params, sessionId) {
    return sessionId ? sendGuestCdpCommand(this.webContents, method, params, sessionId) : sendGuestCdpCommand(this.webContents, method, params);
  }
  forwardCommand(client, clientId, method, params, msgSessionId) {
    if (this.webContents.isDestroyed()) {
      this.responder.sendError(clientId, "Browser tab is no longer available", client);
      return;
    }
    const sessionId = this.sessions.resolveDebuggerSessionId(msgSessionId);
    try {
      this.sendDebuggerCommand(method, params, sessionId).then((result) => {
        this.responder.sendResult(clientId, result, client);
      }).catch((err) => {
        this.responder.sendError(clientId, err.message, client);
      });
    } catch (err) {
      this.responder.sendError(clientId, err instanceof Error ? err.message : String(err), client);
    }
  }
};

// src/main/browser/cdp-page-navigation-commands.ts
var LIFECYCLE_PRIMING_TIMEOUT_MS = 1e3;
var CdpPageNavigationCommands = class {
  constructor(webContents10, responder, sessions, debuggerChannel) {
    this.webContents = webContents10;
    this.responder = responder;
    this.sessions = sessions;
    this.debuggerChannel = debuggerChannel;
  }
  webContents;
  responder;
  sessions;
  debuggerChannel;
  async navigateWithLifecycle(client, clientId, params, msgSessionId) {
    await this.primePageLifecycle(this.sessions.resolveDebuggerSessionId(msgSessionId));
    if (!this.responder.isActiveClient(client)) {
      return;
    }
    this.debuggerChannel.forwardCommand(client, clientId, "Page.navigate", params, msgSessionId);
  }
  async reloadWithLifecycle(client, clientId, params, msgSessionId) {
    const sessionId = this.sessions.resolveDebuggerSessionId(msgSessionId);
    const unsupportedParam = sessionId ? null : this.getUnsupportedRootReloadParam(params);
    if (unsupportedParam) {
      this.responder.sendError(
        clientId,
        `Page.reload parameter "${unsupportedParam}" is not supported for Orca tab reloads`,
        client
      );
      return;
    }
    await this.primePageLifecycle(sessionId);
    if (!this.responder.isActiveClient(client)) {
      return;
    }
    if (sessionId) {
      this.debuggerChannel.forwardCommand(client, clientId, "Page.reload", params, msgSessionId);
      return;
    }
    if (this.webContents.isDestroyed()) {
      this.responder.sendError(clientId, "Browser tab is no longer available", client);
      return;
    }
    try {
      if (params.ignoreCache === true) {
        this.webContents.reloadIgnoringCache();
      } else {
        this.webContents.reload();
      }
      this.responder.sendResult(clientId, {}, client);
    } catch (err) {
      this.responder.sendError(clientId, err instanceof Error ? err.message : String(err), client);
    }
  }
  getUnsupportedRootReloadParam(params) {
    return Object.keys(params).find((key) => key !== "ignoreCache") ?? null;
  }
  async primePageLifecycle(sessionId) {
    let timeout = null;
    const priming = (async () => {
      await this.debuggerChannel.sendDebuggerCommand("Network.enable", {}, sessionId);
      await this.debuggerChannel.sendDebuggerCommand("Page.enable", {}, sessionId);
      await this.debuggerChannel.sendDebuggerCommand(
        "Page.setLifecycleEventsEnabled",
        { enabled: true },
        sessionId
      );
    })().catch(() => {
    });
    try {
      await Promise.race([
        priming,
        new Promise((resolve) => {
          timeout = setTimeout(resolve, LIFECYCLE_PRIMING_TIMEOUT_MS);
          timeout.unref?.();
        })
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
};

// src/main/browser/cdp-dom-focus-replay.ts
var CdpDomFocusReplay = class {
  constructor(webContents10, responder, debuggerChannel) {
    this.webContents = webContents10;
    this.responder = responder;
    this.debuggerChannel = debuggerChannel;
  }
  webContents;
  responder;
  debuggerChannel;
  // Why: holds each session's last DOM.focus params to replay right before the next
  // Input.insertText, countering the native webContents.focus() that would blur the target.
  pendingDomFocusBySession = /* @__PURE__ */ new Map();
  clear() {
    this.pendingDomFocusBySession.clear();
  }
  invalidateForMethod(method, effectiveSessionId) {
    if (method !== "DOM.focus" && method !== "Input.insertText") {
      this.pendingDomFocusBySession.delete(effectiveSessionId);
    }
  }
  // Why: this must stay synchronous up to the `.set()` call so the pending-focus
  // entry exists before the event loop can dispatch a pipelined Input.insertText
  // message, closing the race where the replay would otherwise be silently skipped.
  forwardDomFocus(client, clientId, params, effectiveSessionId) {
    const focused = this.sendDomFocus(client, clientId, params, effectiveSessionId);
    this.pendingDomFocusBySession.set(effectiveSessionId, focused);
  }
  async sendDomFocus(client, clientId, params, effectiveSessionId) {
    if (this.webContents.isDestroyed()) {
      this.responder.sendError(clientId, "Browser tab is no longer available", client);
      return void 0;
    }
    try {
      const result = await this.debuggerChannel.sendDebuggerCommand(
        "DOM.focus",
        params,
        effectiveSessionId
      );
      this.responder.sendResult(clientId, result, client);
      return { ...params };
    } catch (err) {
      this.responder.sendError(clientId, err instanceof Error ? err.message : String(err), client);
      return void 0;
    }
  }
  async forwardInsertText(client, clientId, params, effectiveSessionId) {
    const pendingFocus = this.pendingDomFocusBySession.get(effectiveSessionId);
    this.pendingDomFocusBySession.delete(effectiveSessionId);
    const pendingFocusParams = pendingFocus ? await pendingFocus : void 0;
    if (!this.responder.isActiveClient(client)) {
      return;
    }
    if (pendingFocusParams) {
      if (this.webContents.isDestroyed()) {
        this.responder.sendError(clientId, "Browser tab is no longer available", client);
        return;
      }
      try {
        await this.debuggerChannel.sendDebuggerCommand(
          "DOM.focus",
          pendingFocusParams,
          effectiveSessionId
        );
      } catch (err) {
        this.responder.sendError(clientId, err instanceof Error ? err.message : String(err), client);
        return;
      }
      if (!this.responder.isActiveClient(client)) {
        return;
      }
    }
    this.debuggerChannel.forwardCommand(
      client,
      clientId,
      "Input.insertText",
      params,
      effectiveSessionId
    );
  }
};

// src/main/browser/cdp-print-to-pdf.ts
var import_node_crypto = require("node:crypto");
var PDF_DEFAULT_MARGIN_INCHES = 1 / 2.54;
var PDF_STREAM_CHUNK_BYTES = 1024 * 1024;
var PDF_STREAM_HANDLE_PREFIX = "orca-pdf-";
var PDF_STREAM_TTL_MS = 5 * 60 * 1e3;
function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function buildPrintToPdfOptions(params) {
  const options = {};
  if (typeof params.landscape === "boolean") {
    options.landscape = params.landscape;
  }
  if (typeof params.displayHeaderFooter === "boolean") {
    options.displayHeaderFooter = params.displayHeaderFooter;
  }
  if (typeof params.printBackground === "boolean") {
    options.printBackground = params.printBackground;
  }
  if (typeof params.preferCSSPageSize === "boolean") {
    options.preferCSSPageSize = params.preferCSSPageSize;
  }
  if (typeof params.generateTaggedPDF === "boolean") {
    options.generateTaggedPDF = params.generateTaggedPDF;
  }
  if (typeof params.generateDocumentOutline === "boolean") {
    options.generateDocumentOutline = params.generateDocumentOutline;
  }
  const scale = finiteNumber(params.scale);
  if (scale !== null && scale > 0) {
    options.scale = scale;
  }
  const paperWidth = finiteNumber(params.paperWidth);
  const paperHeight = finiteNumber(params.paperHeight);
  if (paperWidth !== null && paperHeight !== null && paperWidth > 0 && paperHeight > 0) {
    options.pageSize = { width: paperWidth, height: paperHeight };
  }
  const marginTop = finiteNumber(params.marginTop);
  const marginBottom = finiteNumber(params.marginBottom);
  const marginLeft = finiteNumber(params.marginLeft);
  const marginRight = finiteNumber(params.marginRight);
  if ([marginTop, marginBottom, marginLeft, marginRight].some((margin) => margin !== null)) {
    options.margins = {
      top: marginTop ?? PDF_DEFAULT_MARGIN_INCHES,
      bottom: marginBottom ?? PDF_DEFAULT_MARGIN_INCHES,
      left: marginLeft ?? PDF_DEFAULT_MARGIN_INCHES,
      right: marginRight ?? PDF_DEFAULT_MARGIN_INCHES
    };
  }
  if (typeof params.pageRanges === "string") {
    options.pageRanges = params.pageRanges;
  }
  if (typeof params.headerTemplate === "string") {
    options.headerTemplate = params.headerTemplate;
  }
  if (typeof params.footerTemplate === "string") {
    options.footerTemplate = params.footerTemplate;
  }
  return options;
}
var CdpPdfStreamStore = class {
  streams = /* @__PURE__ */ new Map();
  handlePrefix = `${PDF_STREAM_HANDLE_PREFIX}${(0, import_node_crypto.randomUUID)()}-`;
  nextId = 0;
  /** True when `params.handle` names one of this store's streams. */
  ownsHandle(params) {
    return typeof params.handle === "string" && params.handle.startsWith(this.handlePrefix);
  }
  create(data) {
    const handle = `${this.handlePrefix}${++this.nextId}`;
    this.streams.set(handle, {
      data,
      offset: 0,
      cleanupTimer: this.scheduleCleanup(handle)
    });
    return handle;
  }
  /** Read the next chunk, or `null` if the handle is unknown/expired. */
  read(params) {
    const handle = typeof params.handle === "string" ? params.handle : "";
    const stream = this.streams.get(handle);
    if (!stream) {
      return null;
    }
    this.refreshCleanup(handle, stream);
    const offset = finiteNumber(params.offset);
    if (offset !== null) {
      stream.offset = Math.max(0, Math.floor(offset));
    }
    const requestedSize = finiteNumber(params.size);
    const size = requestedSize !== null && requestedSize > 0 ? Math.floor(requestedSize) : PDF_STREAM_CHUNK_BYTES;
    const start = Math.min(stream.offset, stream.data.length);
    const end = Math.min(start + size, stream.data.length);
    const chunk = stream.data.subarray(start, end);
    stream.offset = end;
    return { data: chunk.toString("base64"), eof: end >= stream.data.length };
  }
  close(params) {
    const handle = typeof params.handle === "string" ? params.handle : "";
    this.delete(handle);
  }
  clear() {
    for (const stream of this.streams.values()) {
      clearTimeout(stream.cleanupTimer);
    }
    this.streams.clear();
  }
  scheduleCleanup(handle) {
    const cleanupTimer = setTimeout(() => {
      this.delete(handle);
    }, PDF_STREAM_TTL_MS);
    const maybeNodeTimer = cleanupTimer;
    maybeNodeTimer.unref?.();
    return cleanupTimer;
  }
  refreshCleanup(handle, stream) {
    clearTimeout(stream.cleanupTimer);
    stream.cleanupTimer = this.scheduleCleanup(handle);
  }
  delete(handle) {
    const stream = this.streams.get(handle);
    if (!stream) {
      return;
    }
    clearTimeout(stream.cleanupTimer);
    this.streams.delete(handle);
  }
};

// src/main/browser/cdp-page-capture-commands.ts
var CdpPageCaptureCommands = class {
  constructor(webContents10, responder, holdPaint) {
    this.webContents = webContents10;
    this.responder = responder;
    this.holdPaint = holdPaint;
  }
  webContents;
  responder;
  holdPaint;
  pdfStreams = new CdpPdfStreamStore();
  clear() {
    this.pdfStreams.clear();
  }
  ownsHandle(params) {
    return this.pdfStreams.ownsHandle(params);
  }
  async handlePrintToPdf(client, clientId, params) {
    if (this.webContents.isDestroyed()) {
      this.responder.sendError(clientId, "Browser tab is no longer available", client);
      return;
    }
    try {
      const pdf = await this.webContents.printToPDF(buildPrintToPdfOptions(params));
      if (!this.responder.isActiveClient(client)) {
        return;
      }
      const buffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
      if (params.transferMode === "ReturnAsStream") {
        const handle = this.pdfStreams.create(buffer);
        this.responder.sendResult(clientId, { data: "", stream: handle }, client);
        return;
      }
      this.responder.sendResult(clientId, { data: buffer.toString("base64") }, client);
    } catch (err) {
      this.responder.sendError(clientId, err instanceof Error ? err.message : String(err), client);
    }
  }
  handleStreamRead(client, clientId, params) {
    const chunk = this.pdfStreams.read(params);
    if (!chunk) {
      this.responder.sendError(clientId, "Invalid stream handle", client);
      return;
    }
    this.responder.sendResult(
      clientId,
      { base64Encoded: true, data: chunk.data, eof: chunk.eof },
      client
    );
  }
  handleStreamClose(client, clientId, params) {
    this.pdfStreams.close(params);
    this.responder.sendResult(clientId, {}, client);
  }
  async handleScreenshot(client, clientId, params) {
    try {
      const result = await captureScreenshot(this.webContents, params, this.holdPaint);
      this.responder.sendResult(clientId, result, client);
    } catch (err) {
      this.responder.sendError(clientId, err instanceof Error ? err.message : String(err), client);
    }
  }
};

// src/main/browser/cdp-loopback-request-guard.ts
function isTrustedCdpLoopbackRequest(req, port) {
  if (req.headers.origin !== void 0) {
    return false;
  }
  const host = req.headers.host?.toLowerCase();
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

// src/main/browser/cdp-path-secret.ts
var import_node_crypto2 = require("node:crypto");
function createCdpPathSecret() {
  return (0, import_node_crypto2.randomBytes)(32).toString("hex");
}
function stripCdpPathSecret(url, secret) {
  if (!secret || !url?.startsWith("/")) {
    return null;
  }
  const segmentEnd = url.indexOf("/", 1);
  if (segmentEnd === -1) {
    return null;
  }
  const candidate = Buffer.from(url.slice(1, segmentEnd));
  const expected = Buffer.from(secret);
  if (candidate.length !== expected.length || !(0, import_node_crypto2.timingSafeEqual)(candidate, expected)) {
    return null;
  }
  return url.slice(segmentEnd);
}

// src/main/browser/cdp-ws-proxy.ts
var CdpWsProxy = class {
  constructor(webContents10, holdPaint) {
    this.webContents = webContents10;
    this.discovery = new CdpTargetDiscovery(
      webContents10,
      this.responder,
      this.sessions,
      () => this.webSocketUrl()
    );
    this.debuggerChannel = new CdpDebuggerChannel(
      webContents10,
      this.responder,
      this.sessions,
      () => this.client,
      () => this.stop()
    );
    this.navigation = new CdpPageNavigationCommands(
      webContents10,
      this.responder,
      this.sessions,
      this.debuggerChannel
    );
    this.domFocusReplay = new CdpDomFocusReplay(webContents10, this.responder, this.debuggerChannel);
    this.pageCapture = new CdpPageCaptureCommands(webContents10, this.responder, holdPaint);
  }
  webContents;
  httpServer = null;
  wss = null;
  client = null;
  detachClientListeners = null;
  port = 0;
  // Required first path segment for discovery and the websocket upgrade; regenerated on every start.
  pathSecret = "";
  responder = new CdpClientResponseWriter(() => this.client);
  sessions = new CdpSyntheticSessionRegistry();
  discovery;
  debuggerChannel;
  navigation;
  domFocusReplay;
  pageCapture;
  async start() {
    await this.debuggerChannel.attachDebugger();
    this.pathSecret = createCdpPathSecret();
    return new Promise((resolve, reject) => {
      this.httpServer = (0, import_node_http.createServer)((req, res) => {
        if (!isTrustedCdpLoopbackRequest(req, this.port)) {
          res.writeHead(403);
          res.end();
          return;
        }
        const path = stripCdpPathSecret(req.url, this.pathSecret);
        if (path === null) {
          res.writeHead(404);
          res.end();
          return;
        }
        this.discovery.handleHttpRequest(req, res, path);
      });
      this.wss = new import_ws3.WebSocketServer({
        server: this.httpServer,
        verifyClient: ({ req }, done) => {
          if (!isTrustedCdpLoopbackRequest(req, this.port)) {
            done(false, 403);
            return;
          }
          done(stripCdpPathSecret(req.url, this.pathSecret) !== null, 404);
        }
      });
      const failStart = (error) => {
        this.httpServer?.removeListener("error", onListenError);
        this.wss?.close();
        this.wss = null;
        this.httpServer?.close();
        this.httpServer = null;
        this.debuggerChannel.detachDebugger();
        reject(error);
      };
      const onListenError = (error) => {
        failStart(error);
      };
      this.wss.on("connection", (ws) => {
        this.closeClient();
        this.client = ws;
        const onMessage = (data) => {
          this.handleClientMessage(ws, data.toString());
        };
        const onClose = () => {
          detach();
          if (this.client === ws) {
            this.clearClientState();
            this.client = null;
          }
        };
        const detach = () => {
          ws.off("message", onMessage);
          ws.off("close", onClose);
          if (this.detachClientListeners === detach) {
            this.detachClientListeners = null;
          }
        };
        this.detachClientListeners = detach;
        ws.on("message", onMessage);
        ws.on("close", onClose);
      });
      this.httpServer.listen(0, "127.0.0.1", () => {
        this.httpServer?.removeListener("error", onListenError);
        const addr = this.httpServer.address();
        if (typeof addr === "object" && addr) {
          this.port = addr.port;
          resolve(this.webSocketUrl());
        } else {
          failStart(new Error("Failed to bind proxy server"));
        }
      });
      this.httpServer.once("error", onListenError);
    });
  }
  async stop() {
    this.pathSecret = "";
    this.debuggerChannel.detachDebugger();
    this.closeClient();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
  }
  getPort() {
    return this.port;
  }
  webSocketUrl() {
    return `ws://127.0.0.1:${this.port}/${this.pathSecret}/`;
  }
  closeClient() {
    const client = this.client;
    this.detachClientListeners?.();
    this.detachClientListeners = null;
    this.client = null;
    this.clearClientState();
    if (client) {
      this.responder.forgetClient(client);
    }
    client?.close();
  }
  clearClientState() {
    this.domFocusReplay.clear();
    this.pageCapture.clear();
    this.sessions.clear();
  }
  handleClientMessage(client, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.id == null || !msg.method) {
      return;
    }
    const clientId = msg.id;
    this.responder.recordRequestSessionId(client, clientId, msg);
    if (this.discovery.handleCommand(client, clientId, msg)) {
      return;
    }
    const effectiveSessionId = this.sessions.resolveDebuggerSessionId(msg.sessionId);
    this.domFocusReplay.invalidateForMethod(msg.method, effectiveSessionId);
    if (msg.method === "Page.bringToFront") {
      if (!this.webContents.isDestroyed()) {
        this.webContents.focus();
      }
      this.responder.sendResult(clientId, {}, client);
      return;
    }
    if (msg.method === "DOM.focus") {
      this.domFocusReplay.forwardDomFocus(client, clientId, msg.params ?? {}, effectiveSessionId);
      return;
    }
    if (msg.method === "Page.captureScreenshot") {
      void this.pageCapture.handleScreenshot(client, clientId, msg.params);
      return;
    }
    if (msg.method === "Page.printToPDF") {
      void this.pageCapture.handlePrintToPdf(client, clientId, msg.params ?? {});
      return;
    }
    if (msg.method === "IO.read") {
      const params = msg.params ?? {};
      if (this.pageCapture.ownsHandle(params)) {
        this.pageCapture.handleStreamRead(client, clientId, params);
        return;
      }
      this.debuggerChannel.forwardCommand(client, clientId, msg.method, params, msg.sessionId);
      return;
    }
    if (msg.method === "IO.close") {
      const params = msg.params ?? {};
      if (this.pageCapture.ownsHandle(params)) {
        this.pageCapture.handleStreamClose(client, clientId, params);
        return;
      }
      this.debuggerChannel.forwardCommand(client, clientId, msg.method, params, msg.sessionId);
      return;
    }
    if (msg.method === "Input.insertText" && !this.webContents.isDestroyed()) {
      this.webContents.focus();
      void this.domFocusReplay.forwardInsertText(
        client,
        clientId,
        msg.params ?? {},
        effectiveSessionId
      );
      return;
    }
    if (msg.method === "Page.navigate" && !this.webContents.isDestroyed()) {
      void this.navigation.navigateWithLifecycle(client, clientId, msg.params ?? {}, msg.sessionId);
      return;
    }
    if (msg.method === "Page.reload" && !this.webContents.isDestroyed()) {
      void this.navigation.reloadWithLifecycle(client, clientId, msg.params ?? {}, msg.sessionId);
      return;
    }
    this.debuggerChannel.forwardCommand(
      client,
      clientId,
      msg.method,
      msg.params ?? {},
      msg.sessionId
    );
  }
};

// src/main/browser/agent-browser-bridge-raw-process.ts
var import_node_child_process3 = require("node:child_process");

// src/main/browser/agent-browser-bridge-execution.ts
var import_node_child_process2 = require("node:child_process");

// src/main/browser/agent-browser-bridge-result.ts
function translateResult(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      ok: false,
      error: {
        code: "browser_error",
        message: `Unexpected output from agent-browser: ${stdout.slice(0, 1e3)}`
      }
    };
  }
  if (parsed.success) {
    return { ok: true, result: parsed.data };
  }
  const message = parsed.error ?? "Unknown browser error";
  return {
    ok: false,
    error: {
      code: classifyErrorCode(message),
      message
    }
  };
}

// src/main/browser/agent-browser-bridge-state.ts
var import_electron = require("electron");

// src/main/browser/agent-browser-process-environment.ts
var import_node_crypto3 = require("node:crypto");
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");
var AGENT_BROWSER_SOCKET_DIRECTORY_PREFIX = "orca-ab-";
var AGENT_BROWSER_IDLE_TIMEOUT_MS = 10 * 60 * 1e3;
function createAgentBrowserProcessEnvironment(options) {
  const env = { ...options.inheritedEnv };
  if (!env.AGENT_BROWSER_IDLE_TIMEOUT_MS?.trim()) {
    env.AGENT_BROWSER_IDLE_TIMEOUT_MS = String(AGENT_BROWSER_IDLE_TIMEOUT_MS);
  }
  if (options.platform === "win32" || env.AGENT_BROWSER_SOCKET_DIR?.trim()) {
    return { env, ownsSocketDirectory: false };
  }
  const profileKey = (0, import_node_crypto3.createHash)("sha256").update(options.userDataPath).digest("hex").slice(0, 16);
  const socketDirectory = import_node_path2.posix.join(
    "/tmp",
    `${AGENT_BROWSER_SOCKET_DIRECTORY_PREFIX}${profileKey}`
  );
  try {
    (0, import_node_fs2.mkdirSync)(socketDirectory, { recursive: true, mode: 448 });
    (0, import_node_fs2.chmodSync)(socketDirectory, 448);
  } catch {
    return { env, ownsSocketDirectory: false };
  }
  env.AGENT_BROWSER_SOCKET_DIR = socketDirectory;
  return { env, ownsSocketDirectory: true };
}

// src/main/browser/agent-browser-bridge-state.ts
var AgentBrowserBridgeState = class {
  constructor(browserManager2, options = {}) {
    this.browserManager = browserManager2;
    this.options = options;
    this.agentBrowserBin = options.agentBrowserBin ?? "agent-browser";
    const processEnvironment = createAgentBrowserProcessEnvironment({
      inheritedEnv: process.env,
      platform: process.platform,
      userDataPath: options.userDataPath ?? import_electron.app.getPath("userData")
    });
    this.agentBrowserEnv = processEnvironment.env;
    this.ownsAgentBrowserSocketDirectory = processEnvironment.ownsSocketDirectory;
    const idleTimeoutMs = Number(this.agentBrowserEnv.AGENT_BROWSER_IDLE_TIMEOUT_MS);
    this.agentBrowserIdleTimeoutMs = idleTimeoutMs > 0 ? idleTimeoutMs : null;
  }
  browserManager;
  options;
  // Why: per-worktree active tab so one worktree's tab switch can't affect another's command targeting.
  activeWebContentsPerWorktree = /* @__PURE__ */ new Map();
  activeWebContentsId = null;
  sessions = /* @__PURE__ */ new Map();
  commandQueues = /* @__PURE__ */ new Map();
  processingQueues = /* @__PURE__ */ new Set();
  agentBrowserBin;
  agentBrowserEnv;
  ownsAgentBrowserSocketDirectory;
  // Why: null when nothing bounds the daemon, so the bridge never guesses that one was replaced.
  agentBrowserIdleTimeoutMs;
  // Why: stash intercept patterns from a swap-destroyed session, keyed by name, so the next session restores them.
  pendingInterceptRestore = /* @__PURE__ */ new Map();
  // Why: promise-lock so two concurrent ensureSession calls don't both create the session entry.
  pendingSessionCreation = /* @__PURE__ */ new Map();
  // Why: `agent-browser close` is async, keyed by session name — recreating before it finishes lets the old teardown close the new session.
  pendingSessionDestruction = /* @__PURE__ */ new Map();
  cancelledProcesses = /* @__PURE__ */ new WeakSet();
  shutdownStarted = false;
  resolveTabIdSafe(webContentsId) {
    return this.browserManager.getTabIdForWebContentsId(webContentsId);
  }
  getWebContents(webContentsId) {
    try {
      const { webContents: webContents10 } = require("electron");
      const target = webContents10.fromId(webContentsId);
      return target && !target.isDestroyed() ? target : null;
    } catch {
      return null;
    }
  }
};

// src/main/browser/agent-browser-bridge-tabs.ts
var AgentBrowserBridgeTabs = class extends AgentBrowserBridgeState {
  // ── Tab tracking ──
  setActiveTab(webContentsId, worktreeId) {
    this.activeWebContentsId = webContentsId;
    if (worktreeId) {
      this.activeWebContentsPerWorktree.set(worktreeId, webContentsId);
    }
    this.options.onTabsChanged?.(worktreeId);
  }
  selectFallbackActiveWebContents(worktreeId, excludedWebContentsId) {
    for (const [, wcId] of this.getRegisteredTabs(worktreeId)) {
      if (wcId === excludedWebContentsId) {
        continue;
      }
      if (this.getWebContents(wcId)) {
        this.activeWebContentsPerWorktree.set(worktreeId, wcId);
        return wcId;
      }
    }
    this.activeWebContentsPerWorktree.delete(worktreeId);
    return null;
  }
  getActiveWebContentsId() {
    return this.activeWebContentsId;
  }
  getPageInfo(worktreeId, browserPageId) {
    try {
      const target = this.resolveCommandTarget(worktreeId, browserPageId);
      const wc = this.getWebContents(target.webContentsId);
      if (!wc) {
        return null;
      }
      return {
        browserPageId: target.browserPageId,
        url: wc.getURL() ?? "",
        title: wc.getTitle() ?? ""
      };
    } catch {
      return null;
    }
  }
  onTabChanged(webContentsId, worktreeId) {
    this.activeWebContentsId = webContentsId;
    if (worktreeId) {
      this.activeWebContentsPerWorktree.set(worktreeId, webContentsId);
    }
    this.options.onTabsChanged?.(worktreeId);
  }
  getRegisteredTabs(worktreeId) {
    const all = this.browserManager.getWebContentsIdByTabId();
    if (!worktreeId) {
      return all;
    }
    const filtered = /* @__PURE__ */ new Map();
    for (const [tabId, wcId] of all) {
      if (this.browserManager.getScopeIdForTab(tabId) === worktreeId) {
        filtered.set(tabId, wcId);
      }
    }
    return filtered;
  }
  // ── Tab management ──
  tabList(worktreeId) {
    const tabs = this.getRegisteredTabs(worktreeId);
    let activeWcId = (worktreeId && this.activeWebContentsPerWorktree.get(worktreeId)) ?? this.activeWebContentsId;
    const result = [];
    let index = 0;
    let firstLiveWcId = null;
    for (const [tabId, wcId] of tabs) {
      const wc = this.getWebContents(wcId);
      if (!wc) {
        this.browserManager.unregisterGuest(tabId);
        continue;
      }
      if (firstLiveWcId === null) {
        firstLiveWcId = wcId;
      }
      const loadError = this.browserManager.getBrowserPageLoadError(tabId);
      const certificateFailure = this.browserManager.getBrowserPageCertificateFailure(tabId);
      result.push({
        browserPageId: tabId,
        index: index++,
        // Why: failed WebContents report chrome-error://, not the address the user asked to load.
        url: loadError?.validatedUrl ?? wc.getURL() ?? "",
        title: wc.getTitle() ?? "",
        active: wcId === activeWcId,
        loadError,
        certificateFailure
      });
    }
    if (activeWcId == null && firstLiveWcId !== null) {
      activeWcId = firstLiveWcId;
      if (result.length > 0) {
        result[0].active = true;
      }
    }
    return { tabs: result };
  }
  getActivePageId(worktreeId, browserPageId) {
    try {
      return this.resolveCommandTarget(worktreeId, browserPageId).browserPageId;
    } catch {
      return null;
    }
  }
  resolveCommandTarget(worktreeId, browserPageId, requireScopedTarget = false) {
    if (!browserPageId) {
      return requireScopedTarget ? this.resolveScopedActiveTab(worktreeId) : this.resolveActiveTab(worktreeId);
    }
    const tabs = this.getRegisteredTabs(worktreeId);
    const webContentsId = tabs.get(browserPageId);
    if (webContentsId == null) {
      const scope = worktreeId ? " in this worktree" : "";
      throw new BrowserError(
        "browser_tab_not_found",
        `Browser page ${browserPageId} was not found${scope}`
      );
    }
    if (!this.getWebContents(webContentsId)) {
      this.browserManager.unregisterGuest(browserPageId);
      throw new BrowserError(
        "browser_tab_not_found",
        `Browser page ${browserPageId} is no longer available`
      );
    }
    return { browserPageId, webContentsId };
  }
  resolveActiveTab(worktreeId) {
    const tabs = this.getRegisteredTabs(worktreeId);
    if (tabs.size === 0) {
      throw new BrowserError("browser_no_tab", "No browser tab open in this worktree");
    }
    const preferredWcId = (worktreeId && this.activeWebContentsPerWorktree.get(worktreeId)) ?? this.activeWebContentsId;
    if (preferredWcId != null) {
      for (const [tabId, wcId] of tabs) {
        if (wcId === preferredWcId && this.getWebContents(wcId)) {
          return { browserPageId: tabId, webContentsId: wcId };
        }
        if (wcId === preferredWcId) {
          this.browserManager.unregisterGuest(tabId);
          if (this.activeWebContentsId === wcId) {
            this.activeWebContentsId = null;
          }
          if (worktreeId && this.activeWebContentsPerWorktree.get(worktreeId) === wcId) {
            this.activeWebContentsPerWorktree.delete(worktreeId);
          }
        }
      }
    }
    for (const [tabId, wcId] of tabs) {
      if (this.getWebContents(wcId)) {
        this.activeWebContentsId = wcId;
        if (worktreeId) {
          this.activeWebContentsPerWorktree.set(worktreeId, wcId);
        }
        return { browserPageId: tabId, webContentsId: wcId };
      }
      this.browserManager.unregisterGuest(tabId);
    }
    throw new BrowserError(
      "browser_no_tab",
      "No live browser tab available \u2014 all registered tabs have been destroyed"
    );
  }
  // Why: don't fall back to the global tab for text mutation — it could inject into another worktree's foreground webview and steal focus.
  resolveScopedActiveTab(worktreeId) {
    if (worktreeId) {
      return this.resolveActiveTab(worktreeId);
    }
    const worktreesWithLiveTabs = /* @__PURE__ */ new Set();
    for (const [tabId, wcId] of this.getRegisteredTabs(void 0)) {
      if (this.getWebContents(wcId)) {
        worktreesWithLiveTabs.add(this.browserManager.getScopeIdForTab(tabId));
      }
    }
    if (worktreesWithLiveTabs.size === 0) {
      throw new BrowserError("browser_no_tab", "No browser tab open in this worktree");
    }
    if (worktreesWithLiveTabs.size > 1) {
      throw new BrowserError(
        "browser_target_ambiguous",
        "Multiple worktrees have browser tabs open; pass --worktree to target text insertion safely"
      );
    }
    const [onlyWorktreeId] = worktreesWithLiveTabs;
    return this.resolveActiveTab(onlyWorktreeId);
  }
};

// src/main/browser/agent-browser-session-reset.ts
var import_node_fs3 = require("node:fs");
var import_node_path3 = require("node:path");
var SAFE_SESSION_NAME = /^[A-Za-z0-9_-]+$/;
function canSkipAgentBrowserSessionReset(options) {
  const { socketDirectory, sessionName } = options;
  if (!options.ownsSocketDirectory || !socketDirectory || !SAFE_SESSION_NAME.test(sessionName)) {
    return false;
  }
  try {
    (0, import_node_fs3.lstatSync)((0, import_node_path3.join)(socketDirectory, `${sessionName}.sock`));
    return false;
  } catch (error) {
    return error.code === "ENOENT";
  }
}

// src/main/browser/agent-browser-cdp-endpoint.ts
var LOOPBACK_CDP_PATH_SECRET = /(wss?:\/\/(?:127\.0\.0\.1|localhost):\d+\/)[\da-f]{64}(?=\/|\b)/gi;
function withAgentBrowserCdpEndpoint(execOptions, cdpEndpoint) {
  return {
    ...execOptions,
    envOverrides: { ...execOptions?.envOverrides, AGENT_BROWSER_CDP: cdpEndpoint }
  };
}
function redactCdpPathSecrets(text) {
  return text.replace(LOOPBACK_CDP_PATH_SECRET, "$1<redacted>");
}

// src/main/browser/agent-browser-bridge-execution.ts
var AgentBrowserBridgeExecution = class extends AgentBrowserBridgeTabs {
  requireTargetWebContents(target) {
    const wc = this.getWebContents(target.webContentsId);
    if (!wc || wc.isDestroyed()) {
      throw this.createPageUnavailableError(`${ORCA_TAB_SESSION_PREFIX}${target.browserPageId}`);
    }
    return wc;
  }
  /**
   * Notice that the daemon retired itself between two commands.
   *
   * A replacement daemon still serves the page (every call reasserts the CDP endpoint)
   * but carries none of the session's network routes, so without this the
   * interception the caller configured is silently gone (#16367).
   */
  reinitializeIfDaemonIdledOut(sessionName, session5) {
    if (this.agentBrowserIdleTimeoutMs === null || Date.now() - session5.lastCommandAt < this.agentBrowserIdleTimeoutMs) {
      return;
    }
    session5.initialized = false;
    if (session5.activeInterceptPatterns.length > 0) {
      this.pendingInterceptRestore.set(sessionName, [...session5.activeInterceptPatterns]);
    }
  }
  assertCommandAdmission() {
    if (this.shutdownStarted) {
      throw new BrowserError("browser_owner_unavailable", "Browser runtime is shutting down");
    }
  }
  async execAgentBrowser(sessionName, commandArgs, execOptions) {
    const session5 = this.sessions.get(sessionName);
    if (!session5) {
      throw this.createPageUnavailableError(sessionName);
    }
    if (!this.getWebContents(session5.webContentsId)) {
      await this.destroySession(sessionName);
      throw this.createPageUnavailableError(sessionName);
    }
    this.reinitializeIfDaemonIdledOut(sessionName, session5);
    session5.lastCommandAt = Date.now();
    const args = ["--session", sessionName];
    const managesInterceptRoutes = commandArgs[0] === "network" && (commandArgs[1] === "route" || commandArgs[1] === "unroute");
    const needsInit = !session5.initialized;
    const cdpExecOptions = withAgentBrowserCdpEndpoint(execOptions, session5.cdpEndpoint);
    for (const commandArg of commandArgs) {
      args.push(commandArg);
    }
    args.push("--json");
    const stdout = await this.runAgentBrowserRaw(sessionName, args, cdpExecOptions);
    const translated = translateResult(stdout);
    if (!translated.ok) {
      throw this.createCommandError(
        sessionName,
        translated.error.message,
        translated.error.code,
        session5.webContentsId
      );
    }
    if (needsInit) {
      session5.initialized = true;
      const pendingPatterns = managesInterceptRoutes ? void 0 : this.pendingInterceptRestore.get(sessionName);
      if (pendingPatterns && pendingPatterns.length > 0) {
        this.pendingInterceptRestore.delete(sessionName);
        try {
          const urlPattern = pendingPatterns[0] ?? "**/*";
          await this.runAgentBrowserRaw(
            sessionName,
            ["--session", sessionName, "network", "route", urlPattern, "--json"],
            withAgentBrowserCdpEndpoint(void 0, session5.cdpEndpoint)
          );
          session5.activeInterceptPatterns = pendingPatterns;
        } catch {
        }
      }
    }
    return translated.result;
  }
  async isExplicitContentEditableTarget(sessionName, element) {
    const result = await this.execAgentBrowser(sessionName, [
      "get",
      "attr",
      element,
      "contenteditable"
    ]);
    return isExplicitContentEditableResult(result);
  }
  async fillExplicitContentEditable(sessionName, element, value) {
    await this.execAgentBrowser(sessionName, ["focus", element]);
    await this.execAgentBrowser(sessionName, ["eval", "--stdin"], {
      stdinText: focusedRichTextEditExpression(JSON.stringify(value), { selectAll: true })
    });
  }
  createPageUnavailableError(sessionName) {
    return new BrowserError("browser_tab_not_found", pageUnavailableMessageForSession(sessionName));
  }
  closeStaleAgentBrowserSession(sessionName) {
    if (canSkipAgentBrowserSessionReset({
      ownsSocketDirectory: this.ownsAgentBrowserSocketDirectory,
      socketDirectory: this.agentBrowserEnv.AGENT_BROWSER_SOCKET_DIR,
      sessionName
    })) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      let child = null;
      let settled = false;
      const finish = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };
      const timeout = setTimeout(() => {
        child?.kill();
        finish(
          new BrowserError(
            "browser_owner_unavailable",
            `Could not reset stale helper session ${sessionName}; retry after agent-browser exits`
          )
        );
      }, STALE_SESSION_CLOSE_TIMEOUT_MS);
      try {
        child = (0, import_node_child_process2.execFile)(
          this.agentBrowserBin,
          ["--session", sessionName, "close"],
          // Why windowsHide: agent-browser is console-subsystem and Orca's main
          // process owns no console, so each spawn gets a fresh visible conhost
          // that takes foreground -- keystrokes typed into a terminal at that
          // moment land in the black box (#14543).
          {
            env: this.agentBrowserEnv,
            timeout: STALE_SESSION_CLOSE_TIMEOUT_MS,
            windowsHide: true
          },
          (error) => finish(
            error ? new BrowserError(
              "browser_owner_unavailable",
              `Could not reset stale helper session ${sessionName}: ${error.message}`
            ) : void 0
          )
        );
      } catch (error) {
        finish(
          new BrowserError(
            "browser_owner_unavailable",
            `Could not reset stale helper session ${sessionName}: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    });
  }
  createCommandError(sessionName, message, fallbackCode, webContentsId) {
    message = redactCdpPathSecrets(message);
    if (fallbackCode === "browser_error" && isTabClosedTransportError(message) && this.isSessionTargetClosed(sessionName, webContentsId)) {
      return this.createPageUnavailableError(sessionName);
    }
    return new BrowserError(fallbackCode, message);
  }
  isSessionTargetClosed(sessionName, webContentsId) {
    const session5 = this.sessions.get(sessionName);
    if (!session5) {
      return true;
    }
    const targetWebContentsId = webContentsId ?? session5.webContentsId;
    return !this.getWebContents(targetWebContentsId);
  }
};

// src/main/browser/agent-browser-bridge-raw-process.ts
var AgentBrowserBridgeRawProcess = class extends AgentBrowserBridgeExecution {
  runAgentBrowserRaw(sessionName, args, execOptions) {
    return new Promise((resolve, reject) => {
      const session5 = this.sessions.get(sessionName);
      let child = null;
      let exitDrainTimer;
      child = (0, import_node_child_process3.execFile)(
        this.agentBrowserBin,
        args,
        // Why: screenshots return large base64 that exceeds Node's default 1MB maxBuffer (ENOBUFS).
        {
          timeout: execOptions?.timeoutMs ?? EXEC_TIMEOUT_MS,
          maxBuffer: 50 * 1024 * 1024,
          // Why windowsHide: see the stale-session close above -- every
          // agent-browser invocation would otherwise flash a console (#14543).
          windowsHide: true,
          env: execOptions?.envOverrides ? { ...this.agentBrowserEnv, ...execOptions.envOverrides } : this.agentBrowserEnv
        },
        (error, stdout, stderr) => {
          clearTimeout(exitDrainTimer);
          if (session5 && session5.activeProcess === child) {
            session5.activeProcess = null;
          }
          if (child && this.cancelledProcesses.has(child)) {
            this.cancelledProcesses.delete(child);
            reject(
              new BrowserError("browser_tab_closed", "Tab was closed while command was running")
            );
            return;
          }
          const liveSession = this.sessions.get(sessionName);
          if (error && error.killed) {
            if (execOptions?.timeoutError) {
              reject(execOptions.timeoutError);
              return;
            }
            if (liveSession) {
              liveSession.consecutiveTimeouts++;
              if (liveSession.consecutiveTimeouts >= CONSECUTIVE_TIMEOUT_LIMIT) {
                this.destroySession(sessionName);
              }
            }
            reject(new BrowserError("browser_error", "Browser command timed out"));
            return;
          }
          if (liveSession) {
            liveSession.consecutiveTimeouts = 0;
          }
          if (error) {
            if (stdout) {
              try {
                const parsed = JSON.parse(stdout);
                if (parsed.error) {
                  const code2 = classifyErrorCode(parsed.error);
                  reject(
                    this.createCommandError(sessionName, parsed.error, code2, session5?.webContentsId)
                  );
                  return;
                }
              } catch {
              }
            }
            const message = stderr || error.message;
            const code = classifyErrorCode(message);
            reject(this.createCommandError(sessionName, message, code, session5?.webContentsId));
            return;
          }
          resolve(stdout);
        }
      );
      child.once("exit", () => {
        exitDrainTimer = setTimeout(() => {
          child.stdout?.destroy();
          child.stderr?.destroy();
        }, AGENT_BROWSER_EXIT_DRAIN_MS);
      });
      if (session5) {
        session5.activeProcess = child;
      }
      if (execOptions?.stdinText !== void 0 && child?.stdin) {
        child.stdin.on("error", () => {
        });
        child.stdin.end(execOptions.stdinText);
      }
    });
  }
};

// src/main/browser/agent-browser-bridge-lifecycle.ts
var AgentBrowserBridgeLifecycle = class extends AgentBrowserBridgeRawProcess {
  async onTabClosed(webContentsId) {
    const browserPageId = this.resolveTabIdSafe(webContentsId);
    const owningWorktreeId = browserPageId ? this.browserManager.getScopeIdForTab(browserPageId) : void 0;
    let nextWorktreeActiveWebContentsId = null;
    if (owningWorktreeId && this.activeWebContentsPerWorktree.get(owningWorktreeId) === webContentsId) {
      nextWorktreeActiveWebContentsId = this.selectFallbackActiveWebContents(
        owningWorktreeId,
        webContentsId
      );
    }
    if (this.activeWebContentsId === webContentsId) {
      this.activeWebContentsId = nextWorktreeActiveWebContentsId;
    }
    if (browserPageId) {
      await this.onPageClosed(browserPageId);
    }
    this.options.onTabsChanged?.(owningWorktreeId);
  }
  /**
   * Retire a page's daemon by page id.
   *
   * The headless offscreen backend owns pages by id and unregisters the guest
   * itself, so `onTabClosed`'s webContentsId lookup can never resolve one — it
   * has to say which page closed (#16367).
   */
  async onPageClosed(browserPageId) {
    const sessionName = `${ORCA_TAB_SESSION_PREFIX}${browserPageId}`;
    await this.destroySession(sessionName);
    this.pendingInterceptRestore.delete(sessionName);
  }
  async onProcessSwap(browserPageId, newWebContentsId, previousWebContentsId) {
    const sessionName = `${ORCA_TAB_SESSION_PREFIX}${browserPageId}`;
    const session5 = this.sessions.get(sessionName);
    const oldWebContentsId = previousWebContentsId ?? session5?.webContentsId;
    const owningWorktreeId = this.browserManager.getScopeIdForTab(browserPageId);
    if (session5 && session5.activeInterceptPatterns.length > 0) {
      this.pendingInterceptRestore.set(sessionName, [...session5.activeInterceptPatterns]);
    }
    await this.destroySession(sessionName);
    if (oldWebContentsId != null && this.activeWebContentsId === oldWebContentsId) {
      this.activeWebContentsId = newWebContentsId;
    }
    if (owningWorktreeId && oldWebContentsId != null && this.activeWebContentsPerWorktree.get(owningWorktreeId) === oldWebContentsId) {
      this.activeWebContentsPerWorktree.set(owningWorktreeId, newWebContentsId);
    }
    this.options.onTabsChanged?.(owningWorktreeId ?? void 0);
  }
  async ensureSession(sessionName, browserPageId, webContentsId) {
    const pendingDestruction = this.pendingSessionDestruction.get(sessionName);
    if (pendingDestruction) {
      await pendingDestruction;
    }
    this.assertCommandAdmission();
    if (this.sessions.has(sessionName)) {
      return;
    }
    const pending = this.pendingSessionCreation.get(sessionName);
    if (pending) {
      await pending;
      this.assertCommandAdmission();
      return;
    }
    const createSession = async () => {
      const wc = this.getWebContents(webContentsId);
      if (!wc) {
        throw new BrowserError(
          "browser_tab_not_found",
          `Browser page ${browserPageId} is no longer available`
        );
      }
      await this.closeStaleAgentBrowserSession(sessionName);
      const proxy = new CdpWsProxy(wc, () => this.browserManager.holdPaintForCapture(webContentsId));
      const cdpEndpoint = await proxy.start();
      this.sessions.set(sessionName, {
        proxy,
        cdpEndpoint,
        initialized: false,
        consecutiveTimeouts: 0,
        activeInterceptPatterns: [],
        activeCapture: false,
        lastCommandAt: Date.now(),
        webContentsId,
        activeProcess: null
      });
    };
    const promise = createSession();
    this.pendingSessionCreation.set(sessionName, promise);
    try {
      await promise;
    } finally {
      this.pendingSessionCreation.delete(sessionName);
    }
  }
  async destroySession(sessionName, options = { closeTimeoutMs: AGENT_BROWSER_CLEANUP_TIMEOUT_MS }) {
    const pendingDestruction = this.pendingSessionDestruction.get(sessionName);
    if (pendingDestruction) {
      await pendingDestruction;
      return;
    }
    const pendingCreation = this.pendingSessionCreation.get(sessionName);
    if (pendingCreation) {
      try {
        await pendingCreation;
      } catch {
      }
    }
    const session5 = this.sessions.get(sessionName);
    if (!session5) {
      this.rejectQueuedCommandsForClosedSession(sessionName);
      return;
    }
    this.sessions.delete(sessionName);
    this.pendingSessionCreation.delete(sessionName);
    this.rejectQueuedCommandsForClosedSession(sessionName);
    if (session5.activeProcess) {
      this.cancelledProcesses.add(session5.activeProcess);
      try {
        session5.activeProcess.kill();
      } catch {
      }
      session5.activeProcess = null;
    }
    const destroy = (async () => {
      try {
        await this.runAgentBrowserRaw(
          sessionName,
          ["--session", sessionName, "close"],
          options.closeTimeoutMs === void 0 ? void 0 : { timeoutMs: options.closeTimeoutMs }
        );
      } catch {
      }
      await session5.proxy.stop();
    })();
    this.pendingSessionDestruction.set(sessionName, destroy);
    try {
      await destroy;
    } finally {
      this.pendingSessionDestruction.delete(sessionName);
    }
  }
  rejectQueuedCommandsForClosedSession(sessionName) {
    const queue2 = this.commandQueues.get(sessionName);
    this.commandQueues.delete(sessionName);
    this.processingQueues.delete(sessionName);
    if (queue2) {
      const err = new BrowserError(
        "browser_tab_closed",
        "Tab was closed while commands were queued"
      );
      for (const cmd of queue2) {
        cmd.reject(err);
      }
      queue2.length = 0;
    }
  }
};

// src/main/browser/agent-browser-bridge-shutdown.ts
var AgentBrowserBridgeShutdown = class extends AgentBrowserBridgeLifecycle {
  // ── Session lifecycle ──
  // Why: a previous run that crashed or was SIGKILL'd left one daemon per open tab with
  // nobody holding its name — closeStaleAgentBrowserSession only resets a name being reused.
  async sweepOrphanedSessions() {
    return sweepOrphanedAgentBrowserSessions({
      binaryPath: this.agentBrowserBin,
      env: this.agentBrowserEnv,
      ownsSocketDirectory: this.ownsAgentBrowserSocketDirectory,
      isSessionLive: (sessionName) => this.sessions.has(sessionName) || this.pendingSessionCreation.has(sessionName)
    });
  }
  async destroyAllSessions(options) {
    this.shutdownStarted = true;
    const sessionNames = /* @__PURE__ */ new Set([
      ...this.sessions.keys(),
      ...this.pendingSessionCreation.keys(),
      ...this.pendingSessionDestruction.keys()
    ]);
    await mapSettledWithConcurrency(
      [...sessionNames],
      AGENT_BROWSER_CLEANUP_CONCURRENCY,
      (sessionName) => this.destroySession(sessionName, options)
    );
    this.pendingInterceptRestore.clear();
  }
};

// src/main/browser/agent-browser-bridge-queue.ts
var AgentBrowserBridgeQueue = class extends AgentBrowserBridgeShutdown {
  // Why: route tab switch through the command queue so it can't race in-flight commands targeting the old tab.
  async tabSwitch(index, worktreeId, browserPageId) {
    return this.enqueueCommand(worktreeId, async () => {
      const tabs = this.getRegisteredTabs(worktreeId);
      const liveEntries = [...tabs.entries()].filter(([, wcId2]) => this.getWebContents(wcId2));
      let switchedIndex = index ?? -1;
      let resolvedPageId = browserPageId;
      if (resolvedPageId) {
        switchedIndex = liveEntries.findIndex(([tabId2]) => tabId2 === resolvedPageId);
      }
      if (switchedIndex < 0 || switchedIndex >= liveEntries.length) {
        const targetLabel = resolvedPageId != null ? `Browser page ${resolvedPageId}` : `Tab index ${index}`;
        throw new BrowserError(
          "browser_tab_not_found",
          `${targetLabel} out of range (0-${liveEntries.length - 1})`
        );
      }
      const [tabId, wcId] = liveEntries[switchedIndex];
      this.activeWebContentsId = wcId;
      const owningWorktreeId = worktreeId ?? this.browserManager.getScopeIdForTab(tabId);
      if (owningWorktreeId) {
        this.activeWebContentsPerWorktree.set(owningWorktreeId, wcId);
      }
      this.options.onTabsChanged?.(owningWorktreeId ?? void 0);
      return { switched: switchedIndex, browserPageId: tabId };
    });
  }
  // ── Internal ──
  async enqueueCommand(worktreeId, execute) {
    return this.enqueueTargetedCommand(worktreeId, void 0, execute);
  }
  async enqueueTargetedCommand(worktreeId, browserPageId, execute, options = {}) {
    this.assertCommandAdmission();
    const { browserPageId: pageId } = this.resolveCommandTarget(
      worktreeId,
      browserPageId,
      options.requireScopedTarget
    );
    const sessionName = `${ORCA_TAB_SESSION_PREFIX}${pageId}`;
    return new Promise((resolve, reject) => {
      let queue2 = this.commandQueues.get(sessionName);
      if (!queue2) {
        queue2 = [];
        this.commandQueues.set(sessionName, queue2);
      }
      queue2.push({
        execute: () => this.executeQueuedCommand(worktreeId, pageId, execute, options),
        resolve,
        reject
      });
      this.processQueue(sessionName);
    });
  }
  async executeQueuedCommand(worktreeId, browserPageId, execute, options) {
    this.assertCommandAdmission();
    const sessionName = `${ORCA_TAB_SESSION_PREFIX}${browserPageId}`;
    const target = this.resolveCommandTarget(worktreeId, browserPageId);
    if (options.ensureSession !== false) {
      await this.ensureSession(sessionName, browserPageId, target.webContentsId);
    }
    return execute(sessionName, target);
  }
  async processQueue(sessionName) {
    if (this.processingQueues.has(sessionName)) {
      return;
    }
    this.processingQueues.add(sessionName);
    const queue2 = this.commandQueues.get(sessionName);
    while (queue2 && queue2.length > 0) {
      const cmd = queue2.shift();
      try {
        const result = await cmd.execute();
        cmd.resolve(result);
      } catch (error) {
        cmd.reject(error);
      }
    }
    if (queue2 && queue2.length === 0 && this.commandQueues.get(sessionName) === queue2) {
      this.commandQueues.delete(sessionName);
    }
    this.processingQueues.delete(sessionName);
  }
};

// src/main/browser/agent-browser-bridge-core-commands.ts
var AgentBrowserBridgeCoreCommands = class extends AgentBrowserBridgeQueue {
  async snapshot(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName, target) => {
      const result = await this.execAgentBrowser(sessionName, [
        "snapshot"
      ]);
      return {
        ...result,
        browserPageId: target.browserPageId
      };
    });
  }
  async click(element, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["click", element]);
    });
  }
  async dblclick(element, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["dblclick", element]);
    });
  }
  async goto(url, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (_sessionName, target) => {
        const wc = this.requireTargetWebContents(target);
        const navigationUrl = normalizeBrowserNavigationUrl(url);
        if (!navigationUrl) {
          throw new BrowserError("invalid_argument", `Unsupported browser URL: ${url}`);
        }
        const navigationState = {
          preventUnloadEvent: null
        };
        const onWillPreventUnload = (event) => {
          navigationState.preventUnloadEvent = event;
        };
        wc.on("will-prevent-unload", onWillPreventUnload);
        let navigationAborted = false;
        const navigationDeadline = Date.now() + EMBEDDED_NAVIGATION_TIMEOUT_MS;
        let navigationTimeout = null;
        try {
          await Promise.race([
            wc.loadURL(navigationUrl),
            new Promise((_resolve, reject) => {
              navigationTimeout = setTimeout(
                () => reject(
                  new Error(
                    `Browser navigation timed out after ${EMBEDDED_NAVIGATION_TIMEOUT_MS}ms`
                  )
                ),
                EMBEDDED_NAVIGATION_TIMEOUT_MS
              );
              navigationTimeout.unref?.();
            })
          ]);
        } catch (error) {
          if (navigationTimeout) {
            clearTimeout(navigationTimeout);
            navigationTimeout = null;
          }
          if (!this.getWebContents(target.webContentsId)) {
            throw this.createPageUnavailableError(
              `${ORCA_TAB_SESSION_PREFIX}${target.browserPageId}`
            );
          }
          if (!isAbortedNavigationError(error) || navigationState.preventUnloadEvent !== null && !navigationState.preventUnloadEvent.defaultPrevented) {
            throw new BrowserError(
              "browser_error",
              `Failed to navigate browser page ${target.browserPageId}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
          navigationAborted = true;
          await waitForAbortedNavigationReplacement(
            wc,
            target.browserPageId,
            Math.max(0, navigationDeadline - Date.now())
          );
        } finally {
          wc.removeListener("will-prevent-unload", onWillPreventUnload);
          if (navigationTimeout) {
            clearTimeout(navigationTimeout);
          }
        }
        const navigatedTarget = this.resolveCommandTarget(worktreeId, target.browserPageId);
        const navigatedWebContents = this.requireTargetWebContents(navigatedTarget);
        const loadError = navigationAborted ? this.browserManager.getBrowserPageLoadError(target.browserPageId) : null;
        if (loadError) {
          throw new BrowserError(
            "browser_error",
            `Failed to navigate browser page ${target.browserPageId}: ${loadError.description} (${loadError.code})`
          );
        }
        return { url: navigatedWebContents.getURL(), title: navigatedWebContents.getTitle() };
      },
      { ensureSession: false }
    );
  }
  async fill(element, value, worktreeId, browserPageId) {
    await assertClipboardTextWriteWithinLimitWithYield(value);
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (sessionName) => {
        if (!await this.isExplicitContentEditableTarget(sessionName, element)) {
          await this.execAgentBrowser(sessionName, ["focus", element]);
          await this.execAgentBrowser(sessionName, ["eval", "--stdin"], {
            stdinText: focusedValueSetExpression(JSON.stringify(value), { dispatchEvents: true })
          });
          return { filled: element };
        }
        await this.fillExplicitContentEditable(sessionName, element, value);
        return { filled: element };
      },
      { requireScopedTarget: true }
    );
  }
};

// src/main/browser/agent-browser-bridge-input-commands.ts
var AgentBrowserBridgeInputCommands = class extends AgentBrowserBridgeCoreCommands {
  async type(input, worktreeId, browserPageId) {
    await assertClipboardTextWriteWithinLimitWithYield(input);
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (sessionName) => {
        for (const chunk of iterateBrowserTextInsertionChunks(
          input,
          AGENT_BROWSER_TEXT_ARGUMENT_MAX_BYTES
        )) {
          await this.execAgentBrowser(sessionName, ["keyboard", "type", chunk]);
        }
        return { typed: true };
      },
      { requireScopedTarget: true }
    );
  }
  async select(element, value, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, [
        "select",
        element,
        value
      ]);
    });
  }
  async scroll(direction, amount, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = ["scroll", direction];
      if (amount != null) {
        args.push(String(amount));
      }
      return await this.execAgentBrowser(sessionName, args);
    });
  }
  async scrollIntoView(element, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["scrollintoview", element]);
    });
  }
  async get(what, selector, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = ["get", what];
      if (selector) {
        args.push(selector);
      }
      return await this.execAgentBrowser(sessionName, args);
    });
  }
  async is(what, selector, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["is", what, selector]);
    });
  }
  // ── Keyboard commands ──
  async keyboardInsertText(text, worktreeId, browserPageId) {
    await assertClipboardTextWriteWithinLimitWithYield(text);
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (sessionName) => {
        let result = { inserted: true };
        for (const chunk of iterateBrowserTextInsertionChunks(
          text,
          AGENT_BROWSER_TEXT_ARGUMENT_MAX_BYTES
        )) {
          result = await this.execAgentBrowser(sessionName, ["keyboard", "inserttext", chunk]);
        }
        return result;
      },
      { requireScopedTarget: true }
    );
  }
};

// src/main/browser/agent-browser-bridge-pointer-commands.ts
var AgentBrowserBridgePointerCommands = class extends AgentBrowserBridgeInputCommands {
  // Why: coordinate pointer input needs no accessibility snapshot, so it dispatches over
  // the debugger `mouseClick` already uses instead of spawning a helper per event.
  async dispatchPointerEvent(sessionName, target, describe, build) {
    const wc = this.getWebContents(target.webContentsId);
    if (!wc || wc.isDestroyed()) {
      throw new BrowserError(
        "browser_tab_not_found",
        `Browser page ${target.browserPageId} is no longer available`
      );
    }
    const state = cdpPointerStateFor(wc);
    const preDispatch = { ...state };
    let releaseDebugger = () => {
    };
    try {
      releaseDebugger = acquireElectronDebugger(wc).release;
      const { params, focus, result } = build(state);
      if (focus) {
        wc.focus();
      }
      await wc.debugger.sendCommand("Input.dispatchMouseEvent", params);
      return result;
    } catch (error) {
      Object.assign(state, preDispatch);
      if (error instanceof BrowserError) {
        throw error;
      }
      if (!this.getWebContents(target.webContentsId)) {
        throw this.createPageUnavailableError(sessionName);
      }
      throw new BrowserError(
        "browser_error",
        `Failed to ${describe} in browser page ${target.browserPageId}: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      releaseDebugger();
    }
  }
  async mouseMove(x, y, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (sessionName, target) => this.dispatchPointerEvent(sessionName, target, "move the pointer", (state) => {
        assertFinitePointerValues({ x, y });
        state.x = x;
        state.y = y;
        return {
          params: {
            type: "mouseMoved",
            x,
            y,
            button: state.button,
            buttons: state.buttons
          },
          result: { moved: true }
        };
      }),
      { ensureSession: false }
    );
  }
  async mouseDown(button, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (sessionName, target) => this.dispatchPointerEvent(sessionName, target, "press the pointer", (state) => {
        const cdpButton = normalizeCdpPointerButton(button);
        pressCdpPointerButton(state, cdpButton);
        return {
          // Why: mirrors mouseClick — a press that does not focus the guest leaves
          // keyboard input going to whatever held focus before.
          focus: true,
          params: {
            type: "mousePressed",
            x: state.x,
            y: state.y,
            button: cdpButton,
            buttons: state.buttons,
            clickCount: state.clickCount
          },
          result: { pressed: true }
        };
      }),
      { ensureSession: false }
    );
  }
  async mouseUp(button, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (sessionName, target) => this.dispatchPointerEvent(sessionName, target, "release the pointer", (state) => {
        const cdpButton = normalizeCdpPointerButton(
          button ?? resolveCdpPointerReleaseButton(state)
        );
        releaseCdpPointerButton(state, cdpButton);
        return {
          params: {
            type: "mouseReleased",
            x: state.x,
            y: state.y,
            button: cdpButton,
            buttons: state.buttons,
            clickCount: state.clickCount
          },
          result: { released: true }
        };
      }),
      { ensureSession: false }
    );
  }
  async mouseWheel(dy, dx, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (sessionName, target) => this.dispatchPointerEvent(sessionName, target, "scroll", (state) => {
        assertFinitePointerValues({ dy, ...dx == null ? {} : { dx } });
        const deltaX = dx ?? 0;
        return {
          // Why: dispatch at the tracked position so the scrollable under the cursor
          // scrolls; the helper always dispatched wheel at (0,0).
          params: {
            type: "mouseWheel",
            x: state.x,
            y: state.y,
            deltaX,
            deltaY: dy,
            buttons: state.buttons
          },
          result: { scrolled: true, deltaX, deltaY: dy }
        };
      }),
      { ensureSession: false }
    );
  }
};

// src/main/browser/agent-browser-bridge-mouse-commands.ts
var AgentBrowserBridgeMouseCommands = class extends AgentBrowserBridgePointerCommands {
  // ── Mouse commands ──
  async mouseClick(x, y, button, worktreeId, browserPageId, radius, modifiers) {
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (_sessionName, target) => {
        const wc = this.getWebContents(target.webContentsId);
        if (!wc || wc.isDestroyed()) {
          throw new BrowserError(
            "browser_tab_not_found",
            `Browser page ${target.browserPageId} is no longer available`
          );
        }
        const cdpButton = normalizeCdpMouseButton(button);
        const buttons = cdpPointerButtonMask(cdpButton);
        const cdpModifiers = cdpMouseModifierMask(modifiers);
        const lease = acquireElectronDebugger(wc);
        try {
          wc.focus();
          const point = cdpButton === "left" ? (
            // Why: DOM activation can't carry Cmd/Ctrl/Alt/Shift, so modifier clicks use the adjusted point and let CDP dispatch the event.
            await resolveMobileTouchClickPoint(wc.debugger, x, y, radius, cdpModifiers === 0)
          ) : { x, y, adjusted: false, handled: false };
          if (!point.handled) {
            await wc.debugger.sendCommand("Input.dispatchMouseEvent", {
              type: "mousePressed",
              x: point.x,
              y: point.y,
              button: cdpButton,
              buttons,
              modifiers: cdpModifiers,
              clickCount: 1
            });
            await wc.debugger.sendCommand("Input.dispatchMouseEvent", {
              type: "mouseReleased",
              x: point.x,
              y: point.y,
              button: cdpButton,
              buttons: 0,
              modifiers: cdpModifiers,
              clickCount: 1
            });
          }
          return {
            clicked: {
              x: point.x,
              y: point.y,
              button: cdpButton,
              adjusted: point.adjusted,
              handled: point.handled
            }
          };
        } finally {
          lease.release();
        }
      },
      { ensureSession: false }
    );
  }
  // ── Find (semantic locators) ──
  async find(locator, value, action, text, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = ["find", locator, value, action];
      if (text) {
        args.push(text);
      }
      return await this.execAgentBrowser(sessionName, args);
    });
  }
  // ── Set commands ──
  async setDevice(name, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["set", "device", name]);
    });
  }
  async setOffline(state, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = ["set", "offline"];
      if (state) {
        args.push(state);
      }
      return await this.execAgentBrowser(sessionName, args);
    });
  }
  async setHeaders(headersJson, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["set", "headers", headersJson]);
    });
  }
  async setCredentials(user, pass, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["set", "credentials", user, pass]);
    });
  }
  async setMedia(colorScheme, reducedMotion, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = ["set", "media"];
      if (colorScheme) {
        args.push(colorScheme);
      }
      if (reducedMotion) {
        args.push(reducedMotion);
      }
      return await this.execAgentBrowser(sessionName, args);
    });
  }
};

// src/main/browser/agent-browser-bridge-utility-commands.ts
var AgentBrowserBridgeUtilityCommands = class extends AgentBrowserBridgeMouseCommands {
  // ── Clipboard commands ──
  async clipboardRead(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["clipboard", "read"]);
    });
  }
  async clipboardWrite(text, worktreeId, browserPageId) {
    await assertClipboardTextWriteWithinLimitWithYield(text, {
      maxBytes: AGENT_BROWSER_CLIPBOARD_WRITE_MAX_BYTES
    });
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["clipboard", "write", text]);
    });
  }
  // ── Dialog commands ──
  async dialogAccept(text, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = ["dialog", "accept"];
      if (text) {
        args.push(text);
      }
      return await this.execAgentBrowser(sessionName, args);
    });
  }
  async dialogDismiss(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["dialog", "dismiss"]);
    });
  }
  // ── Storage commands ──
  async storageLocalGet(key, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["storage", "local", "get", key]);
    });
  }
  async storageLocalSet(key, value, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["storage", "local", "set", key, value]);
    });
  }
  async storageLocalClear(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["storage", "local", "clear"]);
    });
  }
  async storageSessionGet(key, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["storage", "session", "get", key]);
    });
  }
  async storageSessionSet(key, value, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["storage", "session", "set", key, value]);
    });
  }
  async storageSessionClear(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["storage", "session", "clear"]);
    });
  }
  // ── Download command ──
  async download(selector, path, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["download", selector, path]);
    });
  }
  // ── Highlight command ──
  async highlight(selector, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["highlight", selector]);
    });
  }
  async back(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["back"]);
    });
  }
  async forward(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["forward"]);
    });
  }
  async reload(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (_sessionName, target) => {
      const wc = this.getWebContents(target.webContentsId);
      if (!wc) {
        throw new BrowserError("browser_no_tab", "Tab is no longer available");
      }
      wc.reload();
      await new Promise((resolve) => {
        let settled = false;
        let fallbackTimer = null;
        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          wc.removeListener("did-finish-load", onFinish);
          wc.removeListener("did-fail-load", onFail);
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
          resolve();
        };
        const onFinish = () => finish();
        const onFail = () => finish();
        wc.on("did-finish-load", onFinish);
        wc.on("did-fail-load", onFail);
        fallbackTimer = setTimeout(finish, 1e4);
        if (typeof fallbackTimer.unref === "function") {
          fallbackTimer.unref();
        }
      });
      return { url: wc.getURL(), title: wc.getTitle() };
    });
  }
};

// src/main/browser/agent-browser-bridge-capture-commands.ts
var AgentBrowserBridgeCaptureCommands = class extends AgentBrowserBridgeUtilityCommands {
  async screenshot(format, worktreeId, browserPageId) {
    const screenshotFormat = format === "jpeg" ? "jpeg" : "png";
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return this.readScreenshotFromResult(
        await this.execAgentBrowser(sessionName, [
          "screenshot",
          "--screenshot-format",
          screenshotFormat
        ]),
        screenshotFormat
      );
    });
  }
  async fullPageScreenshot(format, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (_sessionName, target) => {
      const wc = this.requireTargetWebContents(target);
      try {
        return await captureFullPageScreenshot(
          wc,
          format === "jpeg" ? "jpeg" : "png",
          () => this.browserManager.holdPaintForCapture(target.webContentsId)
        );
      } catch (error) {
        throw new BrowserError("browser_error", error.message);
      }
    });
  }
  readScreenshotFromResult(raw, format) {
    const parsed = raw;
    if (!parsed?.path) {
      throw new BrowserError("browser_error", "Screenshot returned no file path");
    }
    if (!(0, import_node_fs4.existsSync)(parsed.path)) {
      throw new BrowserError("browser_error", `Screenshot file not found: ${parsed.path}`);
    }
    const data = (0, import_node_fs4.readFileSync)(parsed.path).toString("base64");
    return { data, format: format === "jpeg" ? "jpeg" : "png" };
  }
  async evaluate(expression, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (_sessionName, target) => {
        const wc = this.requireTargetWebContents(target);
        let releaseDebugger = () => {
        };
        try {
          releaseDebugger = acquireElectronDebugger(wc).release;
          const { result, exceptionDetails } = await wc.debugger.sendCommand("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true
          });
          if (exceptionDetails) {
            throw new BrowserError(
              "browser_eval_error",
              exceptionDetails.exception?.description ?? exceptionDetails.text
            );
          }
          const currentTarget = this.resolveCommandTarget(worktreeId, target.browserPageId);
          if (currentTarget.webContentsId !== target.webContentsId) {
            throw new BrowserError(
              "browser_tab_changed",
              `Browser page ${target.browserPageId} changed while evaluating; retry the command`
            );
          }
          return {
            result: result.value !== void 0 ? typeof result.value === "object" && result.value !== null ? JSON.stringify(result.value) : String(result.value) : result.description ?? "",
            origin: wc.getURL()
          };
        } catch (error) {
          if (error instanceof BrowserError) {
            throw error;
          }
          if (!this.getWebContents(target.webContentsId)) {
            throw this.createPageUnavailableError(
              `${ORCA_TAB_SESSION_PREFIX}${target.browserPageId}`
            );
          }
          throw new BrowserError(
            "browser_error",
            `Failed to evaluate in browser page ${target.browserPageId}: ${error instanceof Error ? error.message : String(error)}`
          );
        } finally {
          releaseDebugger();
        }
      },
      { ensureSession: false }
    );
  }
};

// src/main/browser/agent-browser-bridge-interaction-commands.ts
var AgentBrowserBridgeInteractionCommands = class extends AgentBrowserBridgeCaptureCommands {
  async hover(element, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["hover", element]);
    });
  }
  async drag(from, to, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["drag", from, to]);
    });
  }
  async upload(element, filePaths, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, [
        "upload",
        element,
        ...filePaths
      ]);
    });
  }
  async wait(options, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = ["wait"];
      const hasCondition = !!options?.selector || !!options?.text || !!options?.url || !!options?.load || !!options?.fn;
      if (options?.selector) {
        args.push(options.selector);
      } else if (options?.timeout != null && !hasCondition) {
        args.push(String(options.timeout));
      }
      if (options?.text) {
        args.push("--text", options.text);
      }
      if (options?.url) {
        args.push("--url", options.url);
      }
      if (options?.load) {
        args.push("--load", options.load);
      }
      if (options?.fn) {
        args.push("--fn", options.fn);
      }
      const normalizedState = options?.state === "visible" ? void 0 : options?.state;
      if (normalizedState) {
        args.push("--state", normalizedState);
      }
      return await this.execAgentBrowser(sessionName, args, {
        timeoutMs: options?.timeout != null && hasCondition ? options.timeout + WAIT_PROCESS_TIMEOUT_GRACE_MS : void 0,
        timeoutError: options?.timeout != null && hasCondition ? new BrowserError(
          "browser_timeout",
          `Timed out waiting for browser condition after ${options.timeout}ms.`
        ) : void 0
      });
    });
  }
  async check(element, checked, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = checked ? ["check", element] : ["uncheck", element];
      return await this.execAgentBrowser(sessionName, args);
    });
  }
  async focus(element, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["focus", element]);
    });
  }
  async clear(element, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (sessionName) => {
        if (!await this.isExplicitContentEditableTarget(sessionName, element)) {
          await this.execAgentBrowser(sessionName, ["fill", element, ""]);
          return { cleared: element };
        }
        await this.fillExplicitContentEditable(sessionName, element, "");
        return { cleared: element };
      },
      { requireScopedTarget: true }
    );
  }
  async selectAll(element, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      await this.execAgentBrowser(sessionName, ["focus", element]);
      return await this.execAgentBrowser(sessionName, [
        "press",
        "Control+a"
      ]);
    });
  }
  async keypress(key, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(
      worktreeId,
      browserPageId,
      async (sessionName, target) => {
        const parsed = parseCdpKeyEvent(key) ?? imeFallbackKeyEvent(key);
        if (!parsed) {
          await this.ensureSession(sessionName, target.browserPageId, target.webContentsId);
          return await this.execAgentBrowser(sessionName, ["press", key]);
        }
        const wc = this.getWebContents(target.webContentsId);
        if (!wc || wc.isDestroyed()) {
          throw new BrowserError(
            "browser_tab_not_found",
            `Browser page ${target.browserPageId} is no longer available`
          );
        }
        const event = {
          windowsVirtualKeyCode: parsed.keyCode,
          nativeVirtualKeyCode: parsed.keyCode,
          key: parsed.key,
          code: parsed.code,
          modifiers: parsed.modifiers,
          location: parsed.location
        };
        let releaseDebugger = () => {
        };
        try {
          releaseDebugger = acquireElectronDebugger(wc).release;
          await wc.debugger.sendCommand("Input.dispatchKeyEvent", {
            // Why: rawKeyDown is the no-character form; sending keyDown without text
            // makes Blink synthesize an empty input for editing keys.
            type: parsed.text === null ? "rawKeyDown" : "keyDown",
            ...event,
            ...parsed.text === null ? {} : { text: parsed.text, unmodifiedText: parsed.text }
          });
          await wc.debugger.sendCommand("Input.dispatchKeyEvent", {
            type: "keyUp",
            ...event,
            // Why: the self bit is keydown-only -- Blink reports shiftKey false on the Shift keyup.
            modifiers: parsed.modifiers & ~parsed.selfModifier
          });
          return { pressed: key };
        } catch (error) {
          if (error instanceof BrowserError) {
            throw error;
          }
          if (!this.getWebContents(target.webContentsId)) {
            throw this.createPageUnavailableError(sessionName);
          }
          throw new BrowserError(
            "browser_error",
            `Failed to press ${key} in browser page ${target.browserPageId}: ${error instanceof Error ? error.message : String(error)}`
          );
        } finally {
          releaseDebugger();
        }
      },
      { ensureSession: false }
    );
  }
  async pdf(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (_sessionName, target) => {
      const wc = this.getWebContents(target.webContentsId);
      if (!wc) {
        throw new BrowserError("browser_no_tab", "Tab is no longer available");
      }
      const buffer = await wc.printToPDF({
        printBackground: true,
        preferCSSPageSize: true
      });
      return { data: buffer.toString("base64") };
    });
  }
};

// src/main/browser/agent-browser-bridge-state-commands.ts
var AgentBrowserBridgeStateCommands = class extends AgentBrowserBridgeInteractionCommands {
  // ── Cookie commands ──
  async cookieGet(_url, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, [
        "cookies",
        "get"
      ]);
    });
  }
  async cookieSet(cookie, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = ["cookies", "set", cookie.name ?? "", cookie.value ?? ""];
      if (cookie.domain) {
        args.push("--domain", cookie.domain);
      }
      if (cookie.path) {
        args.push("--path", cookie.path);
      }
      if (cookie.secure) {
        args.push("--secure");
      }
      if (cookie.httpOnly) {
        args.push("--httpOnly");
      }
      if (cookie.sameSite) {
        args.push("--sameSite", cookie.sameSite);
      }
      if (cookie.expires != null) {
        args.push("--expires", String(cookie.expires));
      }
      return await this.execAgentBrowser(sessionName, args);
    });
  }
  async cookieDelete(name, domain, _url, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = ["cookies", "clear"];
      if (name) {
        args.push("--name", name);
      }
      if (domain) {
        args.push("--domain", domain);
      }
      return await this.execAgentBrowser(sessionName, args);
    });
  }
  // ── Viewport / emulation commands ──
  async setViewport(width, height, scale = 1, mobile = false, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (_sessionName, target) => {
      const wc = this.getWebContents(target.webContentsId);
      if (!wc) {
        throw new BrowserError("browser_tab_not_found", "Tab is no longer available");
      }
      const dbg = wc.debugger;
      if (!dbg.isAttached()) {
        throw new BrowserError("browser_error", "Debugger not attached");
      }
      await sendGuestCdpCommand(wc, "Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: scale,
        mobile
      });
      await sendGuestCdpCommand(wc, "Emulation.setVisibleSize", { width, height }).catch(() => {
      });
      return {
        width,
        height,
        deviceScaleFactor: scale,
        mobile
      };
    });
  }
  async setGeolocation(lat, lon, _accuracy, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, [
        "set",
        "geo",
        String(lat),
        String(lon)
      ]);
    });
  }
  // ── Network interception commands ──
  async interceptEnable(patterns, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const urlPattern = patterns?.[0] ?? "**/*";
      const args = ["network", "route", urlPattern];
      const result = await this.execAgentBrowser(
        sessionName,
        args
      );
      const session5 = this.sessions.get(sessionName);
      if (session5) {
        this.pendingInterceptRestore.delete(sessionName);
        session5.activeInterceptPatterns = patterns ?? ["*"];
      }
      return result;
    });
  }
  async interceptDisable(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const result = await this.execAgentBrowser(sessionName, [
        "network",
        "unroute"
      ]);
      const session5 = this.sessions.get(sessionName);
      if (session5) {
        this.pendingInterceptRestore.delete(sessionName);
        session5.activeInterceptPatterns = [];
      }
      return result;
    });
  }
  async interceptList(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["network", "requests"]);
    });
  }
  // TODO: Add interceptContinue/interceptBlock once agent-browser supports per-request decisions, not just URL-pattern routing.
  // ── Capture commands ──
  async captureStart(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const result = await this.execAgentBrowser(sessionName, [
        "network",
        "har",
        "start"
      ]);
      const session5 = this.sessions.get(sessionName);
      if (session5) {
        session5.activeCapture = true;
      }
      return result;
    });
  }
  async captureStop(worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const result = await this.execAgentBrowser(sessionName, [
        "network",
        "har",
        "stop"
      ]);
      const session5 = this.sessions.get(sessionName);
      if (session5) {
        session5.activeCapture = false;
      }
      return result;
    });
  }
  async consoleLog(_limit, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, ["console"]);
    });
  }
  async networkLog(_limit, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      return await this.execAgentBrowser(sessionName, [
        "network",
        "requests"
      ]);
    });
  }
  // ── Generic passthrough ──
  async exec(command, worktreeId, browserPageId) {
    return this.enqueueTargetedCommand(worktreeId, browserPageId, async (sessionName) => {
      const args = stripAgentBrowserTargetArgs(parseShellArgs(command.trim()));
      return await this.execAgentBrowser(sessionName, args);
    });
  }
};

// src/main/browser/agent-browser-bridge.ts
var AgentBrowserBridge = class extends AgentBrowserBridgeStateCommands {
};

// src/main/browser/browser-guest-renderer-target.ts
var import_electron2 = require("electron");
function resolveRendererWebContents(rendererWebContentsIdByTabId, browserTabId) {
  const rendererWcId = rendererWebContentsIdByTabId.get(browserTabId);
  if (!rendererWcId) {
    return null;
  }
  const renderer = import_electron2.webContents.fromId(rendererWcId);
  if (!renderer || renderer.isDestroyed()) {
    return null;
  }
  return renderer;
}

// src/main/browser/browser-guest-grab-shortcuts.ts
function matchesGrabElementChord(input, platform) {
  const key = input.key.toLowerCase();
  const isLatinLetter = key.length === 1 && key >= "a" && key <= "z";
  if (isLatinLetter ? key !== "c" : input.code !== "KeyC") {
    return false;
  }
  if (input.alt || input.shift) {
    return false;
  }
  return platform === "darwin" ? input.meta && !input.control : input.control && !input.meta;
}
function setupGrabShortcutForwarding(args) {
  const { browserTabId, guest, resolveRenderer, hasActiveGrabOp } = args;
  const handler = (event, input) => {
    if (input.type !== "keyDown") {
      return;
    }
    const bareKey = input.key.toLowerCase();
    if (!input.meta && !input.control && !input.alt && !input.shift && (bareKey === "c" || bareKey === "s") && hasActiveGrabOp(browserTabId)) {
      const renderer = resolveRenderer(browserTabId);
      if (!renderer) {
        return;
      }
      event.preventDefault();
      renderer.send("browser:grabActionShortcut", { browserPageId: browserTabId, key: bareKey });
      return;
    }
    if (
      // Why: the renderer toggles the picker per message, so a held chord would flicker it.
      input.isAutoRepeat || !matchesGrabElementChord(input, process.platform)
    ) {
      return;
    }
    void guest.executeJavaScript(`(() => {
        const active = document.activeElement
        const tag = active?.tagName
        const isEditable =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active?.isContentEditable === true ||
          tag === 'SELECT' ||
          tag === 'IFRAME'
        if (isEditable) {
          return false
        }
        const selection = window.getSelection()
        return Boolean(selection && selection.type === 'Range' && selection.toString().trim().length > 0)
          ? false
          : true
      })()`).then((shouldToggle) => {
      if (!shouldToggle) {
        return;
      }
      event.preventDefault();
      const renderer = resolveRenderer(browserTabId);
      if (!renderer) {
        return;
      }
      renderer.send("browser:grabModeToggle", browserTabId, "copy");
    }).catch(() => {
    });
  };
  guest.on("before-input-event", handler);
  return () => {
    try {
      guest.off("before-input-event", handler);
    } catch {
    }
  };
}

// src/main/browser/browser-guest-context-menu.ts
var import_electron3 = require("electron");

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
    const cursor = import_electron3.screen.getCursorScreenPoint();
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
  const {
    browserTabId,
    guest,
    resolveRenderer,
    isViewportPresetActive,
    canViewportScroll,
    onViewportWheelConsumed
  } = args;
  const handler = (event, mouse) => {
    const direction = resolveGuestMouseWheelZoomDirection(mouse);
    if (direction) {
      event.preventDefault();
      markGuestWheelZoom(guest, direction);
      resolveRenderer(browserTabId)?.send("browser:zoomPage", {
        browserPageId: browserTabId,
        direction
      });
      return;
    }
    if (!isViewportPresetActive?.() || mouse.type !== "mouseWheel" || !canViewportScroll?.(mouse)) {
      return;
    }
    const { deltaX, deltaY } = mouse;
    const safeDeltaX = typeof deltaX === "number" && Number.isFinite(deltaX) ? deltaX : 0;
    const safeDeltaY = typeof deltaY === "number" && Number.isFinite(deltaY) ? deltaY : 0;
    if (safeDeltaX === 0 && safeDeltaY === 0) {
      return;
    }
    event.preventDefault();
    onViewportWheelConsumed?.(safeDeltaX, safeDeltaY);
    resolveRenderer(browserTabId)?.send("browser:scrollPage", {
      browserPageId: browserTabId,
      deltaX: safeDeltaX,
      deltaY: safeDeltaY
    });
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
  } else if (action === "browser.annotateElement") {
    renderer.send("browser:grabModeToggle", browserTabId, "annotate");
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
var import_electron9 = require("electron");

// src/main/browser/grab-guest-content-script.ts
var GRAB_GUEST_CONTENT_SCRIPT = `  function getSelectedText() {
    try {
      var selection = window.getSelection ? window.getSelection() : null;
      if (!selection || selection.rangeCount === 0) return '';
      var acc = createTextAccumulator();
      var inspected = 0;
      for (
        var i = 0;
        i < selection.rangeCount && acc.text.length < BUDGET.selectedTextMaxLength + 20;
        i++
      ) {
        var range = selection.getRangeAt(i);
        var walkerRoot = range.commonAncestorContainer;
        var walker = document.createTreeWalker(
          walkerRoot,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              if (range.intersectsNode && !range.intersectsNode(node)) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        var node = walkerRoot.nodeType === Node.TEXT_NODE ? walkerRoot : walker.nextNode();
        while (
          node &&
          acc.text.length < BUDGET.selectedTextMaxLength + 20 &&
          inspected < TEXT_NODE_SCAN_LIMIT
        ) {
          inspected++;
          var textNode = node;
          var value = textNode.nodeValue || '';
          appendTextSeparator(acc);
          var remaining =
            BUDGET.selectedTextMaxLength + 20 - acc.text.length - (acc.pendingSpace ? 1 : 0);
          if (remaining <= 0) break;
          if (value) {
            var start = textNode === range.startContainer ? range.startOffset : 0;
            var end = textNode === range.endContainer ? range.endOffset : value.length;
            if (end > start + remaining) {
              end = start + remaining;
            }
            if (textNode === range.startContainer) {
              start = Math.min(start, value.length);
            }
            value = value.slice(start, end);
            appendNormalizedText(acc, value, BUDGET.selectedTextMaxLength);
          }
          node = walker.nextNode();
        }
      }
      return finishAccumulatedText(acc, BUDGET.selectedTextMaxLength);
    } catch (e) {
      return '';
    }
  }

  function getHtmlSnippet(el) {
    var clone = el.cloneNode(true);
    // Strip script tags for safety
    var scripts = clone.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      scripts[i].remove();
    }
    var html = clone.outerHTML || '';
    return clampStr(html, BUDGET.htmlSnippetMaxLength);
  }

  function getSafeAttributes(el) {
    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      var name = attr.name.toLowerCase();
      var isAria = name.indexOf('aria-') === 0;
      if (!SAFE_ATTRS.has(name) && !isAria) continue;
      var value = attr.value;
      // Redact secret-looking values
      if (containsSecret(value)) {
        attrs[name] = '[redacted]';
      } else if ((name === 'href' || name === 'src' || name === 'action') && value) {
        // Strip query strings and fragments from URL-bearing attributes
        attrs[name] = sanitizeUrl(value);
      } else if (name === 'class') {
        // Cap class list length
        attrs[name] = clampStr(value, 200);
      } else {
        attrs[name] = value;
      }
    }
    return attrs;
  }

  // Why: guest pages control aria-labelledby; avoid regex splitting huge
  // attributes while extracting grab payload accessibility metadata.
  function getAriaLabelledByIds(value) {
    var ids = [];
    var tokenStart = -1;
    for (var index = 0; index <= value.length; index++) {
      var isEnd = index === value.length;
      if (!isEnd && !isAriaLabelledBySeparator(value.charCodeAt(index))) {
        if (tokenStart === -1) tokenStart = index;
        continue;
      }
      if (tokenStart !== -1) {
        ids.push(value.slice(tokenStart, index));
        tokenStart = -1;
        if (ids.length >= 32) break;
      }
    }
    return ids;
  }

  function isAriaLabelledBySeparator(code) {
    return code === 32 ||
      (code >= 9 && code <= 13) ||
      code === 160 ||
      code === 5760 ||
      (code >= 8192 && code <= 8202) ||
      code === 8232 ||
      code === 8233 ||
      code === 8239 ||
      code === 8287 ||
      code === 12288 ||
      code === 65279;
  }

  function getAccessibility(el) {
    var role = el.getAttribute('role') || el.tagName.toLowerCase();
    var ariaLabel = el.getAttribute('aria-label') || null;
    var ariaLabelledBy = el.getAttribute('aria-labelledby') || null;
    var accessibleName = null;
    // Attempt to derive accessible name
    if (ariaLabel) {
      accessibleName = ariaLabel;
    } else if (ariaLabelledBy) {
      var parts = getAriaLabelledByIds(ariaLabelledBy);
      var names = [];
      for (var i = 0; i < parts.length; i++) {
        var ref = document.getElementById(parts[i]);
        if (ref) names.push(getBoundedText(ref, 100));
      }
      if (names.length) accessibleName = names.join(' ');
    } else {
      // Fall back to text content for buttons/links
      var tag = el.tagName.toLowerCase();
      if (tag === 'button' || tag === 'a' || tag === 'label') {
        accessibleName = getBoundedText(el, 100);
      } else if (el.getAttribute('title')) {
        accessibleName = el.getAttribute('title');
      } else if (el.getAttribute('alt')) {
        accessibleName = el.getAttribute('alt');
      }
    }
    return {
      role: role,
      accessibleName: accessibleName,
      ariaLabel: ariaLabel,
      ariaLabelledBy: ariaLabelledBy
    };
  }

`;

// src/main/browser/grab-guest-element-context-script.ts
var GRAB_GUEST_ELEMENT_CONTEXT_SCRIPT = `  function getComputedStyleSubset(el) {
    var cs = window.getComputedStyle(el);
    var result = {};
    for (var i = 0; i < STYLE_PROPS.length; i++) {
      result[STYLE_PROPS[i]] = cs.getPropertyValue(
        STYLE_PROPS[i].replace(/[A-Z]/g, function(m) { return '-' + m.toLowerCase(); })
      ) || '';
    }
    return result;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function(ch) {
      return '\\\\' + ch;
    });
  }

  function looksHashy(value) {
    return /^[A-Za-z0-9_-]{12,}$/.test(value) && /\\d/.test(value) && /[A-Z]/.test(value);
  }

  function getStableClasses(el, maxCount) {
    if (!el.classList) return [];
    var result = [];
    for (var i = 0; i < el.classList.length && result.length < maxCount; i++) {
      var cls = el.classList[i];
      if (!cls || cls.length > 60 || containsSecret(cls)) continue;
      if (/^css-[a-z0-9]+$/i.test(cls) || looksHashy(cls)) continue;
      result.push(cls);
    }
    return result;
  }

  function buildSelectorPart(el) {
    var tag = el.tagName.toLowerCase();
    var id = el.id;
    if (id && !containsSecret(id)) {
      return tag + '#' + cssEscape(id);
    }
    var classes = getStableClasses(el, 2);
    if (classes.length > 0) {
      return tag + classes.map(function(cls) { return '.' + cssEscape(cls); }).join('');
    }
    return tag;
  }

  function isUniqueSelector(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch(e) {
      return false;
    }
  }

  function getNthOfTypeSuffix(current) {
    var tag = current.tagName;
    var index = 1;
    var sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === tag) index++;
      sibling = sibling.previousElementSibling;
    }
    if (index > 1) return ':nth-of-type(' + index + ')';

    sibling = current.nextElementSibling;
    while (sibling) {
      if (sibling.tagName === tag) return ':nth-of-type(1)';
      sibling = sibling.nextElementSibling;
    }
    return '';
  }

  function buildSelector(el) {
    var parts = [];
    var current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body && parts.length < 10) {
      var part = buildSelectorPart(current);
      var parent = current.parentElement;
      if (parent && !isUniqueSelector(parts.concat([part]).reverse().join(' > '))) {
        part += getNthOfTypeSuffix(current);
      }
      parts.unshift(part);
      var selector = parts.join(' > ');
      if (isUniqueSelector(selector)) {
        return clampStr(selector, BUDGET.selectorMaxLength);
      }
      current = parent;
    }
    return clampStr(parts.join(' > ') || el.tagName.toLowerCase(), BUDGET.selectorMaxLength);
  }

  function buildReadablePath(el) {
    var parts = [];
    var current = el;
    while (current && current !== document.documentElement && parts.length < 6) {
      var tag = current.tagName.toLowerCase();
      if (tag === 'html' || tag === 'body') break;
      var label = tag;
      var aria = current.getAttribute('aria-label');
      var role = current.getAttribute('role');
      var stableClasses = getStableClasses(current, 1);
      if (current.id && !containsSecret(current.id)) {
        label = '#' + cssEscape(current.id);
      } else if (aria && !containsSecret(aria)) {
        label = tag + '[aria-label="' + clampStr(aria, 40).replace(/"/g, '\\\\"') + '"]';
      } else if (role && !containsSecret(role)) {
        label = tag + '[role="' + clampStr(role, 30).replace(/"/g, '\\\\"') + '"]';
      } else if (stableClasses.length > 0) {
        label = '.' + cssEscape(stableClasses[0]);
      }
      parts.unshift(label);
      current = current.parentElement;
    }
    return clampStr(parts.join(' > '), BUDGET.pathMaxLength);
  }

  function buildFullPath(el) {
    var parts = [];
    var current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement && parts.length < 20) {
      parts.unshift(buildSelectorPart(current));
      current = current.parentElement;
    }
    return clampStr(parts.join(' > '), BUDGET.pathMaxLength);
  }

  function getNearbyText(el) {
    var results = [];
    var parent = el.parentElement;
    if (!parent) return results;

    function addSiblingText(sibling) {
      if (!sibling) return;
      var text = getBoundedText(sibling, BUDGET.nearbyTextEntryMaxLength);
      if (text) {
        results.push(clampStr(text, BUDGET.nearbyTextEntryMaxLength));
      }
    }

    var inspected = 0;
    var previous = el.previousElementSibling;
    var next = el.nextElementSibling;
    while (
      results.length < BUDGET.nearbyTextMaxEntries &&
      inspected < NEARBY_ELEMENT_SCAN_LIMIT &&
      (previous || next)
    ) {
      if (previous) {
        var previousSibling = previous;
        previous = previous.previousElementSibling;
        inspected++;
        addSiblingText(previousSibling);
      }
      if (
        next &&
        results.length < BUDGET.nearbyTextMaxEntries &&
        inspected < NEARBY_ELEMENT_SCAN_LIMIT
      ) {
        var nextSibling = next;
        next = next.nextElementSibling;
        inspected++;
        addSiblingText(nextSibling);
      }
    }
    return results;
  }

  function getAncestorPath(el) {
    var path = [];
    var current = el.parentElement;
    while (current && current !== document.documentElement && path.length < BUDGET.ancestorPathMaxEntries) {
      var tag = current.tagName.toLowerCase();
      var role = current.getAttribute('role');
      path.push(role ? tag + '[role=' + role + ']' : tag);
      current = current.parentElement;
    }
    return path;
  }

  function getNearbyElements(el) {
    var parent = el.parentElement;
    if (!parent) return [];
    var result = [];

    function addSibling(sibling) {
      if (!sibling) return;
      if (sibling === el) return;
      var rect = sibling.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      var label = sibling.tagName.toLowerCase();
      var stableClasses = getStableClasses(sibling, 1);
      if (stableClasses.length > 0) label += '.' + stableClasses[0];
      var text = getBoundedText(sibling, 50);
      if (text) label += ' "' + clampStr(text, 50) + '"';
      result.push(clampStr(label, BUDGET.nearbyElementMaxLength));
    }
    var inspected = 0;
    var previous = el.previousElementSibling;
    var next = el.nextElementSibling;
    while (
      result.length < BUDGET.nearbyElementsMaxEntries &&
      inspected < NEARBY_ELEMENT_SCAN_LIMIT &&
      (previous || next)
    ) {
      if (previous) {
        var previousSibling = previous;
        previous = previous.previousElementSibling;
        inspected++;
        addSibling(previousSibling);
      }
      if (
        next &&
        result.length < BUDGET.nearbyElementsMaxEntries &&
        inspected < NEARBY_ELEMENT_SCAN_LIMIT
      ) {
        var nextSibling = next;
        next = next.nextElementSibling;
        inspected++;
        addSibling(nextSibling);
      }
    }
    return result;
  }

`;

// src/main/browser/grab-guest-foundation-script.ts
var GRAB_GUEST_FOUNDATION_SCRIPT = `(function() {
  'use strict';

  // Why: always tear down any pre-existing state before arming. A malicious
  // guest page could predefine window.__orcaGrab with a fake extractPayload
  // function. By tearing down unconditionally we ensure our freshly installed
  // extraction logic is the only code that runs.
  if (window.__orcaGrab) {
    try {
      if (typeof window.__orcaGrab.cleanup === 'function') {
        window.__orcaGrab.cleanup();
      }
    } catch(e) {}
    delete window.__orcaGrab;
  }

  // --- Budget constants (mirrored from shared types) ---
  var BUDGET = {
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
    reactComponentsMaxLength: 500
  };
  var TEXT_NODE_SCAN_LIMIT = 80;
  var NEARBY_ELEMENT_SCAN_LIMIT = 80;

  // --- Safe attribute names ---
  var SAFE_ATTRS = new Set([
    'id', 'class', 'name', 'type', 'role', 'href', 'src', 'alt',
    'title', 'placeholder', 'for', 'action', 'method'
  ]);

  var SECRET_PATTERNS = [
    'access_token', 'auth_token', 'api_key', 'apikey', 'client_secret',
    'oauth_state', 'x-amz-', 'session_id', 'sessionid', 'csrf',
    'secret', 'password', 'passwd'
  ];

  var SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

  var STYLE_PROPS = [
    'display', 'position', 'width', 'height', 'margin', 'padding',
    'color', 'backgroundColor', 'border', 'borderRadius', 'fontFamily',
    'fontSize', 'fontWeight', 'lineHeight', 'textAlign', 'zIndex'
  ];

  // --- Helpers ---
  function clampStr(s, max) {
    if (!s || typeof s !== 'string') return '';
    if (s.length <= max) return s;
    return s.slice(0, max) + ' (truncated)';
  }

  function containsSecret(value) {
    if (!value) return false;
    var lower = value.toLowerCase();
    for (var i = 0; i < SECRET_PATTERNS.length; i++) {
      if (lower.indexOf(SECRET_PATTERNS[i]) !== -1) return true;
    }
    return false;
  }

  function sanitizeUrl(url) {
    try {
      var u = new URL(url);
      if (u.protocol === 'about:') {
        return u.toString() === 'about:blank' ? 'about:blank' : '';
      }
      if (!SAFE_URL_PROTOCOLS.has(u.protocol)) {
        return '';
      }
      u.username = '';
      u.password = '';
      u.search = '';
      u.hash = '';
      return u.toString();
    } catch (e) {
      // Why: returning the raw URL on parse failure could preserve javascript:
      // URIs or other non-http schemes. Return empty string instead.
      return '';
    }
  }

  function createTextAccumulator() {
    return { text: '', pendingSpace: false };
  }

  function isWhitespaceCode(code) {
    return code === 32 || (code >= 9 && code <= 13) || code === 160 ||
      code === 5760 || (code >= 8192 && code <= 8202) || code === 8232 ||
      code === 8233 || code === 8239 || code === 8287 || code === 12288 ||
      code === 65279;
  }

  function appendTextSeparator(acc) {
    if (acc.text.length > 0) acc.pendingSpace = true;
  }

  function appendNormalizedText(acc, text, max) {
    var limit = max + 20;
    var value = String(text || '');
    for (var i = 0; i < value.length && acc.text.length < limit; i++) {
      var code = value.charCodeAt(i);
      if (isWhitespaceCode(code)) {
        if (acc.text.length > 0) acc.pendingSpace = true;
        continue;
      }
      if (acc.pendingSpace) {
        acc.text += ' ';
        acc.pendingSpace = false;
        if (acc.text.length >= limit) break;
      }
      acc.text += value.charAt(i);
    }
  }

  function finishAccumulatedText(acc, max) {
    return clampStr(acc.text, max);
  }

  function getBoundedText(el, max) {
    try {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var acc = createTextAccumulator();
      var inspected = 0;
      var node = walker.nextNode();
      while (node && acc.text.length < max + 20 && inspected < TEXT_NODE_SCAN_LIMIT) {
        inspected++;
        appendTextSeparator(acc);
        var remaining = max + 20 - acc.text.length - (acc.pendingSpace ? 1 : 0);
        if (remaining <= 0) break;
        appendNormalizedText(acc, (node.nodeValue || '').slice(0, remaining), max);
        node = walker.nextNode();
      }
      return finishAccumulatedText(acc, max);
    } catch (e) {
      return '';
    }
  }

  function getTextSnippet(el) {
    return getBoundedText(el, BUDGET.textSnippetMaxLength);
  }

`;

// src/shared/browser-annotation-viewport-report.ts
function isValidBrowserGrabRect(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const rect = value;
  return typeof rect.x === "number" && Number.isFinite(rect.x) && typeof rect.y === "number" && Number.isFinite(rect.y) && typeof rect.width === "number" && Number.isFinite(rect.width) && rect.width >= 0 && typeof rect.height === "number" && Number.isFinite(rect.height) && rect.height >= 0;
}

// src/shared/browser-annotation-viewport-bridge.ts
var BROWSER_ANNOTATION_VIEWPORT_BRIDGE_WORLD_ID = 1207;
var BROWSER_ANNOTATION_VIEWPORT_MESSAGE_PREFIX = "__orca_annotation_viewport__:";
var BROWSER_GRAB_SELECTED_ATTRIBUTE = "data-orca-grab-selected";
function isValidBrowserAnnotationViewportBridgeToken(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
}
function isValidBrowserAnnotationViewportBridgeMarkers(value) {
  return Array.isArray(value) && value.length <= 50 && value.every((marker) => {
    if (!marker || typeof marker !== "object") {
      return false;
    }
    const candidate = marker;
    return typeof candidate.id === "string" && candidate.id.length > 0 && candidate.id.length <= 100 && Number.isInteger(candidate.index) && candidate.index >= 0 && candidate.index < 100 && typeof candidate.isFixed === "boolean" && isValidBrowserGrabRect(candidate.rectPage) && isValidBrowserGrabRect(candidate.rectViewport);
  });
}
function buildBrowserAnnotationViewportBridgeScript({
  emitViewport,
  enabled,
  markers,
  selectionId,
  token
}) {
  return `(() => {
  'use strict';

  const enabled = ${JSON.stringify(enabled)};
  const emitViewportMessages = ${JSON.stringify(emitViewport)};
  const markers = ${JSON.stringify(markers)};
  const selectionId = ${JSON.stringify(selectionId ?? null)};
  const token = ${JSON.stringify(token)};
  const prefix = ${JSON.stringify(BROWSER_ANNOTATION_VIEWPORT_MESSAGE_PREFIX)};
  const stateKey = '__orcaBrowserAnnotationViewportBridge';
  const hostAttribute = 'data-orca-browser-annotation-overlay';
  const selectedAttribute = ${JSON.stringify(BROWSER_GRAB_SELECTED_ATTRIBUTE)};
  const markerSize = 24;

  const removeOverlay = (state) => {
    if (state && state.host && state.host.parentNode) {
      state.host.parentNode.removeChild(state.host);
    }
  };

  const cleanup = (state) => {
    if (!state) return;
    if (state.raf) {
      cancelAnimationFrame(state.raf);
    }
    if (state.requestUpdate) {
      window.removeEventListener('scroll', state.requestUpdate, true);
      document.removeEventListener('scroll', state.requestUpdate, true);
      window.removeEventListener('resize', state.requestUpdate, true);
    }
    if (state.onBeforeUnload) {
      window.removeEventListener('beforeunload', state.onBeforeUnload);
    }
    if (state.targetObserver) {
      state.targetObserver.disconnect();
    }
    removeOverlay(state);
  };

  const existing = globalThis[stateKey];
  if (!enabled) {
    cleanup(existing);
    delete globalThis[stateKey];
    return true;
  }

  const toNumber = (value, fallback) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  const readViewport = () => ({
    scrollX: toNumber(window.scrollX, toNumber(window.pageXOffset, 0)),
    scrollY: toNumber(window.scrollY, toNumber(window.pageYOffset, 0))
  });

  // Why: the card must follow the element itself, not a click-time copy; the grab overlay
  // marks it in the shared DOM because this world cannot see the page's objects.
  const trackTarget = (state) => {
    const current = state.target;
    let next = null;
    if (emitViewportMessages && selectionId) {
      for (const candidate of document.querySelectorAll('[' + selectedAttribute + ']')) {
        if (candidate.getAttribute(selectedAttribute) !== selectionId) continue;
        if (next) {
          next = null;
          break;
        }
        next = candidate;
      }
    }
    if (next !== current) {
      state.target = next;
      if (state.targetObserver) {
        state.targetObserver.disconnect();
        if (next) {
          state.targetObserver.observe(next, { box: 'border-box' });
          if (next !== document.documentElement) {
            state.targetObserver.observe(document.documentElement);
          }
        }
      }
    }
    return next;
  };

  const readTarget = (target) => {
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };

  const emitViewport = (state) => {
    const target = trackTarget(state);
    if (!emitViewportMessages) return;
    try {
      const report = readViewport();
      report.viewportWidth = toNumber(window.innerWidth, 0);
      report.target = readTarget(target);
      console.debug(prefix + token + ':' + JSON.stringify(report));
    } catch (e) {}
  };

  const getRoot = () => document.body || document.documentElement;

  const ensureOverlay = (state) => {
    if (state.host && state.shadowRoot) {
      return state.shadowRoot;
    }
    const root = getRoot();
    if (!root) return null;
    const host = document.createElement('div');
    host.setAttribute(hostAttribute, '');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;contain:layout style paint;overflow:hidden;';
    const shadowRoot = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = '.marker{box-sizing:border-box;position:absolute;left:0;top:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:9999px;border:1px solid rgba(255,255,255,0.95);background:#2563eb;color:#fff;font:600 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.18);will-change:transform;pointer-events:none;user-select:none;}';
    shadowRoot.appendChild(style);
    root.appendChild(host);
    state.host = host;
    state.shadowRoot = shadowRoot;
    return shadowRoot;
  };

  const updateMarkers = (state, nextMarkers) => {
    state.markers = Array.isArray(nextMarkers) ? nextMarkers : [];
    if (state.markers.length === 0) {
      removeOverlay(state);
      state.host = null;
      state.shadowRoot = null;
      state.markerElements = new Map();
      return;
    }
    const shadowRoot = ensureOverlay(state);
    if (!shadowRoot) return;
    const liveIds = new Set();
    state.markers.forEach((marker) => {
      liveIds.add(marker.id);
      let element = state.markerElements.get(marker.id);
      if (!element) {
        element = document.createElement('span');
        element.className = 'marker';
        shadowRoot.appendChild(element);
        state.markerElements.set(marker.id, element);
      }
      element.textContent = String(marker.index + 1);
    });
    state.markerElements.forEach((element, id) => {
      if (!liveIds.has(id)) {
        element.remove();
        state.markerElements.delete(id);
      }
    });
  };

  const positionMarkers = (state) => {
    if (!state.markers || state.markers.length === 0) return;
    const viewport = readViewport();
    const viewportWidth = toNumber(window.innerWidth, 0);
    const viewportHeight = toNumber(window.innerHeight, 0);
    state.markers.forEach((marker) => {
      const element = state.markerElements.get(marker.id);
      if (!element) return;
      const sourceRect = marker.isFixed ? marker.rectViewport : marker.rectPage;
      const x = marker.isFixed ? sourceRect.x : sourceRect.x - viewport.scrollX;
      const y = marker.isFixed ? sourceRect.y : sourceRect.y - viewport.scrollY;
      const width = toNumber(sourceRect.width, 0);
      const height = toNumber(sourceRect.height, 0);
      const visible =
        x + width >= 0 &&
        y + height >= 0 &&
        x <= viewportWidth &&
        y <= viewportHeight;
      if (!visible) {
        element.style.display = 'none';
        return;
      }
      element.style.display = 'flex';
      element.style.transform =
        'translate3d(' +
        (x + width / 2 - markerSize / 2) +
        'px,' +
        (y + height - markerSize / 2) +
        'px,0)';
    });
  };

  if (existing && existing.requestUpdate) {
    existing.emitViewport = emitViewport;
    updateMarkers(existing, markers);
    existing.requestUpdate();
    return true;
  }

  const state = {
    raf: 0,
    emitViewport,
    host: null,
    markerElements: new Map(),
    markers: [],
    shadowRoot: null,
    requestUpdate: null,
    onBeforeUnload: null,
    target: null,
    targetObserver: null
  };

  state.requestUpdate = () => {
    if (state.raf) return;
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      positionMarkers(state);
      state.emitViewport(state);
    });
  };
  if (typeof ResizeObserver === 'function') {
    state.targetObserver = new ResizeObserver(state.requestUpdate);
  }

  // Navigation can hold IPC cleanup until the next document finishes loading.
  state.onBeforeUnload = () => {
    cleanup(state);
    delete globalThis[stateKey];
  };

  updateMarkers(state, markers);
  window.addEventListener('scroll', state.requestUpdate, true);
  document.addEventListener('scroll', state.requestUpdate, true);
  window.addEventListener('resize', state.requestUpdate, true);
  window.addEventListener('beforeunload', state.onBeforeUnload);
  globalThis[stateKey] = state;
  state.requestUpdate();
  return true;
})();`;
}

// src/main/browser/grab-guest-overlay-script.ts
var GRAB_GUEST_OVERLAY_SCRIPT = `  var host = document.createElement('div');
  host.id = '__orca-grab-host';
  host.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:all;cursor:crosshair;';
  document.documentElement.appendChild(host);

  var shadow = host.attachShadow({ mode: 'closed' });

  // Visual container for highlight/label \u2014 pointer-events:none so clicks go to host
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;';
  shadow.appendChild(overlay);

  // Why: the highlight uses a white border with a dark outer shadow so it
  // reads well on both light and dark page backgrounds.
  var highlightBox = document.createElement('div');
  highlightBox.style.cssText = 'position:fixed;border:2px solid rgba(255,255,255,0.9);border-radius:3px;pointer-events:none;transition:all 0.05s ease-out;display:none;background:rgba(255,255,255,0.08);box-shadow:0 0 0 1px rgba(0,0,0,0.3),0 2px 8px rgba(0,0,0,0.15);';
  overlay.appendChild(highlightBox);

  // Hover label \u2014 dark neutral pill
  var hoverLabel = document.createElement('div');
  hoverLabel.style.cssText = 'position:fixed;padding:3px 8px;background:rgba(30,30,30,0.92);color:#e5e5e5;font:11px/1.4 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;border-radius:4px;pointer-events:none;white-space:nowrap;display:none;max-width:300px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
  overlay.appendChild(hoverLabel);

  var currentEl = null;

  function updateHighlight(el) {
    if (!el || el === document.documentElement || el === document.body) {
      highlightBox.style.display = 'none';
      hoverLabel.style.display = 'none';
      currentEl = null;
      return;
    }
    currentEl = el;
    var rect = el.getBoundingClientRect();
    highlightBox.style.left = rect.x + 'px';
    highlightBox.style.top = rect.y + 'px';
    highlightBox.style.width = rect.width + 'px';
    highlightBox.style.height = rect.height + 'px';
    highlightBox.style.display = 'block';

    // Build label text
    var tag = el.tagName.toLowerCase();
    var role = el.getAttribute('role');
    var text = getBoundedText(el, 40);
    if (text.length > 40) text = text.slice(0, 37) + '...';
    var w = Math.round(rect.width);
    var h = Math.round(rect.height);
    var parts = [tag];
    if (role) parts.push('role=' + role);
    if (text) parts.push('"' + text + '"');
    parts.push(w + 'x' + h);
    hoverLabel.textContent = parts.join('  ');

    // Position label below the element, or above if near bottom
    var labelY = rect.bottom + 6;
    if (labelY + 28 > window.innerHeight) {
      labelY = rect.top - 28;
    }
    hoverLabel.style.left = Math.max(4, rect.x) + 'px';
    hoverLabel.style.top = labelY + 'px';
    hoverLabel.style.display = 'block';
  }

  function onPointerMove(e) {
    // Temporarily hide the overlay to hit-test the element underneath
    host.style.pointerEvents = 'none';
    var el = document.elementFromPoint(e.clientX, e.clientY);
    host.style.pointerEvents = 'all';
    if (el) {
      requestAnimationFrame(function() { updateHighlight(el); });
    }
  }

  // Why: mousemove on the host (not document) because the host is the
  // full-viewport click catcher that receives all pointer events.
  host.addEventListener('mousemove', onPointerMove);

  var selectedAttribute = ${JSON.stringify(BROWSER_GRAB_SELECTED_ATTRIBUTE)};
  var selectedEl = null;
  var selectedValue = null;
  var previousSelectedValue = null;
  var frozenFrame = 0;
  var frozenResizeObserver = null;

  function refreshFrozenHighlight() {
    frozenFrame = 0;
    if (selectedEl && selectedEl.isConnected) {
      updateHighlight(selectedEl);
    } else {
      highlightBox.style.display = 'none';
      hoverLabel.style.display = 'none';
    }
  }

  function scheduleFrozenHighlight() {
    if (!frozenFrame) frozenFrame = requestAnimationFrame(refreshFrozenHighlight);
  }

  function stopTrackingSelection() {
    window.removeEventListener('scroll', scheduleFrozenHighlight, true);
    window.removeEventListener('resize', scheduleFrozenHighlight, true);
    if (frozenResizeObserver) frozenResizeObserver.disconnect();
    frozenResizeObserver = null;
    if (frozenFrame) cancelAnimationFrame(frozenFrame);
    frozenFrame = 0;
    if (selectedEl && selectedEl.getAttribute(selectedAttribute) === selectedValue) {
      try {
        if (previousSelectedValue === null) selectedEl.removeAttribute(selectedAttribute);
        else selectedEl.setAttribute(selectedAttribute, previousSelectedValue);
      } catch(e) {}
    }
    selectedEl = null;
    selectedValue = null;
    previousSelectedValue = null;
  }

  // Store state for awaitClick/finalize/teardown access
  window.__orcaGrab = {
    host: host,
    extractPayload: extractPayload,
    getCurrentElement: function() { return currentEl; },
    // Why: freeze the highlight so the selected element stays outlined while
    // the renderer shows the copy menu. Disabling pointer-events on the host
    // lets the cursor return to normal and prevents the crosshair from showing
    // over the dropdown menu's area in the webview.
    freezeHighlight: function(selectionId) {
      host.removeEventListener('mousemove', onPointerMove);
      host.style.pointerEvents = 'none';
      host.style.cursor = 'default';
      // Why: the outline must follow the element after the click \u2014 page and inner-box
      // scroll (capture), resize/zoom and the element's own size changes.
      selectedEl = currentEl;
      if (!selectedEl) return;
      // Why: the isolated-world viewport bridge finds the selection by this marker; it
      // cannot see this world's objects, and the page must not see the bridge's token.
      previousSelectedValue = selectedEl.getAttribute(selectedAttribute);
      selectedValue = selectionId;
      selectedEl.setAttribute(selectedAttribute, selectionId);
      highlightBox.style.transition = 'none';
      window.addEventListener('scroll', scheduleFrozenHighlight, true);
      window.addEventListener('resize', scheduleFrozenHighlight, true);
      if (typeof ResizeObserver === 'function') {
        frozenResizeObserver = new ResizeObserver(scheduleFrozenHighlight);
        frozenResizeObserver.observe(selectedEl, { box: 'border-box' });
        // A scrollbar appearing narrows the page without a window resize.
        if (selectedEl !== document.documentElement) {
          frozenResizeObserver.observe(document.documentElement);
        }
      }
    },
    cleanup: function() {
      host.removeEventListener('mousemove', onPointerMove);
      stopTrackingSelection();
      try { host.remove(); } catch(e) {}
      delete window.__orcaGrab;
    }
  };

  return true;
})()`;

// src/main/browser/grab-guest-react-script.ts
var GRAB_GUEST_REACT_SCRIPT = `  function isElementFixed(el) {
    var current = el;
    while (current && current !== document.body) {
      var position = window.getComputedStyle(current).position;
      if (position === 'fixed' || position === 'sticky') return true;
      current = current.parentElement;
    }
    return false;
  }

  function getFiberFromElement(el) {
    var keys = Object.keys(el);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('__reactFiber$') === 0 || keys[i].indexOf('__reactInternalInstance$') === 0) {
        try {
          return el[keys[i]] || null;
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }

  function getComponentNameFromFiber(fiber) {
    if (!fiber) return null;
    var type = fiber.type || fiber.elementType;
    if (!type || typeof type === 'string') return null;
    if (type.displayName || type.name) return type.displayName || type.name;
    if (type.render && (type.render.displayName || type.render.name)) {
      return type.render.displayName || type.render.name;
    }
    if (type.type && (type.type.displayName || type.type.name)) {
      return type.type.displayName || type.type.name;
    }
    return null;
  }

  function shouldSkipReactName(name) {
    if (!name || name.length <= 2) return true;
    return /^(Fragment|Root|Routes|Route|Outlet|Provider|Consumer|Profiler|Suspense)$/.test(name) ||
      /(?:Boundary|BoundaryHandler|Router|Provider|Consumer|Context|Wrapper)$/.test(name) ||
      /^(Inner|Outer|Client|Server|RSC|Dev|React|Hot)/.test(name);
  }

  function cleanSourcePath(path) {
    if (!path) return '';
    return String(path)
      .replace(/[?#].*$/, '')
      .replace(/^turbopack:\\/\\/\\/\\[project\\]\\//, '')
      .replace(/^webpack-internal:\\/\\/\\/\\.\\//, '')
      .replace(/^webpack-internal:\\/\\/\\//, '')
      .replace(/^webpack:\\/\\/\\/\\.\\//, '')
      .replace(/^webpack:\\/\\/\\//, '')
      .replace(/^turbopack:\\/\\/\\//, '')
      .replace(/^https?:\\/\\/[^/]+\\//, '')
      .replace(/^file:\\/\\/\\//, '/')
      .replace(/^\\([^)]+\\)\\/\\.\\//, '')
      .replace(/^\\.\\//, '');
  }

  function getReactMetadata(el) {
    try {
      var fiber = getFiberFromElement(el);
      var components = [];
      var sourceFile = null;
      var depth = 0;
      while (fiber && depth < 35) {
        var name = getComponentNameFromFiber(fiber);
        if (name && !shouldSkipReactName(name) && components.indexOf(name) === -1 && components.length < 6) {
          components.push(name);
        }
        var source = fiber._debugSource || (fiber._debugOwner && fiber._debugOwner._debugSource);
        if (!sourceFile && source && source.fileName && source.lineNumber) {
          sourceFile = cleanSourcePath(source.fileName) + ':' + source.lineNumber +
            (source.columnNumber !== undefined ? ':' + source.columnNumber : '');
          if (containsSecret(sourceFile)) {
            sourceFile = null;
          }
        }
        fiber = fiber.return;
        depth++;
      }
      return {
        reactComponents: components.length > 0
          ? clampStr(components.slice().reverse().map(function(c) { return '<' + c + '>'; }).join(' '), BUDGET.reactComponentsMaxLength)
          : null,
        sourceFile: sourceFile ? clampStr(sourceFile, BUDGET.sourceFileMaxLength) : null
      };
    } catch (e) {
      return { reactComponents: null, sourceFile: null };
    }
  }

  // --- Build full payload for an element ---
  function extractPayload(el) {
    var rect = el.getBoundingClientRect();
    var react = getReactMetadata(el);
    return {
      page: {
        sanitizedUrl: sanitizeUrl(window.location.href),
        title: document.title || '',
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio || 1,
        capturedAt: new Date().toISOString()
      },
      target: {
        tagName: el.tagName.toLowerCase(),
        selector: buildSelector(el),
        elementPath: buildReadablePath(el),
        fullPath: buildFullPath(el),
        cssClasses: containsSecret(el.getAttribute('class') || '')
          ? '[redacted]'
          : clampStr(el.getAttribute('class') || '', BUDGET.cssClassesMaxLength),
        nearbyElements: getNearbyElements(el),
        selectedText: getSelectedText() || null,
        isFixed: isElementFixed(el),
        reactComponents: react.reactComponents,
        sourceFile: react.sourceFile,
        textSnippet: getTextSnippet(el),
        htmlSnippet: getHtmlSnippet(el),
        attributes: getSafeAttributes(el),
        accessibility: getAccessibility(el),
        rectViewport: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        },
        rectPage: {
          x: rect.x + window.scrollX,
          y: rect.y + window.scrollY,
          width: rect.width,
          height: rect.height
        },
        computedStyles: getComputedStyleSubset(el)
      },
      nearbyText: getNearbyText(el),
      ancestorPath: getAncestorPath(el),
      screenshot: null
    };
  }

  // --- Overlay UI ---
  // Why: the host element is a full-viewport overlay with pointer-events:all
  // so it acts as a click catcher. This prevents the page from receiving the
  // selection click. The overlay uses elementFromPoint (with itself temporarily
  // hidden) to identify the element underneath the pointer.
`;

// src/main/browser/grab-guest-selection-scripts.ts
var AWAIT_CLICK_SCRIPT = `(async function() {
  // Why: hand the click result to executeJavaScript through a native (intrinsic)
  // Promise. On pages that replace the global Promise with a non-native thenable
  // \u2014 e.g. Angular Zone.js's ZoneAwarePromise \u2014 a bare \`new Promise(...)\` is not
  // recognized as a promise by Electron, so its raw wrapper object (exposing
  // __zone_symbol__state/__value instead of { page, target }) crosses the boundary
  // and main rejects it as an invalid payload structure. An async function's
  // promise comes from the engine intrinsic that page code cannot reassign, so
  // Electron always unwraps it to the resolved payload.
  return await new Promise(function(resolve, reject) {
    'use strict';
    var grab = window.__orcaGrab;
    if (!grab) {
      reject(new Error('Grab not armed'));
      return;
    }

    function extractSelectedPayload(el) {
      try {
        return grab.extractPayload(el);
      } catch (error) {
        grab.cleanup();
        reject(error instanceof Error ? error : new Error('Failed to extract element context'));
        return null;
      }
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      grab.host.removeEventListener('click', onClick, true);
      grab.host.removeEventListener('contextmenu', onContext, true);
      var el = grab.getCurrentElement();
      if (!el) {
        grab.cleanup();
        reject(new Error('cancelled'));
        return;
      }
      var payload = extractSelectedPayload(el);
      if (!payload) return;
      // Why: freeze the highlight instead of removing it so the user sees
      // which element was selected while the copy menu is shown. Teardown
      // happens later when the renderer calls setGrabMode(false) or re-arms.
      grab.freezeHighlight(payload.page.capturedAt);
      resolve(payload);
    }

    function onContext(e) {
      // Why: right-click resolves with the payload wrapped in a context-menu
      // marker so the renderer can show the full action dropdown instead of
      // auto-copying. This gives users a deliberate path to screenshot and
      // other secondary actions while keeping left-click as the fast copy path.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      grab.host.removeEventListener('click', onClick, true);
      grab.host.removeEventListener('contextmenu', onContext, true);
      var el = grab.getCurrentElement();
      if (!el) {
        grab.cleanup();
        reject(new Error('cancelled'));
        return;
      }
      var payload = extractSelectedPayload(el);
      if (!payload) return;
      grab.freezeHighlight(payload.page.capturedAt);
      resolve({ __orcaContextMenu: true, payload: payload });
    }

    grab.host.addEventListener('click', onClick, true);
    grab.host.addEventListener('contextmenu', onContext, true);

    // Store cancel hook so teardown can settle the Promise
    grab.cancelAwait = function() {
      grab.host.removeEventListener('click', onClick, true);
      grab.host.removeEventListener('contextmenu', onContext, true);
      grab.cleanup();
      // Why: teardown cancellation is a normal user flow; resolving a marker
      // avoids a noisy guest-console Error while main still treats it as cancel.
      resolve({ __orcaCancelled: true });
    };
  });
})()`;
var FINALIZE_SCRIPT = `(function() {
  'use strict';
  var grab = window.__orcaGrab;
  if (!grab) return null;
  var el = grab.getCurrentElement();
  if (!el) return null;
  var payload = null;
  try {
    payload = grab.extractPayload(el);
  } catch (e) {
    grab.cleanup();
    return null;
  }
  grab.cleanup();
  return payload;
})()`;
var EXTRACT_HOVER_SCRIPT = `(function() {
  'use strict';
  var grab = window.__orcaGrab;
  if (!grab) return null;
  var el = grab.getCurrentElement();
  if (!el) return null;
  try {
    return grab.extractPayload(el);
  } catch (e) {
    return null;
  }
})()`;
var TEARDOWN_SCRIPT = `(function() {
  'use strict';
  var grab = window.__orcaGrab;
  if (!grab) return true;
  // If there's an active awaitClick Promise, cancel it: cancelAwait resolves
  // it with the __orcaCancelled marker so the executeJavaScript call in main
  // settles the grab op as a cancellation.
  if (grab.cancelAwait) {
    grab.cancelAwait();
  } else {
    grab.cleanup();
  }
  return true;
})()`;

// src/main/browser/grab-guest-script.ts
function buildGuestOverlayScript(action) {
  switch (action) {
    case "arm":
      return ARM_SCRIPT;
    case "awaitClick":
      return AWAIT_CLICK_SCRIPT;
    case "finalize":
      return FINALIZE_SCRIPT;
    case "extractHover":
      return EXTRACT_HOVER_SCRIPT;
    case "teardown":
      return TEARDOWN_SCRIPT;
  }
}
var ARM_SCRIPT = [
  GRAB_GUEST_FOUNDATION_SCRIPT,
  GRAB_GUEST_CONTENT_SCRIPT,
  GRAB_GUEST_ELEMENT_CONTEXT_SCRIPT,
  GRAB_GUEST_REACT_SCRIPT,
  GRAB_GUEST_OVERLAY_SCRIPT
].join("");

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

// src/main/browser/browser-grab-payload.ts
var SAFE_GRAB_URL_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:", "file:"]);
function clampGrabPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const obj = raw;
  if (!obj.page || typeof obj.page !== "object") {
    return null;
  }
  if (!obj.target || typeof obj.target !== "object") {
    return null;
  }
  const page = obj.page;
  const target = obj.target;
  const clampStr = (s, max) => {
    const str = typeof s === "string" ? s : "";
    if (str.length <= max) {
      return str;
    }
    return `${str.slice(0, max)} (truncated)`;
  };
  const clampArray = (arr, maxEntries, maxEntryLength) => {
    const items = Array.isArray(arr) ? arr : [];
    return items.slice(0, maxEntries).map((item) => clampStr(item, maxEntryLength));
  };
  const safeStr = (s, max = 500) => clampStr(s, max);
  const safeNum = (n, fallback = 0) => typeof n === "number" && Number.isFinite(n) ? n : fallback;
  const containsSecret = (val) => {
    const lower = val.toLowerCase();
    return GRAB_SECRET_PATTERNS.some((p) => lower.includes(p));
  };
  const sanitizeUrl = (rawUrl) => {
    const str = typeof rawUrl === "string" ? rawUrl : "";
    if (!str) {
      return "";
    }
    try {
      const url = new URL(str);
      if (url.protocol === "about:") {
        return url.toString() === "about:blank" ? "about:blank" : "";
      }
      if (!SAFE_GRAB_URL_PROTOCOLS.has(url.protocol)) {
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
  };
  const safeAttributes = (attrs) => {
    if (!attrs || typeof attrs !== "object") {
      return {};
    }
    const filtered = {};
    for (const [key, value] of Object.entries(attrs)) {
      const name = key.toLowerCase();
      const isAria = name.startsWith("aria-");
      const isSafe = GRAB_SAFE_ATTRIBUTE_NAMES.has(name);
      if (!isAria && !isSafe) {
        continue;
      }
      const strValue = safeStr(value, 2e3);
      if (containsSecret(strValue)) {
        filtered[name] = "[redacted]";
      } else if ((name === "href" || name === "src" || name === "action") && strValue) {
        filtered[name] = sanitizeUrl(strValue);
      } else if (name === "class") {
        filtered[name] = safeStr(value, 200);
      } else {
        filtered[name] = safeStr(value, 500);
      }
    }
    return filtered;
  };
  const safeMetadataStr = (value, max) => {
    const strValue = safeStr(value, max);
    return strValue && containsSecret(strValue) ? "[redacted]" : strValue;
  };
  const safeNullableMetadataStr = (value, max) => safeMetadataStr(value, max) || null;
  const safeMetadataArray = (arr, maxEntries, maxEntryLength) => {
    const items = Array.isArray(arr) ? arr : [];
    return items.slice(0, maxEntries).map((item) => safeMetadataStr(item, maxEntryLength)).filter(Boolean);
  };
  const safeRect = (r) => {
    if (!r || typeof r !== "object") {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const rect = r;
    return {
      x: safeNum(rect.x),
      y: safeNum(rect.y),
      width: safeNum(rect.width),
      height: safeNum(rect.height)
    };
  };
  const accessibility = target.accessibility;
  const computedStyles = target.computedStyles;
  return {
    page: {
      // Why: re-sanitize the URL main-side so a compromised guest cannot
      // pass through query strings containing tokens or secrets.
      sanitizedUrl: sanitizeUrl(page.sanitizedUrl),
      title: safeStr(page.title, 500),
      viewportWidth: safeNum(page.viewportWidth),
      viewportHeight: safeNum(page.viewportHeight),
      scrollX: safeNum(page.scrollX),
      scrollY: safeNum(page.scrollY),
      devicePixelRatio: safeNum(page.devicePixelRatio, 1),
      capturedAt: safeStr(page.capturedAt, 100)
    },
    target: {
      tagName: safeStr(target.tagName, 50),
      selector: safeStr(target.selector, GRAB_BUDGET.selectorMaxLength),
      elementPath: safeMetadataStr(target.elementPath, GRAB_BUDGET.pathMaxLength),
      fullPath: safeMetadataStr(target.fullPath, GRAB_BUDGET.pathMaxLength),
      cssClasses: safeMetadataStr(target.cssClasses, GRAB_BUDGET.cssClassesMaxLength),
      nearbyElements: safeMetadataArray(
        target.nearbyElements,
        GRAB_BUDGET.nearbyElementsMaxEntries,
        GRAB_BUDGET.nearbyElementMaxLength
      ),
      selectedText: safeMetadataStr(target.selectedText, GRAB_BUDGET.selectedTextMaxLength) || null,
      isFixed: target.isFixed === true,
      reactComponents: safeNullableMetadataStr(
        target.reactComponents,
        GRAB_BUDGET.reactComponentsMaxLength
      ),
      sourceFile: safeNullableMetadataStr(target.sourceFile, GRAB_BUDGET.sourceFileMaxLength),
      textSnippet: clampStr(target.textSnippet, GRAB_BUDGET.textSnippetMaxLength),
      htmlSnippet: clampStr(target.htmlSnippet, GRAB_BUDGET.htmlSnippetMaxLength),
      attributes: safeAttributes(target.attributes),
      accessibility: {
        role: safeNullableMetadataStr(accessibility?.role, 500),
        accessibleName: safeNullableMetadataStr(accessibility?.accessibleName, 500),
        ariaLabel: safeNullableMetadataStr(accessibility?.ariaLabel, 500),
        ariaLabelledBy: safeNullableMetadataStr(accessibility?.ariaLabelledBy, 500)
      },
      rectViewport: safeRect(target.rectViewport),
      rectPage: safeRect(target.rectPage),
      computedStyles: {
        display: safeStr(computedStyles?.display),
        position: safeStr(computedStyles?.position),
        width: safeStr(computedStyles?.width),
        height: safeStr(computedStyles?.height),
        margin: safeStr(computedStyles?.margin),
        padding: safeStr(computedStyles?.padding),
        color: safeStr(computedStyles?.color),
        backgroundColor: safeStr(computedStyles?.backgroundColor),
        border: safeStr(computedStyles?.border),
        borderRadius: safeStr(computedStyles?.borderRadius),
        fontFamily: safeStr(computedStyles?.fontFamily),
        fontSize: safeStr(computedStyles?.fontSize),
        fontWeight: safeStr(computedStyles?.fontWeight),
        lineHeight: safeStr(computedStyles?.lineHeight),
        textAlign: safeStr(computedStyles?.textAlign),
        zIndex: safeStr(computedStyles?.zIndex)
      }
    },
    nearbyText: clampArray(
      obj.nearbyText,
      GRAB_BUDGET.nearbyTextMaxEntries,
      GRAB_BUDGET.nearbyTextEntryMaxLength
    ),
    ancestorPath: clampArray(obj.ancestorPath, GRAB_BUDGET.ancestorPathMaxEntries, 200),
    screenshot: null
  };
}

// src/main/browser/browser-grab-screenshot.ts
var HIDE_BROWSER_GRAB_OVERLAY_SCRIPT = `(function(){
  var g = window.__orcaGrab;
  if (g && g.host) g.host.style.display = 'none';
  document.querySelectorAll('[data-orca-browser-annotation-overlay]').forEach(function(el) {
    el.setAttribute('data-orca-previous-display', el.style.display || '');
    el.style.display = 'none';
  });
})()`;
var RESTORE_BROWSER_GRAB_OVERLAY_SCRIPT = `(function(){
  var g = window.__orcaGrab;
  if (g && g.host) g.host.style.display = '';
  document.querySelectorAll('[data-orca-browser-annotation-overlay]').forEach(function(el) {
    el.style.display = el.getAttribute('data-orca-previous-display') || '';
    el.removeAttribute('data-orca-previous-display');
  });
})()`;
async function captureSelectionScreenshot(rect, guest) {
  try {
    const safeN = (n, fallback = 0) => typeof n === "number" && Number.isFinite(n) ? n : fallback;
    const safeRect = {
      x: safeN(rect.x),
      y: safeN(rect.y),
      width: safeN(rect.width),
      height: safeN(rect.height)
    };
    await guest.executeJavaScript(HIDE_BROWSER_GRAB_OVERLAY_SCRIPT).catch(() => {
    });
    let image;
    try {
      image = await guest.capturePage();
    } finally {
      await guest.executeJavaScript(RESTORE_BROWSER_GRAB_OVERLAY_SCRIPT).catch(() => {
      });
    }
    if (image.isEmpty()) {
      return null;
    }
    const bitmapSize = image.getSize();
    const viewportCSSWidth = await guest.executeJavaScript("window.innerWidth");
    if (!viewportCSSWidth || viewportCSSWidth <= 0) {
      return null;
    }
    const scaleFactor = bitmapSize.width / viewportCSSWidth;
    const cropX = Math.max(0, Math.round(safeRect.x * scaleFactor));
    const cropY = Math.max(0, Math.round(safeRect.y * scaleFactor));
    const cropW = Math.min(bitmapSize.width - cropX, Math.round(safeRect.width * scaleFactor));
    const cropH = Math.min(bitmapSize.height - cropY, Math.round(safeRect.height * scaleFactor));
    if (cropW <= 0 || cropH <= 0) {
      return null;
    }
    const cropped = image.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
    const pngBuffer = cropped.toPNG();
    if (pngBuffer.byteLength > GRAB_BUDGET.screenshotMaxBytes) {
      return null;
    }
    const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    return {
      mimeType: "image/png",
      dataUrl,
      width: Math.round(cropW / scaleFactor),
      height: Math.round(cropH / scaleFactor)
    };
  } catch {
    return null;
  }
}

// src/main/browser/browser-manager-viewport.ts
var import_electron8 = require("electron");

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
var import_electron7 = require("electron");

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
var import_electron4 = require("electron");
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
function closeUnpreparedPopup(window2, contentWebContents, originBarWebContents) {
  const closedListeners = [];
  let closed = false;
  window2.once("closed", () => {
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
  if (!window2.isDestroyed()) {
    window2.close();
  }
  return {
    contentWebContents,
    close: () => {
      if (!window2.isDestroyed()) {
        window2.close();
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
  const window2 = new import_electron4.BaseWindow({
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
  const originBarView = new import_electron4.WebContentsView({
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const originBarWebContents = originBarView.webContents;
  const contentView = new import_electron4.WebContentsView({
    // Why: Electron rejects an explicitly undefined webContents; omitting it
    // lets WebContentsView create contents for Cmd/Ctrl-click popups.
    ...options.webContents === void 0 ? {} : { webContents: options.webContents },
    webPreferences: options.webPreferences
  });
  window2.contentView.addChildView(contentView);
  window2.contentView.addChildView(originBarView);
  const layoutViews = () => {
    const bounds = window2.getContentBounds();
    originBarView.setBounds({ x: 0, y: 0, width: bounds.width, height: POPUP_ORIGIN_BAR_HEIGHT });
    contentView.setBounds({
      x: 0,
      y: POPUP_ORIGIN_BAR_HEIGHT,
      width: bounds.width,
      height: Math.max(0, bounds.height - POPUP_ORIGIN_BAR_HEIGHT)
    });
  };
  window2.on("resize", layoutViews);
  window2.on("enter-full-screen", layoutViews);
  window2.on("leave-full-screen", layoutViews);
  layoutViews();
  const contentWebContents = contentView.webContents;
  if (prepareContent && !prepareContent(contentWebContents)) {
    return closeUnpreparedPopup(window2, contentWebContents, originBarWebContents);
  }
  let currentUrl = initialUrl;
  const renderOrigin = () => {
    const { label, insecure } = describePopupOrigin(currentUrl);
    if (!window2.isDestroyed()) {
      window2.setTitle(label);
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
    if (!window2.isDestroyed() && title) {
      window2.setTitle(title);
    }
  };
  contentWebContents.on("page-title-updated", handlePageTitleUpdated);
  if (!options.webContents) {
    void contentWebContents.loadURL(initialUrl).catch(() => {
    });
  }
  const closedListeners = [];
  const handleContentDestroyed = () => {
    if (!window2.isDestroyed()) {
      window2.close();
    }
  };
  contentWebContents.once("destroyed", handleContentDestroyed);
  window2.once("closed", () => {
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
      if (!window2.isDestroyed()) {
        window2.close();
      }
    },
    onClosed: (listener) => {
      closedListeners.push(listener);
    }
  };
}

// src/main/browser/browser-process-user-agent.ts
var import_electron5 = require("electron");

// src/main/browser/browser-identity-mode-store.ts
var import_node_crypto4 = require("node:crypto");
var import_node_fs8 = require("node:fs");
var import_node_path6 = require("node:path");

// src/main/durable-file-write.ts
var import_node_fs6 = require("node:fs");
var import_node_path4 = require("node:path");

// src/main/fs-utils.ts
var import_node_fs5 = require("node:fs");
function renameFileWithWindowsRetry(source, target) {
  runFileOperationWithWindowsRetry(() => (0, import_node_fs5.renameSync)(source, target));
}
function copyFileWithWindowsRetry(source, target) {
  runFileOperationWithWindowsRetry(() => (0, import_node_fs5.copyFileSync)(source, target));
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
    fd = (0, import_node_fs6.openSync)(directory, "r");
    (0, import_node_fs6.fsyncSync)(fd);
  } catch {
  } finally {
    if (fd !== null) {
      try {
        (0, import_node_fs6.closeSync)(fd);
      } catch {
      }
    }
  }
}
function renameDurableSync(tmpPath, finalPath) {
  renameFileWithWindowsRetry(tmpPath, finalPath);
  syncDirectoryDurablySync((0, import_node_path4.dirname)(finalPath));
}
function durableWriteTempPath(finalPath, owner) {
  const ownerSuffix = owner === void 0 ? "" : `.owner-${owner}`;
  return `${finalPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}${ownerSuffix}.tmp`;
}
function writeFileDurableSync(tmpPath, finalPath, payload, mode) {
  let renamed = false;
  try {
    (0, import_node_fs6.writeFileSync)(tmpPath, payload, mode === void 0 ? void 0 : { mode });
    const fd = (0, import_node_fs6.openSync)(tmpPath, "r+");
    try {
      (0, import_node_fs6.fsyncSync)(fd);
    } finally {
      (0, import_node_fs6.closeSync)(fd);
    }
    renameDurableSync(tmpPath, finalPath);
    renamed = true;
  } finally {
    if (!renamed) {
      (0, import_node_fs6.rmSync)(tmpPath, { force: true });
    }
  }
}

// src/main/browser/browser-identity-mode-record.ts
var import_node_fs7 = require("node:fs");
var import_node_path5 = require("node:path");
var BROWSER_IDENTITY_MODE_FILE = "browser-identity-mode.json";
var BROWSER_IDENTITY_MODE_VERSION = 1;
function browserIdentityModeRecordPath(userDataPath) {
  return (0, import_node_path5.join)(userDataPath, BROWSER_IDENTITY_MODE_FILE);
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
    return parseRecord((0, import_node_fs7.readFileSync)(browserIdentityModeRecordPath(userDataPath), "utf-8"));
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
  (0, import_node_fs8.mkdirSync)((0, import_node_path6.dirname)(filePath), { recursive: true });
  writeFileDurableSync(
    durableWriteTempPath(filePath),
    filePath,
    `${JSON.stringify(record, null, 2)}
`
  );
}
function backupUnhealthyRecord(userDataPath) {
  const filePath = browserIdentityModeRecordPath(userDataPath);
  const bytes = (0, import_node_fs8.readFileSync)(filePath);
  const backupPath = `${filePath}.${Date.now()}.${(0, import_node_crypto4.randomUUID)().slice(0, 8)}.bak`;
  if ((0, import_node_fs8.existsSync)(backupPath)) {
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
  const current3 = store.snapshot;
  if (current3.configuredMode === null) {
    if (!options.reset) {
      return {
        ok: false,
        error: {
          code: "browser_identity_reset_required",
          message: current3.state === "future" ? "Browser identity data was written by a newer Orca; update Orca, or reset it explicitly to overwrite it." : `Browser identity data is ${current3.state}; reset it explicitly to overwrite it.`
        },
        identity: current3
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
        identity: current3
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
      identity: current3
    };
  }
  const identity2 = {
    state: "valid",
    appliedMode: current3.appliedMode,
    configuredMode: mode,
    explicitSelection: true,
    migrationNoticePending: false,
    restartRequired: mode !== current3.appliedMode
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
  const current3 = store.snapshot;
  if (current3.explicitSelection === true) {
    return false;
  }
  launchMigrationNoticePending = true;
  migrationNoticeDegraded ||= degraded;
  if (current3.configuredMode === null) {
    return false;
  }
  const record = {
    version: BROWSER_IDENTITY_MODE_VERSION,
    mode: current3.configuredMode,
    explicitSelection: current3.explicitSelection,
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
    appliedMode: current3.appliedMode,
    configuredMode: current3.configuredMode,
    explicitSelection: current3.explicitSelection,
    migrationNoticePending: true,
    restartRequired: current3.restartRequired
  };
  notifySnapshotListeners(store.snapshot);
  return true;
}

// src/main/browser/browser-process-user-agent.ts
var identity = null;
var CHROMIUM_ENGINE_COMMENT = "(KHTML, like Gecko)";
function cleanElectronUserAgent(userAgent) {
  if (!userAgent.includes(CHROMIUM_ENGINE_COMMENT)) {
    return userAgent;
  }
  return userAgent.replace(/\s+Electron\/\S+/, "").replace(/(\)\s+)(?:[^)\s]+\s+)*?(Chrome\/)/, "$1$2");
}
function ensureBrowserProcessUserAgentIdentity(mode) {
  if (!identity) {
    const fallback = import_electron5.app.userAgentFallback;
    identity = Object.freeze({
      mode,
      userAgent: mode === "clean" ? cleanElectronUserAgent(fallback) : fallback
    });
  }
  return identity;
}
function getBrowserProcessUserAgentIdentity() {
  return identity ?? ensureBrowserProcessUserAgentIdentity(
    isBrowserIdentityModeStoreInitialized() ? getBrowserIdentityModeSnapshot().appliedMode : "native"
  );
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

// src/main/browser/browser-grab-session-controller.ts
var GRAB_OP_TIMEOUT_MS = 12e4;
function isGuestCancellationPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object") {
    return false;
  }
  const payload = rawPayload;
  if (payload.__orcaCancelled === true) {
    return true;
  }
  if (payload.message !== "cancelled") {
    return false;
  }
  return !("page" in payload) && !("target" in payload) && !("payload" in payload);
}
function getGuestErrorMessage(err) {
  if (err instanceof Error) {
    return err.message;
  }
  if (err && typeof err === "object") {
    const message = err.message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Selection failed";
}
var BrowserGrabSessionController = class {
  activeGrabOps = /* @__PURE__ */ new Map();
  hasActiveGrabOp(browserTabId) {
    return this.activeGrabOps.has(browserTabId);
  }
  cancelGrabOp(browserTabId, reason) {
    const op = this.activeGrabOps.get(browserTabId);
    if (!op) {
      return;
    }
    op.resolve({ opId: op.opId, kind: "cancelled", reason });
  }
  cancelAll(reason) {
    for (const browserTabId of this.activeGrabOps.keys()) {
      this.cancelGrabOp(browserTabId, reason);
    }
  }
  /**
   * Await a single grab selection on the given tab. Returns a Promise that
   * resolves exactly once when the user clicks, cancels, or an error occurs.
   *
   * Why the click is handled in-guest rather than via main-side interception:
   * Electron's `before-input-event` only fires for keyboard events, not mouse
   * events on guest webContents. The design doc anticipated a main-owned
   * interceptor, but the spike showed this API gap. The fallback (documented
   * in the design doc) is to let the guest overlay's full-viewport hit-catcher
   * consume the click. The overlay calls `stopPropagation()` and
   * `preventDefault()` so the page underneath does not receive the event.
   * This is not a perfect guarantee (capture-phase listeners on window may
   * still fire), but it covers the vast majority of sites.
   */
  awaitGrabSelection(browserTabId, opId, guest) {
    const existing = this.activeGrabOps.get(browserTabId);
    if (existing) {
      existing.skipTeardown = true;
      existing.resolve({ opId: existing.opId, kind: "cancelled", reason: "user" });
    }
    return new Promise((resolve) => {
      const guestWebContentsId = guest.id;
      let settled = false;
      const settleOnce = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        op.cleanup(result.kind === "selected" || result.kind === "context-selected");
        this.activeGrabOps.delete(browserTabId);
        resolve(result);
      };
      const awaitGuestClick = async () => {
        try {
          const rawPayload = await guest.executeJavaScript(buildGuestOverlayScript("awaitClick"));
          if (!rawPayload || typeof rawPayload !== "object") {
            settleOnce({ opId, kind: "cancelled", reason: "user" });
            return;
          }
          if (isGuestCancellationPayload(rawPayload)) {
            settleOnce({ opId, kind: "cancelled", reason: "user" });
            return;
          }
          const isContextMenu = "__orcaContextMenu" in rawPayload && rawPayload.__orcaContextMenu === true;
          const payloadSource = isContextMenu ? rawPayload.payload : rawPayload;
          const payload = clampGrabPayload(payloadSource);
          if (!payload) {
            settleOnce({ opId, kind: "error", reason: "Guest returned invalid payload structure" });
            return;
          }
          settleOnce({
            opId,
            kind: isContextMenu ? "context-selected" : "selected",
            payload
          });
        } catch (err) {
          const message = getGuestErrorMessage(err);
          if (message.includes("cancelled")) {
            settleOnce({ opId, kind: "cancelled", reason: "user" });
          } else {
            settleOnce({ opId, kind: "error", reason: message });
          }
        }
      };
      const handleNavigation = (_event, _url, _isInPlace, isMainFrame) => {
        if (isMainFrame) {
          settleOnce({ opId, kind: "cancelled", reason: "navigation" });
        }
      };
      const handleDestroyed = () => {
        settleOnce({ opId, kind: "cancelled", reason: "evicted" });
      };
      const timeoutId = setTimeout(() => {
        settleOnce({ opId, kind: "cancelled", reason: "timeout" });
      }, GRAB_OP_TIMEOUT_MS);
      if (typeof timeoutId.unref === "function") {
        timeoutId.unref();
      }
      guest.on("did-start-navigation", handleNavigation);
      guest.on("destroyed", handleDestroyed);
      const cleanup = (preserveOverlay) => {
        try {
          guest.off("did-start-navigation", handleNavigation);
          guest.off("destroyed", handleDestroyed);
        } catch {
        }
        if (op.skipTeardown || preserveOverlay) {
          return;
        }
        try {
          if (!guest.isDestroyed()) {
            void guest.executeJavaScript(buildGuestOverlayScript("teardown"));
          }
        } catch {
        }
      };
      const op = {
        opId,
        browserTabId,
        guestWebContentsId,
        resolve: settleOnce,
        cleanup
      };
      this.activeGrabOps.set(browserTabId, op);
      void awaitGuestClick();
    });
  }
};

// src/main/browser/browser-manager-viewport-scroll-state.ts
var import_electron6 = require("electron");
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
    const renderer = import_electron6.webContents.fromId(rendererWebContentsId);
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
  grabSessionController = new BrowserGrabSessionController();
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
    const current3 = latestPending && latestPending.sequence > (state?.confirmed?.sequence ?? -1) ? latestPending : state?.confirmed;
    return current3 && current3.override.userAgent !== "" ? current3.override : void 0;
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
    const handleDidCreateWindow = (window2) => {
      this.attachGuestPolicies(window2.webContents, this.resolvePopupOwnerContext(guest.id));
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
    const guest = import_electron7.webContents.fromId(webContentsId);
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
    this.grabSessionController.cancelAll("evicted");
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
  // The package does not track certificate errors, so no page ever has a failure.
  getBrowserPageCertificateFailure(_browserPageId) {
    return null;
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
var TOUCH_EMULATION_DISABLED = { enabled: false };
var BrowserManagerViewport = class extends BrowserManagerQueries {
  // Why: guests are isolated from the plugin's preload bridge, so main owns the devtools escape hatch after a tab→guest lookup.
  async openDevTools(browserTabId) {
    const webContentsId = this.webContentsIdByTabId.get(browserTabId);
    if (!webContentsId) {
      return false;
    }
    const guest = import_electron8.webContents.fromId(webContentsId);
    if (!guest || guest.isDestroyed()) {
      this.unregisterGuest(browserTabId);
      return false;
    }
    guest.openDevTools({ mode: "detach" });
    return true;
  }
  // Why: emulate viewport via CDP; never detach the debugger here or the agent bridge's per-guest state is cleared.
  async setViewportOverride(browserTabId, override) {
    const expectedWebContentsId = this.webContentsIdByTabId.get(browserTabId);
    if (expectedWebContentsId !== void 0) {
      const previous = this.viewportPresetByTabId.get(browserTabId);
      this.viewportPresetByTabId.set(browserTabId, {
        guestWebContentsId: expectedWebContentsId,
        requested: override,
        applied: previous?.guestWebContentsId === expectedWebContentsId ? previous.applied : null
      });
    }
    this.viewportScrollStateByTabId.delete(browserTabId);
    const prev = this.viewportOpsByTabId.get(browserTabId) ?? Promise.resolve();
    const next = prev.catch(() => {
    }).then(() => this.doSetViewportOverrideImpl(browserTabId, override, expectedWebContentsId));
    this.viewportOpsByTabId.set(browserTabId, next);
    try {
      return await next;
    } finally {
      if (this.viewportOpsByTabId.get(browserTabId) === next) {
        this.viewportOpsByTabId.delete(browserTabId);
      }
    }
  }
  async setAnnotationViewportBridge(browserTabId, options, resolveGuest) {
    const prev = this.annotationViewportBridgeOpsByTabId.get(browserTabId) ?? Promise.resolve();
    const next = prev.catch(() => {
    }).then(() => {
      if (this.annotationViewportBridgeOpsByTabId.get(browserTabId) !== next) {
        return false;
      }
      return this.doSetAnnotationViewportBridgeImpl(options, resolveGuest);
    });
    this.annotationViewportBridgeOpsByTabId.set(browserTabId, next);
    try {
      return await next;
    } finally {
      if (this.annotationViewportBridgeOpsByTabId.get(browserTabId) === next) {
        this.annotationViewportBridgeOpsByTabId.delete(browserTabId);
      }
    }
  }
  // Why the caller resolves the guest: the IPC layer owns the renderer authorization check.
  // Why a resolver and not the guest itself: this op may have waited behind another one, and a
  // cross-process navigation meanwhile swaps the tab's contents without destroying the old one —
  // injecting into the guest the request named would bridge a page nobody is looking at.
  // Why no tab id: with teardown gone this reaches only the guest the resolver hands back, and
  // taking an id it cannot act on would invite the next reader to act on it.
  async doSetAnnotationViewportBridgeImpl(options, resolveGuest) {
    const guest = resolveGuest();
    if (!guest || guest.isDestroyed()) {
      return false;
    }
    try {
      await guest.executeJavaScriptInIsolatedWorld(
        BROWSER_ANNOTATION_VIEWPORT_BRIDGE_WORLD_ID,
        [{ code: buildBrowserAnnotationViewportBridgeScript(options) }],
        false
      );
      return true;
    } catch {
      return false;
    }
  }
  async doSetViewportOverrideImpl(browserTabId, override, expectedWebContentsId) {
    const webContentsId = this.webContentsIdByTabId.get(browserTabId);
    if (!webContentsId || webContentsId !== expectedWebContentsId) {
      return false;
    }
    const guest = import_electron8.webContents.fromId(webContentsId);
    if (!guest || guest.isDestroyed()) {
      this.unregisterGuest(browserTabId);
      return false;
    }
    try {
      if (!guest.debugger.isAttached()) {
        guest.debugger.attach("1.3");
      }
    } catch (err) {
      console.warn("[browser-manager] setViewportOverride: failed to attach debugger", {
        browserTabId,
        webContentsId,
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
    const dbg = guest.debugger;
    const metricsApplied = await this.runViewportEmulationStep(
      browserTabId,
      "device metrics",
      () => override ? sendGuestCdpCommand(guest, "Emulation.setDeviceMetricsOverride", {
        width: override.width,
        height: override.height,
        deviceScaleFactor: override.deviceScaleFactor,
        mobile: override.mobile
      }) : dbg.sendCommand("Emulation.clearDeviceMetricsOverride", {})
    );
    if (metricsApplied) {
      this.recordAppliedViewportOverride(browserTabId, webContentsId, override);
    }
    const touchApplied = await this.runViewportEmulationStep(
      browserTabId,
      "touch emulation",
      () => dbg.sendCommand(
        "Emulation.setTouchEmulationEnabled",
        override?.mobile ? { enabled: true, maxTouchPoints: 5 } : TOUCH_EMULATION_DISABLED
      )
    );
    if (this.webContentsIdByTabId.get(browserTabId) !== webContentsId) {
      return false;
    }
    const identityApplied = await this.runViewportEmulationStep(
      browserTabId,
      "identity",
      () => this.retargetTabIdentity(guest, this.resolveTabNavigationUrl(guest))
    );
    return metricsApplied && touchApplied && identityApplied && this.webContentsIdByTabId.get(browserTabId) === webContentsId;
  }
  async runViewportEmulationStep(browserTabId, step, send) {
    try {
      return await send() !== false;
    } catch (error) {
      console.warn(`[browser-manager] setViewportOverride: ${step} failed`, {
        browserTabId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
};

// src/main/browser/browser-manager-grab.ts
var BrowserManagerGrab = class extends BrowserManagerViewport {
  // --- Browser Context Grab — main-owned operations ---
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
    const guest = import_electron9.webContents.fromId(guestId);
    if (!guest || guest.isDestroyed()) {
      this.unregisterGuest(browserTabId);
      return null;
    }
    return guest;
  }
  /** Returns true if a grab operation is currently active for this tab. */
  hasActiveGrabOp(browserTabId) {
    return this.grabSessionController.hasActiveGrabOp(browserTabId);
  }
  /** Enable/disable grab mode for a tab: on enable inject the overlay runtime, on disable cancel any active grab op. */
  async setGrabMode(browserTabId, enabled, guest) {
    if (!enabled) {
      const hadActiveGrabOp = this.hasActiveGrabOp(browserTabId);
      this.cancelGrabOp(browserTabId, "user");
      if (hadActiveGrabOp) {
        return true;
      }
      try {
        await guest.executeJavaScript(buildGuestOverlayScript("teardown"));
        return true;
      } catch {
        return false;
      }
    }
    try {
      await guest.executeJavaScript(buildGuestOverlayScript("arm"));
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Await a single grab selection on the given tab; resolves once on click, cancel, or error.
   *
   * Why in-guest: before-input-event fires only for keyboard (not mouse) on guests, so the overlay hit-catcher consumes the click.
   */
  awaitGrabSelection(browserTabId, opId, guest) {
    return this.grabSessionController.awaitGrabSelection(browserTabId, opId, guest);
  }
  /** Cancel an active grab operation for the given tab. */
  cancelGrabOp(browserTabId, reason) {
    this.grabSessionController.cancelGrabOp(browserTabId, reason);
  }
  /** Capture a screenshot of the guest surface, optionally cropped to the given CSS-pixel rect. */
  async captureSelectionScreenshot(_browserTabId, rect, guest) {
    return captureSelectionScreenshot(rect, guest);
  }
  /** Extract the hovered element's payload without disrupting the active grab overlay/awaitClick listener. */
  async extractHoverPayload(_browserTabId, guest) {
    try {
      const rawPayload = await guest.executeJavaScript(buildGuestOverlayScript("extractHover"));
      if (!rawPayload || typeof rawPayload !== "object") {
        return null;
      }
      return clampGrabPayload(rawPayload);
    } catch {
      return null;
    }
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
  // Why: forward grab's Cmd/Ctrl+C from a focused guest only when no edit field/selection is active, so native copy still works.
  setupGrabShortcut(browserTabId, guest) {
    const previousCleanup = this.grabShortcutCleanupByTabId.get(browserTabId);
    if (previousCleanup) {
      previousCleanup();
      this.grabShortcutCleanupByTabId.delete(browserTabId);
    }
    this.grabShortcutCleanupByTabId.set(
      browserTabId,
      setupGrabShortcutForwarding({
        browserTabId,
        guest,
        resolveRenderer: (tabId) => resolveRendererWebContents(this.rendererWebContentsIdByTabId, tabId),
        hasActiveGrabOp: (tabId) => this.hasActiveGrabOp(tabId)
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

// src/main/ipc/browser-mcp-ipc.ts
var import_electron10 = require("electron");

// src/shared/browser-ipc-channels.ts
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
var BROWSER_MCP_INVOKE_CHANNELS = [
  "browser:mcpGetEndpoint",
  "browser:mcpGetStatus",
  "browser:mcpRotateToken"
];

// src/main/mcp/browser-mcp-tools.ts
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp.js");
var import_zod = require("zod");
var TAB_SELECTION_RULES = "Tab selection: (1) With browserPageId, only that page is used; if scopeId is also given the page must belong to that scope, otherwise browser_tab_not_found. (2) With only scopeId, that scope's active tab is used (the one the user last switched to, or the one picked with tab_switch), else its first live tab. (3) With neither, the globally last active tab is used, else the first live tab; fill and type instead require exactly one scope with live tabs and return browser_target_ambiguous when several scopes have tabs (pass scopeId). (4) With no tabs at all the call fails with browser_no_tab; tools never open a new tab.";
var targetShape = {
  scopeId: import_zod.z.string().min(1).optional().describe("Workspace scope that owns the tab"),
  browserPageId: import_zod.z.string().min(1).optional().describe("Id of a specific tab (see tabs_list)")
};
function textResult(text) {
  return { content: [{ type: "text", text }] };
}
function jsonResult(value) {
  return textResult(JSON.stringify(value));
}
function errorResult(text) {
  return { isError: true, content: [{ type: "text", text }] };
}
function sanitizeMessage(message) {
  const cleaned = message.replace(/^Command failed:[^\n]*\n?/gm, "").trim();
  return cleaned === "" ? "agent-browser command failed" : cleaned;
}
function toErrorResult(error) {
  if (error instanceof BrowserError) {
    let message2 = sanitizeMessage(error.message);
    if (error.code === "browser_target_ambiguous") {
      message2 = message2.replace(/--worktree\b/g, "scopeId");
    }
    const hint = error.code === "browser_no_tab" ? " Open a tab in the embedded browser first." : "";
    return errorResult(`${error.code}: ${message2}${hint}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return errorResult(`browser_error: ${sanitizeMessage(message)}`);
}
function createBrowserMcpServer(deps) {
  const { bridge, binary } = deps;
  const server = new import_mcp.McpServer({ name: "orca-browser", version: "1.0.0" });
  const missingBinary = () => binary.found ? null : errorResult(
    `agent_browser_missing: agent-browser binary not found. Expected one of: ${binary.expectedPaths.join(", ")}`
  );
  const guarded = (run, needsBinary = true) => async (args) => {
    if (needsBinary) {
      const missing = missingBinary();
      if (missing) {
        return missing;
      }
    }
    try {
      return await run(args);
    } catch (error) {
      return toErrorResult(error);
    }
  };
  const describeTool = (summary) => `${summary} ${TAB_SELECTION_RULES}`;
  server.registerTool(
    "goto",
    {
      description: describeTool("Navigate a tab of the embedded browser to a URL."),
      inputSchema: { url: import_zod.z.string().min(1), ...targetShape }
    },
    guarded(async ({ url, scopeId, browserPageId }) => {
      const normalized = normalizeBrowserNavigationUrl(url);
      if (normalized === null) {
        return errorResult("invalid_argument: unsupported URL");
      }
      if (isFileUrl(normalized)) {
        return errorResult("invalid_argument: local files cannot be opened in the embedded browser");
      }
      return jsonResult(await bridge.goto(url, scopeId, browserPageId));
    })
  );
  server.registerTool(
    "back",
    {
      description: describeTool("Go back in the tab history."),
      inputSchema: targetShape
    },
    guarded(
      async ({ scopeId, browserPageId }) => jsonResult(await bridge.back(scopeId, browserPageId))
    )
  );
  server.registerTool(
    "forward",
    {
      description: describeTool("Go forward in the tab history."),
      inputSchema: targetShape
    },
    guarded(
      async ({ scopeId, browserPageId }) => jsonResult(await bridge.forward(scopeId, browserPageId))
    )
  );
  server.registerTool(
    "reload",
    {
      description: describeTool("Reload the tab."),
      inputSchema: targetShape
    },
    guarded(
      async ({ scopeId, browserPageId }) => jsonResult(await bridge.reload(scopeId, browserPageId))
    )
  );
  server.registerTool(
    "snapshot",
    {
      description: describeTool(
        "Capture an accessibility snapshot of the page. Element refs such as @e1 can be used by click and fill."
      ),
      inputSchema: targetShape
    },
    guarded(async ({ scopeId, browserPageId }) => {
      const result = await bridge.snapshot(scopeId, browserPageId);
      const meta = JSON.stringify({
        browserPageId: result.browserPageId,
        url: result.url,
        title: result.title
      });
      return textResult(`${meta}

${result.snapshot}`);
    })
  );
  server.registerTool(
    "click",
    {
      description: describeTool("Click an element given by an @eN snapshot ref or a CSS selector."),
      inputSchema: { element: import_zod.z.string().min(1), ...targetShape }
    },
    guarded(
      async ({ element, scopeId, browserPageId }) => jsonResult(await bridge.click(element, scopeId, browserPageId))
    )
  );
  server.registerTool(
    "fill",
    {
      description: describeTool(
        "Replace the value of an input element given by an @eN ref or CSS selector. An empty value clears it."
      ),
      inputSchema: { element: import_zod.z.string().min(1), value: import_zod.z.string(), ...targetShape }
    },
    guarded(
      async ({
        element,
        value,
        scopeId,
        browserPageId
      }) => jsonResult(await bridge.fill(element, value, scopeId, browserPageId))
    )
  );
  server.registerTool(
    "type",
    {
      description: describeTool("Type text into the currently focused element."),
      inputSchema: { text: import_zod.z.string().min(1), ...targetShape }
    },
    guarded(
      async ({ text, scopeId, browserPageId }) => jsonResult(await bridge.type(text, scopeId, browserPageId))
    )
  );
  server.registerTool(
    "press",
    {
      description: describeTool("Press a key or key combination such as Enter or Control+a."),
      inputSchema: { key: import_zod.z.string().min(1), ...targetShape }
    },
    guarded(
      async ({ key, scopeId, browserPageId }) => jsonResult(await bridge.keypress(key, scopeId, browserPageId))
    )
  );
  server.registerTool(
    "screenshot",
    {
      description: describeTool("Take a screenshot of the page as an image."),
      inputSchema: { format: import_zod.z.enum(["png", "jpeg"]).optional(), ...targetShape }
    },
    guarded(async ({ format, scopeId, browserPageId }) => {
      const result = await bridge.screenshot(format, scopeId, browserPageId);
      return {
        content: [{ type: "image", data: result.data, mimeType: `image/${result.format}` }]
      };
    })
  );
  server.registerTool(
    "eval",
    {
      description: describeTool(
        "Evaluate a JavaScript expression in the page and return the result."
      ),
      inputSchema: { expression: import_zod.z.string().min(1), ...targetShape }
    },
    guarded(
      async ({ expression, scopeId, browserPageId }) => jsonResult(await bridge.evaluate(expression, scopeId, browserPageId))
    )
  );
  server.registerTool(
    "tabs_list",
    {
      description: "List the open tabs of the embedded browser, optionally limited to one scope. Each tab reports browserPageId, scopeId, index, url, title and whether it is active. " + TAB_SELECTION_RULES,
      inputSchema: { scopeId: targetShape.scopeId }
    },
    guarded(({ scopeId }) => {
      const { tabs } = bridge.tabList(scopeId);
      return jsonResult({
        tabs: tabs.map((tab) => ({
          browserPageId: tab.browserPageId,
          scopeId: deps.getScopeIdForTab(tab.browserPageId),
          index: tab.index,
          url: tab.url,
          title: tab.title,
          active: tab.active
        }))
      });
    }, false)
  );
  server.registerTool(
    "tab_switch",
    {
      description: describeTool(
        "Set the agent's active tab by index or browserPageId (exactly one). This does not change what the user sees."
      ),
      inputSchema: { index: import_zod.z.number().int().min(0).optional(), ...targetShape }
    },
    guarded(async ({ index, scopeId, browserPageId }) => {
      if (index === void 0 && browserPageId === void 0) {
        return errorResult("invalid_arguments: tab_switch requires index or browserPageId");
      }
      if (index !== void 0 && browserPageId !== void 0) {
        return errorResult("invalid_arguments: pass either index or browserPageId, not both");
      }
      return jsonResult(await bridge.tabSwitch(index, scopeId, browserPageId));
    }, false)
  );
  server.registerTool(
    "wait",
    {
      description: describeTool(
        "Wait for a selector, text, URL pattern, load state, JS function or a timeout in milliseconds."
      ),
      inputSchema: {
        selector: import_zod.z.string().optional(),
        text: import_zod.z.string().optional(),
        url: import_zod.z.string().optional(),
        load: import_zod.z.string().optional(),
        fn: import_zod.z.string().optional(),
        state: import_zod.z.string().optional(),
        timeout: import_zod.z.number().int().positive().optional(),
        ...targetShape
      }
    },
    guarded(
      async ({
        selector,
        timeout,
        text,
        url,
        load,
        fn,
        state,
        scopeId,
        browserPageId
      }) => jsonResult(
        await bridge.wait(
          { selector, timeout, text, url, load, fn, state },
          scopeId,
          browserPageId
        )
      )
    )
  );
  return server;
}

// src/main/mcp/mcp-http-server.ts
var import_node_crypto5 = require("node:crypto");
var import_node_http2 = require("node:http");
var import_streamableHttp = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
var MCP_HOST = "127.0.0.1";
var MCP_PATH = "/mcp";
var MCP_MAX_BODY_BYTES = 1048576;
var BodyTooLargeError = class extends Error {
};
function writeJson(res, status2, body, headers = {}) {
  if (res.headersSent) {
    return;
  }
  res.writeHead(status2, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}
function jsonRpcError(code, message) {
  return { jsonrpc: "2.0", error: { code, message }, id: null };
}
function isAuthorized(header, expected) {
  if (!header) {
    return false;
  }
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) {
    return false;
  }
  const provided = Buffer.from(match[1]);
  const wanted = Buffer.from(expected);
  return provided.length === wanted.length && (0, import_node_crypto5.timingSafeEqual)(provided, wanted);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) {
        return;
      }
      size += chunk.length;
      if (size > MCP_MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) {
        reject(new BodyTooLargeError());
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}
var BrowserMcpHttpServer = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  httpServer = null;
  port = null;
  async start() {
    const server = (0, import_node_http2.createServer)((req, res) => {
      void this.handle(req, res);
    });
    await new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      server.once("error", onError);
      server.listen(this.opts.port, MCP_HOST, () => {
        server.off("error", onError);
        resolve();
      });
    });
    this.httpServer = server;
    this.port = server.address().port;
    return this.port;
  }
  async stop() {
    const server = this.httpServer;
    this.httpServer = null;
    this.port = null;
    if (!server) {
      return;
    }
    await new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
  getPort() {
    return this.port;
  }
  getAddress() {
    const address = this.httpServer?.address();
    return address && typeof address === "object" ? address.address : null;
  }
  async handle(req, res) {
    try {
      const pathname = new URL(req.url ?? "/", `http://${MCP_HOST}`).pathname;
      if (pathname !== MCP_PATH) {
        writeJson(res, 404, jsonRpcError(-32e3, "Not found"));
        return;
      }
      if (req.headers.origin !== void 0) {
        writeJson(res, 403, jsonRpcError(-32e3, "Forbidden"));
        return;
      }
      if (!isAuthorized(req.headers.authorization, this.opts.getToken())) {
        writeJson(res, 401, jsonRpcError(-32001, "Unauthorized"), {
          "WWW-Authenticate": 'Bearer realm="orca-browser"'
        });
        return;
      }
      if (req.method !== "POST") {
        writeJson(res, 405, jsonRpcError(-32e3, "Method not allowed"), { Allow: "POST" });
        return;
      }
      const declaredLength = Number(req.headers["content-length"]);
      if (declaredLength > MCP_MAX_BODY_BYTES) {
        req.resume();
        setTimeout(() => req.socket.destroy(), 1e3).unref();
        writeJson(res, 413, jsonRpcError(-32e3, "Payload too large"), { Connection: "close" });
        return;
      }
      let raw;
      try {
        raw = await readBody(req);
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          writeJson(res, 413, jsonRpcError(-32e3, "Payload too large"), { Connection: "close" });
          return;
        }
        throw error;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        writeJson(res, 400, jsonRpcError(-32700, "Parse error"));
        return;
      }
      const mcpServer = this.opts.createMcpServer();
      const transport = new import_streamableHttp.StreamableHTTPServerTransport({
        sessionIdGenerator: void 0,
        enableJsonResponse: true
      });
      res.on("close", () => {
        void transport.close();
        void mcpServer.close();
      });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, parsed);
    } catch {
      writeJson(res, 500, jsonRpcError(-32603, "Internal server error"));
    }
  }
};

// src/main/mcp/mcp-token-store.ts
var import_node_crypto6 = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path7 = require("node:path");
var MCP_TOKEN_RELATIVE_PATH = "orca-browser/mcp-token";
var TOKEN_PATTERN = /^[0-9a-f]{64}$/;
function isValidMcpToken(value) {
  return TOKEN_PATTERN.test(value);
}
function tokenPath(userDataDir) {
  return (0, import_node_path7.join)(userDataDir, ...MCP_TOKEN_RELATIVE_PATH.split("/"));
}
var queue = Promise.resolve();
function serialized(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => void 0);
  return run;
}
function loadOrCreateMcpToken(userDataDir) {
  return serialized(() => loadOrCreate(userDataDir));
}
function writeNewMcpToken(userDataDir) {
  return serialized(() => writeNew(userDataDir));
}
async function loadOrCreate(userDataDir) {
  try {
    const existing = (await (0, import_promises.readFile)(tokenPath(userDataDir), "utf8")).trim();
    if (isValidMcpToken(existing)) {
      return existing;
    }
  } catch {
  }
  return writeNew(userDataDir);
}
async function writeNew(userDataDir) {
  const token = (0, import_node_crypto6.randomBytes)(32).toString("hex");
  const target = tokenPath(userDataDir);
  await (0, import_promises.mkdir)((0, import_node_path7.dirname)(target), { recursive: true, mode: 448 });
  const temp = `${target}.${process.pid}.${(0, import_node_crypto6.randomBytes)(4).toString("hex")}.tmp`;
  await (0, import_promises.writeFile)(temp, token, { mode: 384 });
  await (0, import_promises.rename)(temp, target);
  return token;
}

// src/main/mcp/browser-mcp-runtime.ts
var current2 = null;
var status = { state: "starting", port: DEFAULT_MCP_PORT };
var lifecycle = Promise.resolve();
function serialize(task) {
  const run = lifecycle.then(task, task);
  lifecycle = run.catch(() => void 0);
  return run;
}
function startBrowserMcpRuntime(opts) {
  return serialize(() => startRuntime(opts));
}
function stopBrowserMcpRuntime() {
  return serialize(stopRuntime);
}
async function startRuntime(opts) {
  const { userDataDir, port, logger, tools } = opts;
  await stopRuntime();
  status = { state: "starting", port };
  try {
    const state = {
      userDataDir,
      token: await loadOrCreateMcpToken(userDataDir),
      endpoint: null,
      server: new BrowserMcpHttpServer({
        port,
        // Read through the state object so a rotation applies to the very next request.
        getToken: () => state.token,
        createMcpServer: () => createBrowserMcpServer(tools)
      })
    };
    current2 = state;
    try {
      const actualPort = await state.server.start();
      state.endpoint = { url: `http://${MCP_HOST}:${actualPort}${MCP_PATH}`, token: state.token };
      status = { state: "listening", port: actualPort };
    } catch (error) {
      const code = error.code;
      logger.error("orca-browser MCP server failed to start", { port, code });
      status = code === "EADDRINUSE" ? { state: "port_in_use", port } : {
        state: "error",
        port,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  } catch (error) {
    logger.error("orca-browser MCP server failed to start", {
      port,
      code: error.code
    });
    status = {
      state: "error",
      port,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
async function stopRuntime() {
  const state = current2;
  current2 = null;
  status = { state: "starting", port: status.port };
  if (state) {
    await state.server.stop();
  }
}
function getMcpEndpoint() {
  return current2?.endpoint ? { url: current2.endpoint.url, token: current2.token } : null;
}
function getMcpStatus() {
  return { ...status };
}
async function rotateMcpToken() {
  const state = current2;
  if (!state) {
    throw new Error("orca-browser MCP runtime is not started");
  }
  const token = await writeNewMcpToken(state.userDataDir);
  state.token = token;
  return token;
}

// src/main/ipc/browser-renderer-trust.ts
function isTrustedBrowserRenderer(sender) {
  return !sender.isDestroyed() && sender.getType() === "window" && sender.id === getBrowserHost().getMainWindow()?.webContents.id;
}

// src/main/ipc/browser-mcp-ipc.ts
function assertTrusted(sender) {
  if (!isTrustedBrowserRenderer(sender)) {
    throw new Error("Untrusted renderer");
  }
}
function registerBrowserMcpHandlers() {
  unregisterBrowserMcpHandlers();
  import_electron10.ipcMain.handle(
    "browser:mcpGetEndpoint",
    (event) => isTrustedBrowserRenderer(event.sender) ? getMcpEndpoint() : null
  );
  import_electron10.ipcMain.handle("browser:mcpGetStatus", (event) => {
    assertTrusted(event.sender);
    return getMcpStatus();
  });
  import_electron10.ipcMain.handle("browser:mcpRotateToken", (event) => {
    assertTrusted(event.sender);
    return rotateMcpToken();
  });
}
function unregisterBrowserMcpHandlers() {
  for (const channel of BROWSER_MCP_INVOKE_CHANNELS) {
    import_electron10.ipcMain.removeHandler(channel);
  }
}

// src/main/ipc/browser.ts
var import_electron13 = require("electron");

// src/main/ipc/browser-grab-ipc.ts
var import_electron12 = require("electron");

// src/main/ipc/browser-tab-registration-wait.ts
var import_electron11 = require("electron");
var pendingTabRegistrations = /* @__PURE__ */ new Map();
var pendingScopeTabRegistrations = /* @__PURE__ */ new Map();
var pendingAnyTabRegistrations = /* @__PURE__ */ new Set();
function waitForRegistrationSet(registrationResolvers, timeoutMs, onEmpty) {
  return new Promise((resolve, reject) => {
    const resolveRegistration = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      registrationResolvers.delete(resolveRegistration);
      if (registrationResolvers.size === 0) {
        onEmpty();
      }
      reject(new Error("Tab registration timed out"));
    }, timeoutMs);
    registrationResolvers.add(resolveRegistration);
  });
}
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
  const guest = import_electron11.webContents.fromId(webContentsId);
  return Boolean(guest && !guest.isDestroyed());
}
function waitForNextTabRegistration(browserPageId, timeoutMs) {
  let registrationResolvers = pendingTabRegistrations.get(browserPageId);
  if (!registrationResolvers) {
    registrationResolvers = /* @__PURE__ */ new Set();
    pendingTabRegistrations.set(browserPageId, registrationResolvers);
  }
  return waitForRegistrationSet(registrationResolvers, timeoutMs, () => {
    pendingTabRegistrations.delete(browserPageId);
  });
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

// src/main/ipc/browser-grab-ipc.ts
var grabModeIntentByPageId = /* @__PURE__ */ new Map();
var grabModeOperationByPageId = /* @__PURE__ */ new Map();
var GRAB_REGISTRATION_WAIT_MS = 1e3;
function queueGrabModeOperation(browserPageId, operation) {
  const previous = grabModeOperationByPageId.get(browserPageId) ?? Promise.resolve();
  const result = previous.then(operation);
  const completion = result.then(
    () => {
    },
    () => {
    }
  );
  grabModeOperationByPageId.set(browserPageId, completion);
  return result.finally(() => {
    if (grabModeOperationByPageId.get(browserPageId) === completion) {
      grabModeOperationByPageId.delete(browserPageId);
    }
  });
}
function resetGrabModeState() {
  grabModeIntentByPageId.clear();
  grabModeOperationByPageId.clear();
}
function disposeGrabModeStateForPage(browserPageId) {
  grabModeIntentByPageId.delete(browserPageId);
  grabModeOperationByPageId.delete(browserPageId);
}
function registerBrowserGrabHandlers() {
  import_electron12.ipcMain.removeHandler("browser:setGrabMode");
  import_electron12.ipcMain.removeHandler("browser:awaitGrabSelection");
  import_electron12.ipcMain.removeHandler("browser:cancelGrab");
  import_electron12.ipcMain.removeHandler("browser:captureSelectionScreenshot");
  import_electron12.ipcMain.removeHandler("browser:extractHoverPayload");
  import_electron12.ipcMain.handle(
    "browser:setGrabMode",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return { ok: false, reason: "not-authorized" };
      }
      const intent = {
        generation: (grabModeIntentByPageId.get(args.browserPageId)?.generation ?? 0) + 1,
        enabled: args.enabled
      };
      grabModeIntentByPageId.set(args.browserPageId, intent);
      const isCurrentIntent = () => grabModeIntentByPageId.get(args.browserPageId) === intent;
      let guest = browserManager.getAuthorizedGuest(args.browserPageId, event.sender.id);
      if (!guest && args.enabled) {
        await waitForNextTabRegistration(args.browserPageId, GRAB_REGISTRATION_WAIT_MS).catch(
          () => {
          }
        );
        if (!isCurrentIntent()) {
          return { ok: true };
        }
        guest = browserManager.getAuthorizedGuest(args.browserPageId, event.sender.id);
      }
      if (!guest) {
        if (!args.enabled) {
          return { ok: true };
        }
        return { ok: false, reason: "not-ready" };
      }
      return queueGrabModeOperation(args.browserPageId, async () => {
        if (!isCurrentIntent()) {
          return { ok: true };
        }
        guest = browserManager.getAuthorizedGuest(args.browserPageId, event.sender.id);
        if (!guest) {
          return args.enabled ? { ok: false, reason: "not-ready" } : { ok: true };
        }
        const success = await browserManager.setGrabMode(args.browserPageId, args.enabled, guest);
        if (!isCurrentIntent()) {
          return { ok: true };
        }
        return success ? { ok: true } : { ok: false, reason: "injection-failed" };
      });
    }
  );
  import_electron12.ipcMain.handle(
    "browser:awaitGrabSelection",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return { opId: args.opId, kind: "error", reason: "Not authorized" };
      }
      const guest = browserManager.getAuthorizedGuest(args.browserPageId, event.sender.id);
      if (!guest) {
        return { opId: args.opId, kind: "error", reason: "Guest not ready" };
      }
      return browserManager.awaitGrabSelection(args.browserPageId, args.opId, guest);
    }
  );
  import_electron12.ipcMain.handle("browser:cancelGrab", (event, args) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false;
    }
    const guest = browserManager.getAuthorizedGuest(args.browserPageId, event.sender.id);
    if (!guest) {
      return false;
    }
    browserManager.cancelGrabOp(args.browserPageId, "user");
    return true;
  });
  import_electron12.ipcMain.handle(
    "browser:captureSelectionScreenshot",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return { ok: false, reason: "Not authorized" };
      }
      const guest = browserManager.getAuthorizedGuest(args.browserPageId, event.sender.id);
      if (!guest) {
        return { ok: false, reason: "Guest not ready" };
      }
      const screenshot = await browserManager.captureSelectionScreenshot(
        args.browserPageId,
        args.rect,
        guest
      );
      if (!screenshot) {
        return { ok: false, reason: "Screenshot capture failed" };
      }
      return { ok: true, screenshot };
    }
  );
  import_electron12.ipcMain.handle(
    "browser:extractHoverPayload",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return { ok: false, reason: "Not authorized" };
      }
      const guest = browserManager.getAuthorizedGuest(args.browserPageId, event.sender.id);
      if (!guest) {
        return { ok: false, reason: "Guest not ready" };
      }
      const payload = await browserManager.extractHoverPayload(args.browserPageId, guest);
      if (!payload) {
        return { ok: false, reason: "No element hovered" };
      }
      return { ok: true, payload };
    }
  );
}

// src/main/ipc/browser.ts
var agentBrowserBridgeRef = null;
function setAgentBrowserBridgeRef(bridge) {
  agentBrowserBridgeRef = bridge;
}
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
    const previousWcId = browserManager.getGuestWebContentsId(args.browserPageId);
    const registered = browserManager.registerGuest({
      ...args,
      rendererWebContentsId: event.sender.id
    });
    if (!registered) {
      return false;
    }
    if (agentBrowserBridgeRef && previousWcId !== null && previousWcId !== args.webContentsId) {
      agentBrowserBridgeRef.onProcessSwap(args.browserPageId, args.webContentsId, previousWcId);
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
    const wcId = browserManager.getGuestWebContentsId(args.browserPageId);
    if (wcId !== null && agentBrowserBridgeRef) {
      agentBrowserBridgeRef.onTabClosed(wcId);
    }
    browserManager.unregisterGuest(args.browserPageId);
    disposeGrabModeStateForPage(args.browserPageId);
    return true;
  });
  import_electron13.ipcMain.handle("browser:activeTabChanged", (event, args) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false;
    }
    if (!agentBrowserBridgeRef) {
      return false;
    }
    const wcId = browserManager.getGuestWebContentsId(args.browserPageId);
    if (wcId !== null) {
      agentBrowserBridgeRef.onTabChanged(wcId, browserManager.getScopeIdForTab(args.browserPageId));
    }
    return true;
  });
  return () => {
    for (const channel of BROWSER_HANDLER_CHANNELS) {
      import_electron13.ipcMain.removeHandler(channel);
    }
  };
}

// src/main/mcp/install-agent-automation.ts
var SESSION_CLOSE_TIMEOUT_MS = 5e3;
function resolveBinary(host) {
  try {
    return resolveAgentBrowserBinary({ resourcesPath: host.resourcesPath });
  } catch (error) {
    host.logger.warn("agent-browser binary resolution failed", { error: String(error) });
    return {
      found: false,
      expectedPaths: [(0, import_node_path8.join)(host.resourcesPath, agentBrowserNativeName())]
    };
  }
}
function installAgentAutomation(deps) {
  const { host, mcpPort } = deps;
  const binary = resolveBinary(host);
  const bridge = new AgentBrowserBridge(deps.browserManager, {
    agentBrowserBin: binary.found ? binary.path : binary.expectedPaths[0],
    userDataPath: host.userDataDir
  });
  setAgentBrowserBridgeRef(bridge);
  if (binary.found) {
    void bridge.sweepOrphanedSessions();
  } else {
    host.logger.warn("agent-browser binary not found", { expectedPaths: binary.expectedPaths });
  }
  void startBrowserMcpRuntime({
    userDataDir: host.userDataDir,
    port: mcpPort,
    logger: host.logger,
    tools: {
      bridge,
      getScopeIdForTab: (id) => deps.browserManager.getScopeIdForTab(id),
      binary
    }
  });
  return {
    bridge,
    async dispose() {
      await stopBrowserMcpRuntime();
      setAgentBrowserBridgeRef(null);
      await bridge.destroyAllSessions({ closeTimeoutMs: SESSION_CLOSE_TIMEOUT_MS });
    }
  };
}
var installBrowserAgentAutomation = (options) => {
  const automation = installAgentAutomation({
    host: options.host,
    browserManager,
    mcpPort: options.mcpPort
  });
  try {
    registerBrowserMcpHandlers();
  } catch (error) {
    unregisterBrowserMcpHandlers();
    void automation.dispose().catch(
      (disposeError) => options.host.logger.warn("orca-browser MCP cleanup after a failed install failed", {
        error: String(disposeError)
      })
    );
    throw error;
  }
  return async () => {
    unregisterBrowserMcpHandlers();
    await automation.dispose();
  };
};

// src/main/browser/browser-system-resume-forwarding.ts
var import_electron14 = require("electron");
function installSystemResumeForwarding(getMainWindow) {
  const onResume = () => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send("browser:systemResumed");
  };
  import_electron14.powerMonitor.on("resume", onResume);
  return () => {
    import_electron14.powerMonitor.removeListener("resume", onResume);
  };
}

// src/main/ipc/browser-guest-view-ipc.ts
var import_electron15 = require("electron");
function registerBrowserGuestViewHandlers() {
  import_electron15.ipcMain.removeHandler("browser:openDevTools");
  import_electron15.ipcMain.removeHandler("browser:setViewportOverride");
  import_electron15.ipcMain.removeAllListeners?.("browser:reportViewportScrollState");
  import_electron15.ipcMain.removeHandler("browser:setAnnotationViewportBridge");
  import_electron15.ipcMain.handle("browser:openDevTools", (event, args) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false;
    }
    return browserManager.openDevTools(args.browserPageId);
  });
  import_electron15.ipcMain.handle(
    "browser:setViewportOverride",
    (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return false;
      }
      if (args.override !== null) {
        const { width, height, deviceScaleFactor, mobile } = args.override;
        const isFinitePositive = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
        if (!isFinitePositive(width) || width < 1 || width > 1e4) {
          return false;
        }
        if (!isFinitePositive(height) || height < 1 || height > 1e4) {
          return false;
        }
        if (!isFinitePositive(deviceScaleFactor) || deviceScaleFactor < 0.1 || deviceScaleFactor > 5) {
          return false;
        }
        if (typeof mobile !== "boolean") {
          return false;
        }
      }
      return browserManager.setViewportOverride(args.browserPageId, args.override);
    }
  );
  import_electron15.ipcMain.on?.(
    "browser:reportViewportScrollState",
    (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender) || typeof args?.browserPageId !== "string") {
        return;
      }
      const state = args.state;
      if (!state) {
        return;
      }
      browserManager.setViewportScrollState(args.browserPageId, event.sender.id, {
        scrollLeft: Number(state.scrollLeft),
        scrollTop: Number(state.scrollTop),
        maxScrollLeft: Number(state.maxScrollLeft),
        maxScrollTop: Number(state.maxScrollTop)
      });
    }
  );
  import_electron15.ipcMain.handle(
    "browser:setAnnotationViewportBridge",
    (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return false;
      }
      if (typeof args?.browserPageId !== "string" || typeof args.enabled !== "boolean" || typeof args.emitViewport !== "boolean" || !isValidBrowserAnnotationViewportBridgeMarkers(args.markers) || args.selectionId !== void 0 && (typeof args.selectionId !== "string" || args.selectionId.length > 80) || !isValidBrowserAnnotationViewportBridgeToken(args.token)) {
        return false;
      }
      const resolveGuest = () => browserManager.getAuthorizedGuest(args.browserPageId, event.sender.id);
      if (!resolveGuest()) {
        return false;
      }
      return browserManager.setAnnotationViewportBridge(
        args.browserPageId,
        {
          enabled: args.enabled,
          emitViewport: args.emitViewport,
          markers: args.markers,
          selectionId: args.selectionId,
          token: args.token
        },
        resolveGuest
      );
    }
  );
  return () => {
    import_electron15.ipcMain.removeAllListeners?.("browser:reportViewportScrollState");
    import_electron15.ipcMain.removeHandler("browser:openDevTools");
    import_electron15.ipcMain.removeHandler("browser:setViewportOverride");
    import_electron15.ipcMain.removeHandler("browser:setAnnotationViewportBridge");
  };
}

// src/main/ipc/browser-host-ipc.ts
var import_electron16 = require("electron");
var HOST_CHANNELS = ["browser:openExternal", "browser:writeClipboardText"];
function registerBrowserHostHandlers() {
  for (const channel of HOST_CHANNELS) {
    import_electron16.ipcMain.removeHandler(channel);
  }
  import_electron16.ipcMain.handle(
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
  import_electron16.ipcMain.handle("browser:writeClipboardText", (event, text) => {
    if (!isTrustedBrowserRenderer(event.sender) || typeof text !== "string") {
      return;
    }
    import_electron16.clipboard.writeText(text);
  });
  return () => {
    for (const channel of HOST_CHANNELS) {
      import_electron16.ipcMain.removeHandler(channel);
    }
  };
}

// src/main/window/main-window-webview-security.ts
var import_electron17 = require("electron");

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
  for (const contents of import_electron17.webContents.getAllWebContents()) {
    guard(contents);
  }
  import_electron17.app.on("web-contents-created", onWebContentsCreated);
  return () => {
    import_electron17.app.off("web-contents-created", onWebContentsCreated);
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

// src/main/browser-grab-installer.ts
var import_electron18 = require("electron");
var installBrowserGrab = () => {
  registerBrowserGrabHandlers();
  return () => {
    for (const channel of BROWSER_GRAB_INVOKE_CHANNELS) {
      import_electron18.ipcMain.removeHandler(channel);
    }
    resetGrabModeState();
  };
};

// src/main/browser-profiles-installer.ts
var import_node_path22 = require("node:path");

// src/main/browser/browser-session-registry.ts
var import_electron22 = require("electron");
var import_node_crypto7 = require("node:crypto");
var import_node_path12 = require("node:path");

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
var import_electron19 = require("electron");
var import_node_fs11 = require("node:fs");
var import_node_path11 = require("node:path");

// src/main/browser/browser-session-meta-store.ts
var import_node_fs9 = require("node:fs");
var import_node_path9 = require("node:path");
var BROWSER_SESSION_META_FILE_NAME = "browser-session-meta.json";
function loadBrowserSessionMeta(resolveMetadataPath, defaultPartition) {
  try {
    const raw = (0, import_node_fs9.readFileSync)(resolveMetadataPath(), "utf-8");
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
    (0, import_node_fs9.mkdirSync)((0, import_node_path9.dirname)(resolveMetadataPath()), { recursive: true });
    (0, import_node_fs9.writeFileSync)(tmpPath, JSON.stringify({ ...existing, ...updates }));
    (0, import_node_fs9.renameSync)(tmpPath, resolveMetadataPath());
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
var import_node_sqlite = require("node:sqlite");

// src/main/browser/browser-cookie-import-policy.ts
var import_node_net = require("node:net");
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
var import_node_fs10 = require("node:fs");
var import_node_path10 = require("node:path");
function resolveChromiumCookiesPath(profileDir) {
  const networkPath = (0, import_node_path10.join)(profileDir, "Network", "Cookies");
  if ((0, import_node_fs10.existsSync)(networkPath)) {
    return networkPath;
  }
  const legacyPath = (0, import_node_path10.join)(profileDir, "Cookies");
  return (0, import_node_fs10.existsSync)(legacyPath) ? legacyPath : null;
}

// src/main/browser/browser-session-cookie-staging.ts
function supportsPendingBrowserCookieImportReplay(_partition) {
  return true;
}
function unlinkStagedCookieDb(stagedPath) {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      (0, import_node_fs11.unlinkSync)(stagedPath + suffix);
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
  const partitionDir = (0, import_node_path11.join)(import_electron19.app.getPath("userData"), "Partitions", partitionName);
  return resolveChromiumCookiesPath(partitionDir) ?? (0, import_node_path11.join)(partitionDir, "Cookies");
}
function consumeStagedCookieImport(stagedPath) {
  const consumedPath = `${stagedPath}.consumed`;
  renameFileWithWindowsRetry(stagedPath, consumedPath);
  for (const path of [consumedPath, `${stagedPath}-wal`, `${stagedPath}-shm`]) {
    try {
      (0, import_node_fs11.unlinkSync)(path);
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
      if (!(0, import_node_fs11.existsSync)(stagedPath)) {
        delete remainingEntries[partition];
        continue;
      }
      const liveCookiesPath = partitionCookiesPath(partition);
      try {
        (0, import_node_fs11.mkdirSync)((0, import_node_path11.join)(liveCookiesPath, ".."), { recursive: true });
        const liveCookiesExist = (0, import_node_fs11.existsSync)(liveCookiesPath);
        const markedScopedImage = isScopedStagedCookieImport(stagedPath);
        if (scopedPath && !markedScopedImage) {
          throw new Error("Scoped cookie import is missing its scope marker");
        }
        const copiedScopedImage = !liveCookiesExist && markedScopedImage;
        const appliedScopedImport = liveCookiesExist && markedScopedImage ? applyScopedStagedCookieImport(liveCookiesPath, stagedPath) : false;
        if (!appliedScopedImport) {
          (0, import_node_fs11.copyFileSync)(stagedPath, liveCookiesPath);
          let sidecarCopyFailed = false;
          for (const suffix of ["-wal", "-shm"]) {
            try {
              (0, import_node_fs11.unlinkSync)(liveCookiesPath + suffix);
            } catch {
            }
            const stagingSidecar = stagedPath + suffix;
            if (!(0, import_node_fs11.existsSync)(stagingSidecar)) {
              continue;
            }
            try {
              (0, import_node_fs11.copyFileSync)(stagingSidecar, liveCookiesPath + suffix);
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
  if ((0, import_node_fs11.existsSync)(stagedPath)) {
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
var import_electron21 = require("electron");

// src/main/browser/browser-media-access.ts
var import_electron20 = require("electron");
function requestedMediaTypes(details) {
  return new Set(details?.mediaTypes ?? []);
}
function hasSystemMediaAccess(mediaType) {
  if (process.platform !== "darwin") {
    return true;
  }
  if (mediaType === "audio") {
    return import_electron20.systemPreferences.getMediaAccessStatus("microphone") === "granted";
  }
  if (mediaType === "video") {
    return import_electron20.systemPreferences.getMediaAccessStatus("camera") === "granted";
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
    const granted = await import_electron20.systemPreferences.askForMediaAccess("microphone");
    if (!granted) {
      return false;
    }
  }
  if (mediaTypes.has("video")) {
    const granted = await import_electron20.systemPreferences.askForMediaAccess("camera");
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
  const sess = import_electron21.session.fromPartition(partition);
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
  // Why: reinstalling the plugin in one process reconfigures with the same path; startup hydration
  // runs once per process, so clearing here would drop profiles that were already loaded.
  configure(opts) {
    if (this.userDataDir === opts.userDataDir) {
      return;
    }
    this.userDataDir = opts.userDataDir;
    this.profiles.clear();
    this.resetDefaultProfile();
  }
  /** Folder holding the plugin's own state files, including the identity record. */
  getDataDir() {
    if (!this.userDataDir) {
      throw new Error("Browser session registry is not configured");
    }
    return (0, import_node_path12.join)(this.userDataDir, BROWSER_DATA_DIR_NAME);
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
    return (0, import_node_path12.join)(this.getDataDir(), BROWSER_SESSION_META_FILE_NAME);
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
      const current3 = this.profiles.get("default");
      if (current3 && current3.source === null) {
        this.profiles.set("default", { ...current3, source: meta.defaultSource });
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
    const id = (0, import_node_crypto7.randomUUID)();
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
      await retireFailedBrowserSessionProfile(partition, import_electron22.session.fromPartition(partition));
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
      const sess = import_electron22.session.fromPartition(profile.partition);
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
      const sess = import_electron22.session.fromPartition(this.defaultPartition);
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

// src/main/ipc/browser-plugin-settings-ipc.ts
var import_electron23 = require("electron");

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

// src/main/browser/browser-plugin-settings-store.ts
var import_node_fs12 = require("node:fs");
var import_node_path13 = require("node:path");
function settingsFilePath(userDataDir) {
  return (0, import_node_path13.join)(userDataDir, "orca-browser", "settings.json");
}
function loadBrowserPluginSettings(userDataDir) {
  try {
    return normalizeBrowserPluginSettings(
      JSON.parse((0, import_node_fs12.readFileSync)(settingsFilePath(userDataDir), "utf8"))
    );
  } catch {
    return normalizeBrowserPluginSettings(null);
  }
}
function saveBrowserPluginSettings(userDataDir, patch) {
  const next = normalizeBrowserPluginSettings({
    ...loadBrowserPluginSettings(userDataDir),
    ...patch
  });
  const filePath = settingsFilePath(userDataDir);
  (0, import_node_fs12.mkdirSync)((0, import_node_path13.join)(userDataDir, "orca-browser"), { recursive: true });
  writeFileDurableSync(
    durableWriteTempPath(filePath),
    filePath,
    `${JSON.stringify(next, null, 2)}
`
  );
  return next;
}

// src/main/ipc/browser-plugin-settings-ipc.ts
function registerBrowserPluginSettingsHandlers(userDataDir) {
  import_electron23.ipcMain.removeHandler("browser:settings:get");
  import_electron23.ipcMain.removeHandler("browser:settings:set");
  import_electron23.ipcMain.handle("browser:settings:get", (event) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return normalizeBrowserPluginSettings(null);
    }
    return loadBrowserPluginSettings(userDataDir);
  });
  import_electron23.ipcMain.handle(
    "browser:settings:set",
    (event, patch) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return null;
      }
      return saveBrowserPluginSettings(userDataDir, patch);
    }
  );
}

// src/main/ipc/browser-session-profile-ipc.ts
var import_electron29 = require("electron");

// src/main/browser/browser-cookie-detection.ts
var import_node_fs14 = require("node:fs");
var import_node_path15 = require("node:path");

// src/main/browser/browser-cookie-detection-types.ts
var import_node_fs13 = require("node:fs");
var import_node_path14 = require("node:path");
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
    return (0, import_node_path14.join)(home, "Library", "Application Support", def.macRoot);
  }
  if (process.platform === "win32") {
    if (!def.winRoot) {
      return null;
    }
    const localAppData = process.env.LOCALAPPDATA ?? "";
    if (!localAppData) {
      return null;
    }
    return (0, import_node_path14.join)(localAppData, def.winRoot);
  }
  if (!def.linuxRoot) {
    return null;
  }
  const configHome = process.env.XDG_CONFIG_HOME ?? (0, import_node_path14.join)(process.env.HOME ?? "", ".config");
  return (0, import_node_path14.join)(configHome, def.linuxRoot);
}
function isSafeBrowserProfileDirectory(directory) {
  return directory.length > 0 && directory !== "." && !directory.includes("\0") && !directory.includes("/") && !directory.includes("\\") && !directory.includes("..");
}
function discoverProfiles(browserRoot) {
  try {
    const localStatePath = (0, import_node_path14.join)(browserRoot, "Local State");
    if (!(0, import_node_fs13.existsSync)(localStatePath)) {
      return [{ name: "Default", directory: "Default" }];
    }
    const raw = (0, import_node_fs13.readFileSync)(localStatePath, "utf-8");
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
    return (0, import_node_path14.join)(home2, "Library", "Application Support", "Firefox", "Profiles");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? "";
    return appData ? (0, import_node_path14.join)(appData, "Mozilla", "Firefox", "Profiles") : null;
  }
  const home = process.env.HOME ?? "";
  return (0, import_node_path14.join)(home, ".mozilla", "firefox");
}
function discoverFirefoxProfiles() {
  const profilesRoot = firefoxProfilesRoot();
  if (!profilesRoot) {
    return [];
  }
  try {
    if (!(0, import_node_fs13.existsSync)(profilesRoot)) {
      return [];
    }
    const entries = (0, import_node_fs13.readdirSync)(profilesRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
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
    const cookiesPath = (0, import_node_path14.join)(profilesRoot, profile.directory, "cookies.sqlite");
    if ((0, import_node_fs13.existsSync)(cookiesPath)) {
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
    (0, import_node_path15.join)(home, "Library", "Cookies", "Cookies.binarycookies"),
    (0, import_node_path15.join)(
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
    if ((0, import_node_fs14.existsSync)(candidate)) {
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
      const profileDir = (0, import_node_path15.join)(root, profile.directory);
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
    const cookiesPath2 = (0, import_node_path15.join)(profilesRoot, profileDirectory, "cookies.sqlite");
    if (!(0, import_node_fs14.existsSync)(cookiesPath2)) {
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
  const profileDir = (0, import_node_path15.join)(root, profileDirectory);
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
var import_electron26 = require("electron");

// src/main/browser/browser-cookie-import-clear.ts
var COOKIE_CLEAR_CONCURRENCY = 8;
var mutationLocks = /* @__PURE__ */ new WeakMap();
function cookieClearKey(url, name) {
  return JSON.stringify([url, name]);
}
async function acquireCookieMutationLock(owner) {
  const previous = mutationLocks.get(owner) ?? Promise.resolve();
  let release;
  const current3 = new Promise((resolve) => {
    release = resolve;
  });
  mutationLocks.set(
    owner,
    previous.then(() => current3)
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
var import_electron24 = require("electron");

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
  return import_electron24.webContents.getAllWebContents().find((contents) => !contents.isDestroyed() && contents.session === targetSession);
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
  return new import_electron24.BrowserWindow({
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
  const window2 = openHiddenCookieWindow(targetSession);
  try {
    await window2.loadURL("data:text/html,<!doctype html><title>cookie-clear</title>");
    const contents = window2.webContents;
    if (contents.isDestroyed()) {
      throw new Error("Could not attach to the cookie session for an atomic clear");
    }
    const lease = acquireElectronDebugger(contents);
    return {
      debugger: contents.debugger,
      dispose: () => {
        lease.release();
        window2.destroy();
      }
    };
  } catch (error) {
    window2.destroy();
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
var import_promises2 = require("node:fs/promises");

// src/main/browser/browser-cookie-import-diagnostics.ts
var import_electron25 = require("electron");
var import_node_fs15 = require("node:fs");
var import_node_os = require("node:os");
var import_node_path16 = require("node:path");
var _diagLog = null;
function getDiagLogPath() {
  if (!_diagLog) {
    try {
      _diagLog = (0, import_node_path16.join)(import_electron25.app.getPath("userData"), "orca-browser", "cookie-import-diag.log");
    } catch {
      _diagLog = (0, import_node_path16.join)((0, import_node_os.tmpdir)(), "orca-cookie-import-diag.log");
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
    (0, import_node_fs15.mkdirSync)((0, import_node_path16.dirname)(getDiagLogPath()), { recursive: true });
    (0, import_node_fs15.appendFileSync)(getDiagLogPath(), line);
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
  const targetSession = import_electron26.session.fromPartition(targetPartition);
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
  const result = parentWindow ? await import_electron26.dialog.showOpenDialog(parentWindow, opts) : await import_electron26.dialog.showOpenDialog(opts);
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}
async function importCookiesFromFile(filePath, targetPartition) {
  let rawContent;
  try {
    rawContent = await (0, import_promises2.readFile)(filePath, "utf-8");
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
var import_electron28 = require("electron");
var import_node_fs19 = require("node:fs");

// src/main/browser/browser-cookie-chromium-prepare.ts
var import_electron27 = require("electron");
var import_node_crypto9 = require("node:crypto");
var import_node_fs18 = require("node:fs");
var import_node_sqlite2 = require("node:sqlite");
var import_node_path20 = require("node:path");

// src/main/browser/chromium-cookie-snapshot.ts
var import_node_fs16 = require("node:fs");
var import_node_os2 = require("node:os");
var import_node_path17 = require("node:path");
var SNAPSHOT_ATTEMPTS = 5;
function removeSnapshotDirectory(path) {
  (0, import_node_fs16.rmSync)(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}
function isMissingFileError(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
function readFileState(path) {
  try {
    const stats = (0, import_node_fs16.statSync)(path, { bigint: true });
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
      (0, import_node_fs16.unlinkSync)(databasePath + suffix);
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
  const snapshotDir = (0, import_node_fs16.mkdtempSync)((0, import_node_path17.join)(options.tempRoot ?? (0, import_node_os2.tmpdir)(), "orca-cookie-import-"));
  const databasePath = (0, import_node_path17.join)(snapshotDir, "Cookies");
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
var import_node_crypto8 = require("node:crypto");
var import_node_fs17 = require("node:fs");
var import_node_path19 = require("node:path");

// src/main/process-sync.ts
var import_node_child_process4 = require("node:child_process");
var import_node_path18 = require("node:path");
function runProcessSync(spec) {
  const result = (0, import_node_child_process4.spawnSync)(spec.program, [...spec.args], {
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
  return import_node_path18.win32.join(systemRoot(env), "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
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
        v10: (0, import_node_crypto8.pbkdf2Sync)(raw, PBKDF2_SALT, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, "sha1")
      }
    };
  } catch {
    return null;
  }
}
function getLinuxEncryptionKey(keychainService, keychainAccount) {
  const v10Key = (0, import_node_crypto8.pbkdf2Sync)("peanuts", PBKDF2_SALT, 1, PBKDF2_KEY_LENGTH, "sha1");
  let keyringPassword = "";
  try {
    keyringPassword = runKeychainCommand(
      "secret-tool",
      ["lookup", "service", keychainService, "account", keychainAccount],
      5e3
    );
  } catch {
    try {
      const app7 = keychainAccount.toLowerCase().replaceAll(" ", "");
      keyringPassword = runKeychainCommand("secret-tool", ["lookup", "application", app7], 5e3);
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
  const v11Key = (0, import_node_crypto8.pbkdf2Sync)(keyringPassword, PBKDF2_SALT, 1, PBKDF2_KEY_LENGTH, "sha1");
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
  const localStatePath = (0, import_node_path19.join)(root, "Local State");
  if (!(0, import_node_fs17.existsSync)(localStatePath)) {
    return null;
  }
  try {
    const raw = (0, import_node_fs17.readFileSync)(localStatePath, "utf-8");
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
  const stagingDir = (0, import_node_path20.join)(import_electron27.app.getPath("userData"), "orca-browser", "cookie-import-staging");
  const partitionSegment = partitionName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const stagingCookiesPath = (0, import_node_path20.join)(
    stagingDir,
    `Cookies-${partitionSegment}-${Date.now()}-${(0, import_node_crypto9.randomUUID)()}`
  );
  let stagingAvailable = false;
  if (!supportsPendingBrowserCookieImportReplay(targetPartition)) {
    diag(`  restart fallback unsupported for partition "${targetPartition}" \u2014 not staging cookies`);
  } else {
    try {
      (0, import_node_fs18.mkdirSync)(stagingDir, { recursive: true });
      copyFileWithWindowsRetry(liveCookiesPath, stagingCookiesPath);
      stagingAvailable = true;
    } catch (err) {
      const fsErr = err;
      diag(
        `  staging copy unavailable: code=${fsErr.code ?? "unknown"} errno=${fsErr.errno ?? "unknown"} syscall=${fsErr.syscall ?? "unknown"} path=${liveCookiesPath} destination=${stagingCookiesPath}`
      );
      try {
        (0, import_node_fs18.unlinkSync)(stagingCookiesPath);
      } catch {
      }
    }
  }
  let sourceSnapshot;
  try {
    sourceSnapshot = createChromiumCookieSnapshot(browser.cookiesPath);
  } catch (err) {
    try {
      (0, import_node_fs18.unlinkSync)(stagingCookiesPath);
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
        (0, import_node_fs18.unlinkSync)(stagingCookiesPath + suffix);
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
var import_node_crypto10 = require("node:crypto");
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
  return buf.length >= CHROMIUM_COOKIE_HMAC_LEN && buf.subarray(0, CHROMIUM_COOKIE_HMAC_LEN).equals((0, import_node_crypto10.createHash)("sha256").update(hostKey).digest());
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
    const decipher = (0, import_node_crypto10.createDecipheriv)("aes-128-cbc", key, iv);
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
    const decipher = (0, import_node_crypto10.createDecipheriv)("aes-256-gcm", key, nonce);
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
  if (!(0, import_node_fs19.existsSync)(browser.cookiesPath)) {
    diag(`  cookies DB not found: ${browser.cookiesPath}`);
    return { ok: false, reason: `${browser.label} cookies database not found.` };
  }
  const targetSession = import_electron28.session.fromPartition(targetPartition);
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
var import_node_sqlite3 = require("node:sqlite");
var import_node_fs20 = require("node:fs");
var import_node_os3 = require("node:os");
var import_node_path21 = require("node:path");
async function importCookiesFromFirefox(browser, targetPartition, options) {
  diag(`importCookiesFromFirefox: partition="${targetPartition}"`);
  const tmpDir = (0, import_node_fs20.mkdtempSync)((0, import_node_path21.join)((0, import_node_os3.tmpdir)(), "orca-cookie-import-"));
  const tmpCookiesPath = (0, import_node_path21.join)(tmpDir, "cookies.sqlite");
  try {
    (0, import_node_fs20.copyFileSync)(browser.cookiesPath, tmpCookiesPath);
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = browser.cookiesPath + suffix;
      if ((0, import_node_fs20.existsSync)(sidecar)) {
        try {
          (0, import_node_fs20.copyFileSync)(sidecar, tmpCookiesPath + suffix);
        } catch {
        }
      }
    }
  } catch {
    (0, import_node_fs20.rmSync)(tmpDir, { recursive: true, force: true });
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
      (0, import_node_fs20.rmSync)(tmpDir, { recursive: true, force: true });
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
    (0, import_node_fs20.rmSync)(tmpDir, { recursive: true, force: true });
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
    (0, import_node_fs20.rmSync)(tmpDir, { recursive: true, force: true });
    diag(`  Firefox import failed: ${String(err)}`);
    return {
      ok: false,
      reason: "Could not import cookies from Firefox. Try closing Firefox first."
    };
  }
}

// src/main/browser/browser-cookie-safari-import.ts
var import_node_fs21 = require("node:fs");

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
    data = (0, import_node_fs21.readFileSync)(browser.cookiesPath);
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
  import_electron29.ipcMain.removeHandler("browser:session:listProfiles");
  import_electron29.ipcMain.removeHandler("browser:session:createProfile");
  import_electron29.ipcMain.removeHandler("browser:session:deleteProfile");
  import_electron29.ipcMain.removeHandler("browser:identity:get");
  import_electron29.ipcMain.removeHandler("browser:identity:set");
  import_electron29.ipcMain.removeHandler("browser:session:importCookies");
  import_electron29.ipcMain.removeHandler("browser:session:resolvePartition");
  import_electron29.ipcMain.handle("browser:session:listProfiles", (event) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return [];
    }
    return browserSessionRegistry.listProfiles();
  });
  import_electron29.ipcMain.handle(
    "browser:session:createProfile",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return null;
      }
      return await browserSessionRegistry.createProfile(args.scope, args.label);
    }
  );
  import_electron29.ipcMain.handle("browser:identity:get", (event) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return null;
    }
    return getBrowserIdentityModeStatus();
  });
  import_electron29.ipcMain.handle("browser:identity:set", async (event, mode) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return null;
    }
    if (mode !== "clean" && mode !== "native") {
      throw new Error(`Unsupported browser identity mode: ${String(mode)}`);
    }
    return setBrowserIdentityMode(mode);
  });
  import_electron29.ipcMain.handle(
    "browser:session:deleteProfile",
    async (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return false;
      }
      return browserSessionRegistry.deleteProfile(args.profileId);
    }
  );
  import_electron29.ipcMain.handle(
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
  import_electron29.ipcMain.handle(
    "browser:session:resolvePartition",
    (event, args) => {
      if (!isTrustedBrowserRenderer(event.sender)) {
        return null;
      }
      return browserSessionRegistry.resolvePartition(args.profileId);
    }
  );
  import_electron29.ipcMain.removeHandler("browser:session:clearDefaultCookies");
  import_electron29.ipcMain.handle("browser:session:clearDefaultCookies", async (event) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return false;
    }
    return browserSessionRegistry.clearDefaultSessionCookies();
  });
  import_electron29.ipcMain.removeHandler("browser:session:detectBrowsers");
  import_electron29.ipcMain.removeHandler("browser:session:importFromBrowser");
  import_electron29.ipcMain.handle("browser:session:detectBrowsers", (event) => {
    if (!isTrustedBrowserRenderer(event.sender)) {
      return [];
    }
    return detectedBrowserPickerEntries();
  });
  import_electron29.ipcMain.handle(
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
var import_electron30 = require("electron");
var installBrowserProfiles = (options) => {
  const { userDataDir } = options.host;
  if (!isBrowserIdentityModeStoreInitialized()) {
    initializeBrowserIdentityModeStore((0, import_node_path22.join)(userDataDir, "orca-browser"));
  }
  ensureBrowserProcessUserAgentIdentity(getBrowserIdentityModeSnapshot().appliedMode);
  browserSessionRegistry.configure({ userDataDir });
  initializeBrowserSessionsForApp({ userDataDir });
  const unregisterPartitionSource = registerAllowedBrowserPartitionSource(
    (partition) => browserSessionRegistry.isAllowedPartition(partition)
  );
  registerBrowserSessionProfileHandlers();
  registerBrowserPluginSettingsHandlers(userDataDir);
  return () => {
    for (const channel of BROWSER_PROFILE_INVOKE_CHANNELS) {
      import_electron30.ipcMain.removeHandler(channel);
    }
    unregisterPartitionSource();
  };
};

// src/main/plugin-installers.ts
var pluginInstallers = [
  installBrowserCore,
  installBrowserProfiles,
  installBrowserGrab,
  installBrowserAgentAutomation
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
  getMcpEndpoint,
  getMcpStatus,
  installBrowserPlugin,
  rotateMcpToken
});
