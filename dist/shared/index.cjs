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
  BROWSER_API_GLOBAL_KEY: () => BROWSER_API_GLOBAL_KEY,
  DEFAULT_MCP_PORT: () => DEFAULT_MCP_PORT,
  PACKAGE_LOG_PREFIX: () => PACKAGE_LOG_PREFIX
});
module.exports = __toCommonJS(shared_exports);

// src/shared/constants.ts
var DEFAULT_MCP_PORT = 47821;
var BROWSER_API_GLOBAL_KEY = "browserAPI";
var PACKAGE_LOG_PREFIX = "orca-browser:";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BROWSER_API_GLOBAL_KEY,
  DEFAULT_MCP_PORT,
  PACKAGE_LOG_PREFIX
});
