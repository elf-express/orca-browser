// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { isAnnotateChord, isGrabChord } from './browser-annotate-chord'

function chord(init: Partial<Parameters<typeof isAnnotateChord>[0]>) {
  return {
    code: 'KeyN',
    altKey: true,
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
    repeat: false,
    target: document.body,
    nativeEvent: { isComposing: false },
    ...init
  }
}

describe('isAnnotateChord', () => {
  it('matches Alt+Shift+N off macOS and Cmd+Shift+C on macOS', () => {
    expect(isAnnotateChord(chord({}), 'win32')).toBe(true)
    expect(isAnnotateChord(chord({}), 'darwin')).toBe(false)
    expect(isAnnotateChord(chord({ code: 'KeyC', altKey: false, metaKey: true }), 'darwin')).toBe(
      true
    )
  })

  it('does not toggle when the chord is typed in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    expect(isAnnotateChord(chord({ target: input }), 'win32')).toBe(false)
    input.remove()
  })

  it('ignores held repeats and IME composition', () => {
    expect(isAnnotateChord(chord({ repeat: true }), 'linux')).toBe(false)
    expect(isAnnotateChord(chord({ nativeEvent: { isComposing: true } }), 'linux')).toBe(false)
  })
})

describe('isGrabChord', () => {
  const grab = (init: Partial<Parameters<typeof isGrabChord>[0]>) => ({
    code: 'KeyC',
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: true,
    repeat: false,
    target: document.body,
    nativeEvent: { isComposing: false },
    ...init
  })

  it('matches Cmd+C on macOS and Ctrl+C elsewhere', () => {
    expect(isGrabChord(grab({}), 'darwin')).toBe(true)
    expect(isGrabChord(grab({}), 'win32')).toBe(false)
    expect(isGrabChord(grab({ metaKey: false, ctrlKey: true }), 'win32')).toBe(true)
    expect(isGrabChord(grab({ shiftKey: true }), 'darwin')).toBe(false)
  })

  it('leaves Cmd+C to copy in fields and while text is selected', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    expect(isGrabChord(grab({ target: input }), 'darwin')).toBe(false)
    input.remove()

    const text = document.createElement('p')
    text.textContent = 'selected words'
    document.body.appendChild(text)
    const range = document.createRange()
    range.selectNodeContents(text)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    expect(isGrabChord(grab({}), 'darwin')).toBe(false)
    window.getSelection()?.removeAllRanges()
    text.remove()
  })
})
