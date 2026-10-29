import type { RendererPlatform } from '../../../lib/platform'
import { isEditableKeyboardTarget } from '../host-guest/browser-keyboard'

export type AnnotateChordEvent = {
  code: string
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  repeat: boolean
  target: EventTarget | null
  nativeEvent: { isComposing: boolean }
}

/** The Annotate chord: Cmd+Shift+C on macOS, Alt+Shift+N elsewhere; never while typing in a field. */
export function isAnnotateChord(event: AnnotateChordEvent, platform: RendererPlatform): boolean {
  if (event.repeat || event.nativeEvent.isComposing || isEditableKeyboardTarget(event.target)) {
    return false
  }
  if (platform === 'darwin') {
    return (
      event.metaKey && event.shiftKey && !event.altKey && !event.ctrlKey && event.code === 'KeyC'
    )
  }
  return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyN'
}

/**
 * The Grab chord: Cmd+C on macOS, Ctrl+C elsewhere. Native copy keeps priority inside fields and
 * while text is selected.
 */
export function isGrabChord(event: AnnotateChordEvent, platform: RendererPlatform): boolean {
  if (event.repeat || event.nativeEvent.isComposing || isEditableKeyboardTarget(event.target)) {
    return false
  }
  if (event.code !== 'KeyC' || event.shiftKey || event.altKey) {
    return false
  }
  if (window.getSelection()?.isCollapsed === false) {
    return false
  }
  return platform === 'darwin' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
}
