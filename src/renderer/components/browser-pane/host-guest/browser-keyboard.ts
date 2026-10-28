import {
  matchBrowserShortcut,
  type BrowserShortcutAction
} from '../../../../shared/browser-keybindings'
import { getRendererPlatform } from '../../../lib/platform'

type EditableTargetLike = {
  isContentEditable?: boolean
  closest?: (selector: string) => unknown
}

export function isEditableKeyboardTarget(target: EventTarget | EditableTargetLike | null): boolean {
  const element =
    target && typeof target === 'object' && ('closest' in target || 'isContentEditable' in target)
      ? (target as EditableTargetLike)
      : null
  if (!element) {
    return false
  }

  // Why: Browser panes stay mounted beside editor splits, so their global
  // shortcut listeners must treat editor surfaces as editable too.
  const editableHost = element.closest?.(
    [
      'input',
      'textarea',
      'select',
      '[contenteditable=""]',
      '[contenteditable="true"]',
      '.monaco-editor',
      '.diff-editor',
      '.rich-markdown-editor',
      '.rich-markdown-editor-shell'
    ].join(', ')
  )
  if (editableHost) {
    return true
  }

  return element.isContentEditable === true
}

/** Resolves a DOM keyboard event to one of the browser chrome shortcut actions for this platform. */
export function matchBrowserShortcutEvent(event: KeyboardEvent): BrowserShortcutAction | null {
  return matchBrowserShortcut(
    {
      key: event.key,
      code: event.code,
      control: event.ctrlKey,
      meta: event.metaKey,
      shift: event.shiftKey,
      alt: event.altKey
    },
    getRendererPlatform()
  )
}
