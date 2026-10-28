import { describe, expect, it } from 'vitest'
import { matchesGrabElementChord } from './browser-guest-grab-shortcuts'

const base = { key: 'c', code: 'KeyC', meta: false, control: false, alt: false, shift: false }

describe('matchesGrabElementChord', () => {
  it('matches Cmd+C on darwin', () => {
    expect(matchesGrabElementChord({ ...base, meta: true }, 'darwin')).toBe(true)
  })

  it('does not match Cmd+C on win32', () => {
    expect(matchesGrabElementChord({ ...base, meta: true }, 'win32')).toBe(false)
  })

  it('does not match Ctrl+C on darwin', () => {
    expect(matchesGrabElementChord({ ...base, control: true }, 'darwin')).toBe(false)
  })

  it('matches Ctrl+C on win32 and linux', () => {
    expect(matchesGrabElementChord({ ...base, control: true }, 'win32')).toBe(true)
    expect(matchesGrabElementChord({ ...base, control: true }, 'linux')).toBe(true)
  })

  it('rejects the chord when shift or alt is held', () => {
    expect(matchesGrabElementChord({ ...base, control: true, shift: true }, 'win32')).toBe(false)
    expect(matchesGrabElementChord({ ...base, control: true, alt: true }, 'linux')).toBe(false)
  })

  it('matches by physical key code on a non-Latin layout', () => {
    expect(
      matchesGrabElementChord({ ...base, key: 'с', code: 'KeyC', control: true }, 'win32')
    ).toBe(true)
  })

  it('does not match a Latin key typed at the physical C position (Dvorak Ctrl+J)', () => {
    expect(
      matchesGrabElementChord({ ...base, key: 'j', code: 'KeyC', control: true }, 'win32')
    ).toBe(false)
  })

  it('rejects other keys', () => {
    expect(
      matchesGrabElementChord({ ...base, key: 'v', code: 'KeyV', control: true }, 'win32')
    ).toBe(false)
  })
})
