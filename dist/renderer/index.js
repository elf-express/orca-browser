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

// src/renderer/BrowserPane.tsx
import { jsx } from "react/jsx-runtime";
function BrowserPane(props) {
  useBrowserRendererHost();
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-orca-browser-pane": "",
      "data-scope-id": props.scopeId,
      "data-active": String(props.active),
      className: "relative flex h-full min-h-0 flex-1"
    }
  );
}

// src/renderer/BrowserPluginProvider.tsx
import { useEffect } from "react";

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

// src/renderer/BrowserPluginProvider.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
function BrowserPluginProvider(props) {
  const { host, children } = props;
  setBrowserRendererHost(host);
  useEffect(() => {
    setBrowserRendererHost(host);
    return () => clearBrowserRendererHost(host);
  }, [host]);
  return /* @__PURE__ */ jsx2(BrowserRendererHostContext.Provider, { value: host, children });
}
export {
  BrowserPane,
  BrowserPluginProvider,
  useBrowserRendererHost
};
