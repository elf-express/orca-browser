import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ORCA_BROWSER_BLANK_URL } from '../../shared/constants'
import {
  MAX_BROWSER_HISTORY_ENTRIES,
  normalizeBrowserHistoryUrl
} from '../../shared/workspace-session-browser-history'
import type { BrowserHistoryEntry, BrowserPage } from '../../shared/browser-workspace-types'
import { admitBrowserPageMount } from '../components/browser-pane/host-guest/browser-page-mount-admission'
import { destroyPersistentWebview } from '../components/browser-pane/host-guest/webview-registry'

export const BROWSER_HISTORY_STORAGE_KEY = 'orca-browser:history:v1'

type BrowserPageStateUpdates = Partial<
  Pick<BrowserPage, 'title' | 'loading' | 'faviconUrl' | 'canGoBack' | 'canGoForward' | 'loadError'>
>

export interface BrowserStoreState {
  pagesByScope: Record<string, BrowserPage[]>
  activePageIdByScope: Record<string, string | null>
  paneMountByScope: Record<string, { active: boolean }>
  browserUrlHistory: BrowserHistoryEntry[]
  pendingAddressBarFocusByPageId: Record<string, true>

  ensureScopePage: (scopeId: string) => BrowserPage
  createBrowserPage: (scopeId: string, url: string, options?: { activate?: boolean }) => BrowserPage
  closeBrowserPage: (pageId: string) => void
  setActiveBrowserPage: (scopeId: string, pageId: string) => void
  updateBrowserPageState: (pageId: string, updates: BrowserPageStateUpdates) => void
  setBrowserPageUrl: (
    pageId: string,
    url: string,
    options?: { preserveLoadError?: boolean }
  ) => void
  addBrowserHistoryEntry: (url: string, title: string, faviconUrl?: string | null) => void
  clearBrowserHistory: () => void
  requestAddressBarFocus: (pageId: string) => void
  consumeAddressBarFocusRequest: (pageId: string) => boolean
  setPaneMount: (scopeId: string, mount: { active: boolean } | null) => void
}

function isBlankHistoryUrl(url: string): boolean {
  return url === ORCA_BROWSER_BLANK_URL || url === 'about:blank' || url === ''
}

function makePage(scopeId: string, url: string): BrowserPage {
  return {
    id: globalThis.crypto.randomUUID(),
    scopeId,
    url,
    title: url === ORCA_BROWSER_BLANK_URL ? 'New Tab' : url,
    loading: false,
    faviconUrl: null,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
    createdAt: Date.now()
  }
}

