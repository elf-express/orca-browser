// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { isAnnotateChord } from './browser-annotate-chord'

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
