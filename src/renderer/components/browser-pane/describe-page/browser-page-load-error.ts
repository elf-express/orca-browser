import { useBrowserStore } from '../../../store/browser-store'

export function browserPageExists(tabId: string): boolean {
  return Object.values(useBrowserStore.getState().pagesByScope).some((pages) =>
    pages.some((page) => page.id === tabId)
  )
}
