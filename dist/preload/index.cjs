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
var import_electron5 = require("electron");

// src/shared/constants.ts
var BROWSER_API_GLOBAL_KEY = "browserAPI";

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

// src/preload/browser-api.ts
var import_electron4 = require("electron");

// src/preload/api/browser-bridge-guest-registration-and-downloads.ts
var import_electron = require("electron");
var browserGuestRegistrationApi = {
  registerGuest: (args) => import_electron.ipcRenderer.invoke("browser:registerGuest", args),
  isGuestRegistered: (args) => import_electron.ipcRenderer.invoke("browser:isGuestRegistered", args),
  repairGuestRegistration: (args) => import_electron.ipcRenderer.invoke("browser:repairGuestRegistration", args),
  unregisterGuest: (args) => import_electron.ipcRenderer.invoke("browser:unregisterGuest", args),
  openDevTools: (args) => import_electron.ipcRenderer.invoke("browser:openDevTools", args),
  onGuestLoadFailed: (callback) => {
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("browser:guest-load-failed", listener);
    return () => import_electron.ipcRenderer.removeListener("browser:guest-load-failed", listener);
  },
  onPermissionDenied: (callback) => {
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("browser:permission-denied", listener);
    return () => import_electron.ipcRenderer.removeListener("browser:permission-denied", listener);
  },
  onPopup: (callback) => {
    const listener = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("browser:popup", listener);
    return () => import_electron.ipcRenderer.removeListener("browser:popup", listener);
  }
};

// src/preload/api/browser-bridge-page-interaction-and-sessions.ts
var import_electron2 = require("electron");
var browserPageInteractionApi = {
  onContextMenuRequested: (callback) => {
    const listener = (_event, data) => callback(data);
    import_electron2.ipcRenderer.on("browser:context-menu-requested", listener);
    return () => import_electron2.ipcRenderer.removeListener("browser:context-menu-requested", listener);
  },
  onContextMenuDismissed: (callback) => {
    const listener = (_event, data) => callback(data);
    import_electron2.ipcRenderer.on("browser:context-menu-dismissed", listener);
    return () => import_electron2.ipcRenderer.removeListener("browser:context-menu-dismissed", listener);
  },
  onOpenLinkInOrcaTab: (callback) => {
    const listener = (_event, data) => callback(data);
    import_electron2.ipcRenderer.on("browser:open-link-in-orca-tab", listener);
    return () => import_electron2.ipcRenderer.removeListener("browser:open-link-in-orca-tab", listener);
  },
  notifyActiveTabChanged: (args) => import_electron2.ipcRenderer.invoke("browser:activeTabChanged", args),
  openExternal: (args) => import_electron2.ipcRenderer.invoke("browser:openExternal", args),
  writeClipboardText: (text) => import_electron2.ipcRenderer.invoke("browser:writeClipboardText", text)
};

// src/preload/api/ui-bridge-tab-and-browser-commands.ts
var import_electron3 = require("electron");
var browserUiCommandApi = {
  onFocusAddressBar: (callback) => {
    const listener = (_event, target) => callback(target);
    import_electron3.ipcRenderer.on("browser:focusAddressBar", listener);
    return () => import_electron3.ipcRenderer.removeListener("browser:focusAddressBar", listener);
  },
  onReloadPage: (callback) => {
    const listener = (_event, target) => callback(target);
    import_electron3.ipcRenderer.on("browser:reloadPage", listener);
    return () => import_electron3.ipcRenderer.removeListener("browser:reloadPage", listener);
  },
  onHardReloadPage: (callback) => {
    const listener = (_event, target) => callback(target);
    import_electron3.ipcRenderer.on("browser:hardReloadPage", listener);
    return () => import_electron3.ipcRenderer.removeListener("browser:hardReloadPage", listener);
  },
  onHistoryNavigate: (callback) => {
    const listener = (_event, command) => callback(command);
    import_electron3.ipcRenderer.on("browser:historyNavigate", listener);
    return () => import_electron3.ipcRenderer.removeListener("browser:historyNavigate", listener);
  },
  onZoomPage: (callback) => {
    const listener = (_event, command) => callback(command);
    import_electron3.ipcRenderer.on("browser:zoomPage", listener);
    return () => import_electron3.ipcRenderer.removeListener("browser:zoomPage", listener);
  },
  onSystemResumed: (callback) => {
    const listener = () => callback();
    import_electron3.ipcRenderer.on("browser:systemResumed", listener);
    return () => import_electron3.ipcRenderer.removeListener("browser:systemResumed", listener);
  }
};

// src/preload/browser-find-subscriptions.ts
function createBrowserFindSubscriptions() {
  const callbacksByPage = /* @__PURE__ */ new Map();
  return {
    subscribedPageCount: () => callbacksByPage.size,
    dispatch: (target) => {
      const findTarget = asBrowserFindTarget(target);
      if (!findTarget) {
        return;
      }
      const callbacksByWorkspace = callbacksByPage.get(findTarget.browserPageId);
      if (!callbacksByWorkspace) {
        return;
      }
      const scoped = findTarget.browserWorkspaceId === void 0 ? [...callbacksByWorkspace.values()] : [callbacksByWorkspace.get(findTarget.browserWorkspaceId)];
      for (const callbacks of scoped) {
        for (const callback of callbacks ?? []) {
          callback();
        }
      }
    },
    subscribe: (source, callback) => {
      let callbacksByWorkspace = callbacksByPage.get(source.browserPageId);
      if (!callbacksByWorkspace) {
        callbacksByWorkspace = /* @__PURE__ */ new Map();
        callbacksByPage.set(source.browserPageId, callbacksByWorkspace);
      }
      let callbacks = callbacksByWorkspace.get(source.browserWorkspaceId);
      if (!callbacks) {
        callbacks = /* @__PURE__ */ new Set();
        callbacksByWorkspace.set(source.browserWorkspaceId, callbacks);
      }
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
        if (callbacks.size > 0) {
          return;
        }
        callbacksByWorkspace.delete(source.browserWorkspaceId);
        if (callbacksByWorkspace.size === 0) {
          callbacksByPage.delete(source.browserPageId);
        }
      };
    }
  };
}

// src/preload/browser-api.ts
var browserFindSubscriptions = createBrowserFindSubscriptions();
import_electron4.ipcRenderer.on(
  "browser:findInPage",
  (_event, target) => browserFindSubscriptions.dispatch(target)
);
function createBrowserApi() {
  return {
    apiVersion: 1,
    ...browserGuestRegistrationApi,
    ...browserPageInteractionApi,
    ...browserUiCommandApi,
    onFindInPage: browserFindSubscriptions.subscribe
  };
}

// src/preload/index.ts
function exposeBrowserApi() {
  if (process.contextIsolated) {
    import_electron5.contextBridge.exposeInMainWorld(BROWSER_API_GLOBAL_KEY, createBrowserApi());
  } else {
    ;
    globalThis[BROWSER_API_GLOBAL_KEY] = createBrowserApi();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  exposeBrowserApi
});
