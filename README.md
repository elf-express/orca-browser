# @elf-express/orca-browser

這是一個 Electron 外掛，把 [Orca](https://github.com/stablyai/orca)（MIT）的內嵌瀏覽器抽出來，掛進 host app 使用，目前的消費者是 Multica 桌面端。套件分成 main、preload、renderer 三個入口，host 在這三處各接一次。

> 開發中：版本仍是 `0.0.0`，沒有發佈到 npm。下表是目前分支已完成的功能。

| 功能                                                                                                                            | 狀態            |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 瀏覽器窗格：分頁、網址列、上一頁／下一頁、縮放、DevTools                                                                        | ✅（E-458）     |
| Profile 隔離、從 Chromium 系瀏覽器（Chrome、Edge、Brave、Arc 等）／Firefox／Safari 或 JSON 匯入 cookie、Viewport Size、設定面板 | ✅（E-459）     |
| 選取頁面元素、標註、在截圖上畫記，結果送給 agent                                                                                | 進行中（E-460） |
| 本機 agent 透過 MCP 操控瀏覽器                                                                                                  | 未開始（E-461） |

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
- 設定頁可以單獨嵌入 `BrowserSettingsPanel`（搜尋引擎、瀏覽器身分、Profile 與 cookie）。要用的話，也要在有 `window.browserAPI` 的視窗裡。

### 4. 樣式（Tailwind）

套件不輸出 CSS，用的是標準 Tailwind utility 和 shadcn token。在 host 的 CSS 入口加上：

```css
@source "../node_modules/@elf-express/orca-browser/dist/renderer";
```

路徑請依 host 的 CSS 檔位置調整。

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
