# AGENTS.md

`@elf-express/orca-browser`：Orca 內嵌瀏覽器抽出的 Electron 外掛，由 Multica 桌面應用消費。本檔只記決策。

## 目錄分工

* `src/main`：Electron main（CJS）。新功能一律經 `src/main/plugin-installers.ts` 掛載，不改 `installBrowserPlugin` 本體。
* `src/preload`：CJS，由 host preload 打包；以 `createBrowserApi()` 組裝 `window.browserAPI`。
* `src/renderer`：React ESM；不編譯 CSS，Tailwind 只用標準 utility 與 shadcn token（由 host 掃描）。
* `src/shared`：型別與常數（ESM＋CJS）。

## 常用指令

`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm test:dist`、`pnpm check:dist`、`pnpm verify`。

## 從 Orca 移植

* 複製的檔案保留原檔名與相對目錄，原內容只在 host 接點改寫。
* 固定改寫：`worktreeId` → `scopeId`；`window.api.browser` → `window.browserAPI`；`@/i18n` 的 `translate` → `src/renderer/i18n.ts` 的 `translate`；`@/` 匯入改相對路徑。
* 移植的 Orca 測試若寫 `// @vitest-environment happy-dom`，保留該行。
* 不 import 任何 `@multica/*`。

## 提交與分支

* commit 訊息 `feat(E-<n>): ...`，英文；程式註解英文。
* 分支流程見 [BRANCHING.md](BRANCHING.md)。
* `dist/` 進版控：改原始碼的 commit 一併提交 `pnpm build` 產出的 `dist`。
