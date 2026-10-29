import { describe, expect, it } from 'vitest'
import {
  formatBrowserShortcutLabel,
  matchBrowserShortcut,
  type BrowserShortcutAction,
  type BrowserShortcutInput
} from './browser-keybindings'

type MatchCase = [BrowserShortcutInput, NodeJS.Platform, BrowserShortcutAction | null]

describe('matchBrowserShortcut', () => {
  it.each<MatchCase>([
    [{ key: 'r', meta: true }, 'darwin', 'browser.reload'],
    [{ key: 'r', control: true }, 'win32', 'browser.reload'],
    [{ key: 'R', control: true, shift: true }, 'linux', 'browser.hardReload'],
    [{ key: '[', meta: true }, 'darwin', 'browser.back'],
    [{ key: 'ArrowLeft', alt: true }, 'win32', 'browser.back'],
    [{ key: 'ArrowLeft', alt: true }, 'darwin', null],
    [{ key: 'ArrowRight', alt: true }, 'linux', 'browser.forward'],
    [{ key: 'l', control: true }, 'win32', 'browser.focusAddressBar'],
    [{ key: 'f', meta: true }, 'darwin', 'browser.find'],
    [{ key: '=', code: 'Equal', control: true }, 'win32', 'zoom.in'],
    [{ key: '+', control: true, shift: true }, 'win32', 'zoom.in'],
    [{ key: '-', code: 'NumpadSubtract', control: true }, 'linux', 'zoom.out'],
    [{ key: '0', meta: true }, 'darwin', 'zoom.reset'],
    [{ key: 'l', control: true, alt: true }, 'win32', null],
    [{ key: 'r', control: true }, 'darwin', null]
  ])('matches %j on %s as %s', (input, platform, expected) => {
    expect(matchBrowserShortcut(input, platform)).toBe(expected)
  })
})

describe('formatBrowserShortcutLabel', () => {
  it.each<[BrowserShortcutAction, NodeJS.Platform, string]>([
    ['browser.reload', 'darwin', '⌘R'],
    ['browser.hardReload', 'darwin', '⇧⌘R'],
    ['browser.reload', 'win32', 'Ctrl+R'],
    ['browser.back', 'win32', 'Alt+Left']
  ])('formats %s on %s as %s', (action, platform, expected) => {
    expect(formatBrowserShortcutLabel(action, platform)).toBe(expected)
  })
})

describe('browser.annotateElement', () => {
  it('matches Cmd+Shift+C on macOS only', () => {
    const chord = { key: 'C', code: 'KeyC', meta: true, shift: true }
    expect(matchBrowserShortcut(chord, 'darwin')).toBe('browser.annotateElement')
    expect(matchBrowserShortcut({ ...chord, meta: false, control: true }, 'darwin')).toBeNull()
  })

  it('matches Alt+Shift+N elsewhere', () => {
    const chord = { key: 'N', code: 'KeyN', alt: true, shift: true }
    expect(matchBrowserShortcut(chord, 'win32')).toBe('browser.annotateElement')
    expect(matchBrowserShortcut(chord, 'linux')).toBe('browser.annotateElement')
    expect(matchBrowserShortcut({ ...chord, shift: false }, 'win32')).toBeNull()
  })
})
