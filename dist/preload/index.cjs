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

// src/preload/index.ts
var preload_exports = {};
__export(preload_exports, {
  exposeBrowserApi: () => exposeBrowserApi
});
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");

// src/shared/constants.ts
var BROWSER_API_GLOBAL_KEY = "browserAPI";

// src/preload/browser-api.ts
function createBrowserApi() {
  return { apiVersion: 1 };
}

// src/preload/index.ts
function exposeBrowserApi() {
  if (process.contextIsolated) {
    import_electron.contextBridge.exposeInMainWorld(BROWSER_API_GLOBAL_KEY, createBrowserApi());
  } else {
    ;
    globalThis[BROWSER_API_GLOBAL_KEY] = createBrowserApi();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  exposeBrowserApi
});
