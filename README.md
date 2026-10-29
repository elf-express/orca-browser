# @elf-express/orca-browser

這是一個 Electron 外掛，把 [Orca](https://github.com/stablyai/orca)（MIT）的內嵌瀏覽器抽出來，掛進 host app 使用，目前的消費者是 Multica 桌面端。套件分成 main、preload、renderer 三個入口，host 在這三處各接一次。

> 開發中：版本仍是 `0.0.0`，沒有發佈到 npm。下表是目前分支已完成的功能。

| 功能                                                                                                                            | 狀態        |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 瀏覽器窗格：分頁、網址列、上一頁／下一頁、縮放、DevTools                                                                        | ✅（E-458） |
| Profile 隔離、從 Chromium 系瀏覽器（Chrome、Edge、Brave、Arc 等）／Firefox／Safari 或 JSON 匯入 cookie、Viewport Size、設定面板 | ✅（E-459） |
| 選取頁面元素、標註、在截圖上畫記，結果送給 agent                                                                                | ✅（E-460） |
| 本機 agent 透過 MCP 操控瀏覽器                                                                                                  | ✅（E-461） |

## 系統需求

- Electron 43 以上（開發與測試用 45）；cookie 匯入用到 Electron 內建 Node 的 `node:sqlite`
- React 19.2、Tailwind CSS 4（由 host 編譯樣式）
- 開發本套件：Node 22.13 以上、pnpm 10

## 安裝

套件沒有發佈到 npm。`dist/` 有進版控，可以直接從 GitHub 安裝，不必自己建置。

```bash
# 穩定版：release 分支
pnpm add github:elf-express/orca-browser#release

# 指定某個 commit（建議正式環境這樣鎖版本）
pnpm add github:elf-express/orca-browser#<commit-sha>

# 本機同時開發套件與 host
pnpm add link:../orca-browser
```

要一起安裝的 peer 依賴（host 通常已經有了）：

```bash
pnpm add react react-dom zustand lucide-react sonner
```

| peer 依賴            | 版本                   |
| -------------------- | ---------------------- |
| `electron`           | `>=43`                 |
| `react`、`react-dom` | `>=19.2`               |
| `zustand`            | `^5.0.0`               |
| `lucide-react`       | `^0.577.0 \|\| ^1.0.0` |
| `sonner`             | `^2.0.7`               |

## 接進 host

### 1. Main process

在 `app.whenReady()` 之後呼叫一次 `installBrowserPlugin`，結束前執行 `dispose()`。

```ts
import { app, shell, BrowserWindow } from 'electron'
import { installBrowserPlugin } from '@elf-express/orca-browser/main'

let mainWindow: BrowserWindow | null = null

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      webviewTag: true // 必要：瀏覽器頁面用 <webview>
    }
  })

  const browser = installBrowserPlugin({
    host: {
      getMainWindow: () => mainWindow, // 必須是掛載 BrowserPluginProvider 的那個視窗
      userDataDir: app.getPath('userData'), // 套件資料寫在 <userDataDir>/orca-browser/
      resourcesPath: process.resourcesPath,
      logger: console, // 需要 debug / info / warn / error
      openExternal: (url) => shell.openExternal(url)
    }
  })

  app.on('before-quit', () => void browser.dispose())
})
```

- 每個行程只能呼叫一次。要重新安裝，先 `await handle.dispose()`。
- IPC 的信任檢查以 `getMainWindow()` 回傳的視窗為準，其他視窗不能掛瀏覽器頁面。
- 不要在 `installBrowserPlugin` 之前打開 `persist:orca-browser` 這個 session，否則冷啟動時 cookie 匯入的重放會失效。

### 2. Preload

```ts
import { exposeBrowserApi } from '@elf-express/orca-browser/preload'

exposeBrowserApi() // 在 renderer 露出 window.browserAPI
```

sandbox preload 只能載入單一檔案，套件必須打包進 preload。用 electron-vite 時，不要把它 externalize：

```ts
// electron.vite.config.ts
preload: {
  plugins: [externalizeDepsPlugin({ exclude: ['@elf-express/orca-browser'] })]
}
```

### 3. Renderer

在元件樹高處掛一個 `BrowserPluginProvider`，要顯示瀏覽器的地方放 `BrowserPane`：

```tsx
import { Toaster } from 'sonner'
import { BrowserPluginProvider, BrowserPane } from '@elf-express/orca-browser/renderer'

export function App() {
  return (
    <BrowserPluginProvider
      host={{
        t: (key, fallback, vars) => i18n.t(key, { defaultValue: fallback, ...vars }),
        onSendToAgent: async (payload) => {
          /* 選用：把 Grab／Annotate／Draw 的結果交給 agent */
        }
      }}
    >
      <Toaster />
      <div style={{ display: 'flex', height: '100%' }}>
        <BrowserPane scopeId="workspace-1" active={isBrowserVisible} />
      </div>
    </BrowserPluginProvider>
  )
}
```

- 整個 app 只掛一個 `BrowserPluginProvider`。它的祖先元素不能有 `transform`、`filter`、`contain`，因為瀏覽器層用的是 `position: fixed` 加 CSS anchor。
- `BrowserPane` 的父層要是有尺寸的 flex 容器。不顯示時傳 `active={false}`，不要用 `display: none` 把祖先藏起來，否則頁面會被重新載入。
- `scopeId` 用來分組分頁，例如每個 workspace 各一組。
- 套件用 sonner 顯示通知，host 要自己掛 `<Toaster />`。
- `onSendToAgent` 可以用 `AbortError`（`error.name === 'AbortError'`）reject，代表使用者取消，套件會靜默保留內容，不顯示錯誤；其他 reject 會顯示「Could not send to agent」。
- 設定頁可以單獨嵌入 `BrowserSettingsPanel`（搜尋引擎、瀏覽器身分、Profile 與 cookie）。要用的話，也要在有 `window.browserAPI` 的視窗裡。

### 4. 樣式（Tailwind）

套件不輸出 CSS，用的是標準 Tailwind utility 和 shadcn token。在 host 的 CSS 入口加上：

```css
@source "../node_modules/@elf-express/orca-browser/dist/renderer";
```

路徑請依 host 的 CSS 檔位置調整。

套件的動畫用到 `animate-in`、`fade-in`、`zoom-in-95` 和 `slide-in-*`，host 還要安裝並引入 `tw-animate-css`（例如 `@import "tw-animate-css";`），否則這些動畫不會生效。

### 5. 文案（i18n）

所有文字都經過 `host.t(key, fallback, vars)`：

- 套件用到的全部 key 列在 `@elf-express/orca-browser/i18n-keys.json`，可以拿來產生翻譯檔。
- key 本身含有 `.`，i18next 要設 `keySeparator: false`，或改用 flat key。
- 變數用 `{{value0}}` 格式內插。
- `t` 沒有對應翻譯時，回傳 `fallback`（英文）即可。

### 6. Vite

zustand 要 dedupe，否則套件和 host 會各載入一份：

```ts
resolve: {
  dedupe: ['react', 'react-dom', 'zustand']
}
```

## MCP

套件在本機開一個 MCP（Model Context Protocol）伺服器，讓 Claude Code 之類的 agent 操控內嵌瀏覽器。`installBrowserPlugin` 之後自動啟動，`dispose()` 時關閉。

### 端點與設定

- 端點：`http://127.0.0.1:47821/mcp`（只綁 127.0.0.1，Streamable HTTP，無狀態）。
- 換埠：`installBrowserPlugin({ host, mcp: { port: 48000 } })`。埠必須是 1024–65535 的整數，否則安裝時丟錯。
- 帶 `Origin` 標頭的請求一律回 403，所以網頁裡的 script 打不到它；CLI 型 agent 不帶 `Origin`，不受影響。
- 每個請求都要帶 `Authorization: Bearer <token>`，缺少或不符回 401。
- 每個分頁另有一個只綁 127.0.0.1 的 CDP proxy 供 agent-browser 連線。它每次啟動都產生隨機路徑密鑰，discovery 與 WebSocket 都必須走 `/<密鑰>/` 開頭的路徑，否則回 404；密鑰經環境變數 `AGENT_BROWSER_CDP` 傳給 agent-browser，不出現在命令列參數。

### Token

- token 是 64 個十六進位字元，存在 `<userDataDir>/orca-browser/mcp-token`（檔案權限 0600）。檔案不存在、空檔或內容不合法時，下次啟動會重新產生。
- 輪替：main 用 `rotateMcpToken()`，renderer 用 `window.browserAPI.mcp.rotateToken()`。兩者都回傳新 token，舊 token 立刻 401。只有在還沒啟動過，或 `dispose()` 之後才 reject；埠被占用時仍會更新 token 檔並回傳新 token。
- `@elf-express/orca-browser/shared` 匯出型別與常數，包括 `BrowserMcpEndpoint`、`BrowserMcpStatus` 與預設埠 `DEFAULT_MCP_PORT`。
- 讀取目前的端點與 token：main 用 `getMcpEndpoint()`，renderer 用 `window.browserAPI.mcp.getEndpoint()`，回 `{ url, token }`；還沒開始監聽時回 `null`。

```ts
import { getMcpEndpoint, getMcpStatus, rotateMcpToken } from '@elf-express/orca-browser/main'

const endpoint = getMcpEndpoint() // { url: 'http://127.0.0.1:47821/mcp', token: '…' } 或 null
const status = getMcpStatus() // { state, port, message? }
const newToken = await rotateMcpToken()
```

### 狀態

`getMcpStatus()`（renderer：`window.browserAPI.mcp.getStatus()`）回 `{ state, port, message? }`：

| state         | 意義                                            |
| ------------- | ----------------------------------------------- |
| `starting`    | 尚未啟動、正在監聽，或已停止；`port` 是設定的埠 |
| `listening`   | 監聽中；`port` 是實際埠                         |
| `port_in_use` | 埠被占用（`EADDRINUSE`）                        |
| `error`       | 其他監聽錯誤；`message` 是錯誤訊息              |

埠被占用時，套件不換埠、不重試，只記一筆 error log；插件照常安裝，`getMcpEndpoint()` 回 `null`。`rotateMcpToken()` 在這種情況下仍會更新 token 檔並回傳新 token。

### Claude Code 範例

```bash
claude mcp add --transport http orca-browser http://127.0.0.1:47821/mcp --header "Authorization: Bearer <token>"
```

`<token>` 取自 `getMcpEndpoint()` 或 `<userDataDir>/orca-browser/mcp-token`。輪替 token 後要重新設定。

### Tool 一覽

共 14 個。除 `tabs_list` 外，每個 tool 都另外接受選填的 `scopeId`（字串，工作區 scope）與 `browserPageId`（字串，分頁 id，可由 `tabs_list` 取得）；`tabs_list` 只接受 `scopeId`。

| tool         | 專屬輸入                                                                            | 說明                                                                    |
| ------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `goto`       | `url`                                                                               | 導向網址                                                                |
| `back`       | —                                                                                   | 上一頁                                                                  |
| `forward`    | —                                                                                   | 下一頁                                                                  |
| `reload`     | —                                                                                   | 重新載入                                                                |
| `snapshot`   | —                                                                                   | 無障礙樹快照，元素帶 `@e1` 這類 ref                                     |
| `click`      | `element`（`@eN` ref 或 CSS selector）                                              | 點擊                                                                    |
| `fill`       | `element`、`value`（可為空字串，代表清空）                                          | 取代輸入框的值                                                          |
| `type`       | `text`                                                                              | 對目前焦點元素打字                                                      |
| `press`      | `key`（如 `Enter`、`Control+a`）                                                    | 按鍵或組合鍵                                                            |
| `screenshot` | `format`（`png` 或 `jpeg`，選填）                                                   | 回傳圖片                                                                |
| `eval`       | `expression`                                                                        | 在頁面執行 JavaScript 運算式                                            |
| `tabs_list`  | —（只有 `scopeId`）                                                                 | 列出分頁：`browserPageId`、`scopeId`、`index`、`url`、`title`、`active` |
| `tab_switch` | `index`（整數，0 起算）                                                             | 切換 agent 的作用中分頁                                                 |
| `wait`       | `selector`、`text`、`url`、`load`、`fn`、`state`（字串）、`timeout`（正整數，毫秒） | 等待條件或逾時                                                          |

`snapshot` 的輸出第一行是 `{"browserPageId":…,"url":…,"title":…}`，空一行後接快照內容。

### 分頁選擇規則

1. 有 `browserPageId`：只操作該頁；同時給 `scopeId` 時，該頁必須屬於這個 scope，否則回 `browser_tab_not_found`。
2. 只有 `scopeId`：用該 scope 的作用中分頁（使用者最後切到的，或 `tab_switch` 指定的），沒有則用該 scope 第一個存活分頁。
3. 兩者都沒有：用全域最後作用中的分頁，沒有則用第一個存活分頁。`fill` 與 `type` 例外：只有一個 scope 有存活分頁時才用它，多個 scope 都有分頁時回 `browser_target_ambiguous`，要帶 `scopeId`。
4. 完全沒有分頁：回 `browser_no_tab`。tool 不會自己開新分頁。
5. `tab_switch` 只改 agent 的作用中分頁，不改變使用者看到的畫面；`index` 與 `browserPageId` 必須恰好給一個。

### 錯誤

出錯時 tool 回 `isError: true`，文字格式是 `<code>: <message>`：

| code                       | 何時出現                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `browser_no_tab`           | 沒有可用分頁（訊息尾端會提示先在內嵌瀏覽器開一個分頁）                              |
| `browser_target_ambiguous` | `fill`／`type` 沒帶 `scopeId`，而多個 scope 都有分頁                                |
| `browser_tab_not_found`    | 指定的 `browserPageId` 不存在、已關閉，或不屬於指定的 scope                         |
| `agent_browser_missing`    | 找不到 agent-browser 二進位；訊息列出找過的路徑。`tabs_list`、`tab_switch` 不受影響 |
| `invalid_arguments`        | `tab_switch` 沒給或同時給了 `index` 與 `browserPageId`                              |
| `invalid_argument`         | `goto` 的網址不支援，或指向本機檔案（`file:`、磁碟路徑、UNC 路徑）                  |
| `browser_error`            | 非 `BrowserError` 的例外                                                            |

其他 `BrowserError` 的 code（例如 `browser_tab_closed`）原樣回傳；只有非 `BrowserError` 的例外才會變成 `browser_error`。注意 `invalid_arguments`（`tab_switch`）與 `invalid_argument`（`goto`）是兩個不同的 code。

### agent-browser 二進位

多數 tool 透過 [agent-browser](https://github.com/vercel-labs/agent-browser) 執行，套件依序找：

1. `<resourcesPath>/agent-browser-<platform>-<arch>[.exe]`（`resourcesPath` 是 `installBrowserPlugin` 的 `host.resourcesPath`，Windows 才有 `.exe`）；
2. 套件依賴 `agent-browser` 的 `node_modules/agent-browser/bin/`，檔名相同。

host 打包發佈版時要把對應平台的二進位放進 `resourcesPath`（例如 electron-builder 的 `extraResources`），並一起附上 agent-browser 的 LICENSE。agent-browser 的授權是 Apache-2.0，見 [NOTICE](NOTICE)。上游沒有 `win32-arm64` 的二進位，Windows ARM 上這些 tool 會回 `agent_browser_missing`。

## 資料存放位置

| 資料                                   | 位置                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| Profile 清單、瀏覽器身分模式、外掛設定 | `<userDataDir>/orca-browser/`                              |
| 各 Profile 的 cookie 與快取            | Electron 的 `Partitions/persist:orca-browser*`             |
| 瀏覽歷史                               | renderer 的 localStorage，key 為 `orca-browser:history:v1` |

## 開發

```bash
pnpm install
pnpm verify   # lint、typecheck、單元測試、建置、dist 測試，並檢查 dist 與原始碼一致
```

`dist/` 有進版控。改了 `src/` 之後要跑 `pnpm build`，把 `dist/` 一起 commit。分支規則見 [BRANCHING.md](BRANCHING.md)，開發約定見 [AGENTS.md](AGENTS.md)。

## 授權

MIT，見 [LICENSE](LICENSE)；Orca 的版權聲明與第三方授權見 [NOTICE](NOTICE)。