export const useBrowserStore = create<BrowserStoreState>()(
  persist(
    (set, get) => {
      const updatePage = (pageId: string, update: (page: BrowserPage) => BrowserPage): void => {
        set((state) => {
          for (const [scopeId, pages] of Object.entries(state.pagesByScope)) {
            const index = pages.findIndex((page) => page.id === pageId)
            if (index === -1) {
              continue
            }
            const nextPages = pages.slice()
            nextPages[index] = update(pages[index])
            return { pagesByScope: { ...state.pagesByScope, [scopeId]: nextPages } }
          }
          return state
        })
      }

      return {
        pagesByScope: {},
        activePageIdByScope: {},
        paneMountByScope: {},
        browserUrlHistory: [],
        pendingAddressBarFocusByPageId: {},

        ensureScopePage: (scopeId) => {
          const existing = get().pagesByScope[scopeId]
          if (existing && existing.length > 0) {
            const activeId = get().activePageIdByScope[scopeId]
            return existing.find((page) => page.id === activeId) ?? existing[0]
          }
          return get().createBrowserPage(scopeId, ORCA_BROWSER_BLANK_URL)
        },

        createBrowserPage: (scopeId, url, options) => {
          const page = makePage(scopeId, url)
          const activate = options?.activate ?? true
          set((state) => ({
            pagesByScope: {
              ...state.pagesByScope,
              [scopeId]: [...(state.pagesByScope[scopeId] ?? []), page]
            },
            activePageIdByScope: {
              ...state.activePageIdByScope,
              [scopeId]:
                activate || state.activePageIdByScope[scopeId] == null
                  ? page.id
                  : state.activePageIdByScope[scopeId]
            }
          }))
          if (!activate) {
            // A background page still needs its guest started so it can load.
            admitBrowserPageMount(page.id)
          }
          return page
        },

        closeBrowserPage: (pageId) => {
          const scopeId = getScopeIdForPage(pageId)
          if (!scopeId) {
            return
          }
          void destroyPersistentWebview(pageId)
          set((state) => {
            const pages = state.pagesByScope[scopeId] ?? []
            const index = pages.findIndex((page) => page.id === pageId)
            const remaining = pages.filter((page) => page.id !== pageId)
            const wasActive = state.activePageIdByScope[scopeId] === pageId
            const nextActive = wasActive
              ? (remaining[index] ?? remaining[index - 1] ?? null)?.id
              : state.activePageIdByScope[scopeId]
            const { [pageId]: _focusRequest, ...pendingFocus } =
              state.pendingAddressBarFocusByPageId
            return {
              pagesByScope: { ...state.pagesByScope, [scopeId]: remaining },
              activePageIdByScope: { ...state.activePageIdByScope, [scopeId]: nextActive ?? null },
              pendingAddressBarFocusByPageId: pendingFocus
            }
          })
        },

        setActiveBrowserPage: (scopeId, pageId) => {
          const pages = get().pagesByScope[scopeId] ?? []
          if (!pages.some((page) => page.id === pageId)) {
            return
          }
          set((state) => ({
            activePageIdByScope: { ...state.activePageIdByScope, [scopeId]: pageId }
          }))
        },

        updateBrowserPageState: (pageId, updates) => {
          updatePage(pageId, (page) => ({ ...page, ...updates }))
        },

        setBrowserPageUrl: (pageId, url, options) => {
          updatePage(pageId, (page) => ({
            ...page,
            url,
            loadError: options?.preserveLoadError ? page.loadError : null
          }))
        },

        addBrowserHistoryEntry: (url, title, faviconUrl) => {
          if (isBlankHistoryUrl(url)) {
            return
          }
          const normalizedUrl = normalizeBrowserHistoryUrl(url)
          set((state) => {
            const existing = state.browserUrlHistory.find(
              (entry) => entry.normalizedUrl === normalizedUrl
            )
            const entry: BrowserHistoryEntry = {
              url,
              normalizedUrl,
              title,
              faviconUrl: faviconUrl ?? existing?.faviconUrl ?? null,
              lastVisitedAt: Date.now(),
              visitCount: (existing?.visitCount ?? 0) + 1
            }
            const others = state.browserUrlHistory.filter(
              (candidate) => candidate.normalizedUrl !== normalizedUrl
            )
            return { browserUrlHistory: [entry, ...others].slice(0, MAX_BROWSER_HISTORY_ENTRIES) }
          })
        },

        clearBrowserHistory: () => set({ browserUrlHistory: [] }),

        requestAddressBarFocus: (pageId) => {
          set((state) => ({
            pendingAddressBarFocusByPageId: {
              ...state.pendingAddressBarFocusByPageId,
              [pageId]: true
            }
          }))
        },

        consumeAddressBarFocusRequest: (pageId) => {
          if (!get().pendingAddressBarFocusByPageId[pageId]) {
            return false
          }
          set((state) => {
            const { [pageId]: _consumed, ...rest } = state.pendingAddressBarFocusByPageId
            return { pendingAddressBarFocusByPageId: rest }
          })
          return true
        },

        setPaneMount: (scopeId, mount) => {
          set((state) => {
            const current = state.paneMountByScope[scopeId]
            if (mount === null) {
              if (!current) {
                return state
              }
              const { [scopeId]: _removed, ...rest } = state.paneMountByScope
              return { paneMountByScope: rest }
            }
            if (current?.active === mount.active) {
              return state
            }
            return { paneMountByScope: { ...state.paneMountByScope, [scopeId]: mount } }
          })
        }
      }
    },
    {
      name: BROWSER_HISTORY_STORAGE_KEY,
      partialize: (state) => ({ browserUrlHistory: state.browserUrlHistory })
    }
  )
)

/** Resolves which scope owns a page, or null when the page is unknown. */
export function getScopeIdForPage(pageId: string): string | null {
  for (const [scopeId, pages] of Object.entries(useBrowserStore.getState().pagesByScope)) {
    if (pages.some((page) => page.id === pageId)) {
      return scopeId
    }
  }
  return null
}
