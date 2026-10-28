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

// src/main/plugin-installers.ts
var pluginInstallers = [];

// src/shared/constants.ts
var DEFAULT_MCP_PORT = 47821;

// src/main/plugin-options.ts
function resolveBrowserPluginOptions(opts) {
  const mcpPort = opts.mcp?.port ?? DEFAULT_MCP_PORT;
  if (!Number.isInteger(mcpPort) || mcpPort < 1024 || mcpPort > 65535) {
    throw new RangeError("orca-browser: mcp.port must be an integer between 1024 and 65535");
  }
  return { host: opts.host, mcpPort };
}

// src/main/plugin-runtime.ts
var current = null;
function setResolvedBrowserPluginOptions(options) {
  current = options;
}
function isBrowserPluginInstalled() {
  return current !== null;
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
  for (const installer of pluginInstallers) {
    const disposer = installer(options);
    if (disposer) {
      disposers.push(disposer);
    }
  }
  logger.info("orca-browser: installed", { mcpPort: options.mcpPort });
  let disposePromise = null;
  const dispose = async () => {
    for (const disposer of disposers.reverse()) {
      try {
        await disposer();
      } catch (err) {
        logger.error("orca-browser: dispose failed", { error: String(err) });
      }
    }
    setResolvedBrowserPluginOptions(null);
  };
  return { dispose: () => disposePromise ??= dispose() };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  installBrowserPlugin
});
