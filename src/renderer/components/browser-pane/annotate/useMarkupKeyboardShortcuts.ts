import { useEffect } from 'react'

export type PendingText = { x: number; y: number; initial: string }

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export type MarkupKeyboardParams = {
  pendingText: PendingText | null
  setPendingText: (value: PendingText | null) => void
  undo: () => void
  redo: () => void
  onCancel: () => void
}

// Window-level shortcuts, registered only while the markup overlay is mounted (markup active):
// Escape (close the open text box, else exit markup) and platform-correct undo/redo.
export function useMarkupKeyboardShortcuts(params: MarkupKeyboardParams): void {
  const { pendingText, setPendingText, undo, redo, onCancel } = params
  useEffect(() => {
    const isMac = navigator.userAgent.includes('Mac')
    const onKeyDown = (event: KeyboardEvent) => {
      // Keys typed into any editable element (the host's own inputs included) are never ours;
      // the markup text box stops its own key events from reaching this listener.
      if (isTypingTarget(event.target)) {
        return
      }
      if (event.key === 'Escape') {
        if (pendingText) {
          setPendingText(null)
        } else {
          onCancel()
        }
        return
      }
      const mod = isMac ? event.metaKey : event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pendingText, setPendingText, undo, redo, onCancel])
}
