import { isImeOwnedKeyboardEvent } from './ime-composition-keyboard-event'
import { getRendererPlatform } from './platform'

type ScreenSubmitShortcutEvent = {
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  keyCode?: number
  isComposing?: boolean
  nativeEvent?: {
    keyCode?: number
    isComposing?: boolean
  }
}

export function isScreenSubmitShortcut(event: ScreenSubmitShortcutEvent): boolean {
  if (isImeOwnedKeyboardEvent(event)) {
    return false
  }
  if (event.key !== 'Enter' || event.altKey || event.shiftKey) {
    return false
  }
  // Why: screen submit is form-local behavior, so it stays fixed to the
  // platform convention instead of reading user-configurable app keybindings.
  const platform = getRendererPlatform()
  return platform === 'darwin'
    ? Boolean(event.metaKey) && !event.ctrlKey
    : Boolean(event.ctrlKey) && !event.metaKey
}

export function getScreenSubmitModifierLabel(): string {
  return getRendererPlatform() === 'darwin' ? '⌘' : 'Ctrl'
}

export function getScreenSubmitShortcutLabel(): string {
  return getRendererPlatform() === 'darwin' ? '⌘ Enter' : 'Ctrl+Enter'
}
