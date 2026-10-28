export type BrowserShortcutAction =
  | 'browser.back'
  | 'browser.forward'
  | 'browser.reload'
  | 'browser.hardReload'
  | 'browser.focusAddressBar'
  | 'browser.find'
  | 'browser.annotateElement'
  | 'zoom.in'
  | 'zoom.out'
  | 'zoom.reset'

// Field names match Electron's `Input` so a before-input-event payload can be passed directly.
export type BrowserShortcutInput = {
  key: string
  code?: string
  control?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
}

type Binding = {
  // Mod is Cmd on darwin and Ctrl elsewhere.
  mod?: boolean
  shift?: boolean
  alt?: boolean
  // Compared case-insensitively. Ignored when `code` is set.
  key?: string
  code?: string
}

type PlatformGroup = 'darwin' | 'other'

const BROWSER_SHORTCUT_BINDINGS: Record<
  BrowserShortcutAction,
  Record<PlatformGroup, readonly Binding[]>
> = {
  'browser.back': {
    darwin: [{ mod: true, key: '[' }],
    other: [{ alt: true, key: 'ArrowLeft' }]
  },
  'browser.forward': {
    darwin: [{ mod: true, key: ']' }],
    other: [{ alt: true, key: 'ArrowRight' }]
  },
  'browser.reload': {
    darwin: [{ mod: true, key: 'r' }],
    other: [{ mod: true, key: 'r' }]
  },
  'browser.hardReload': {
    darwin: [{ mod: true, shift: true, key: 'r' }],
    other: [{ mod: true, shift: true, key: 'r' }]
  },
  'browser.focusAddressBar': {
    darwin: [{ mod: true, key: 'l' }],
    other: [{ mod: true, key: 'l' }]
  },
  'browser.find': {
    darwin: [{ mod: true, key: 'f' }],
    other: [{ mod: true, key: 'f' }]
  },
  // Fixed chord, not user-rebindable.
  'browser.annotateElement': {
    darwin: [{ mod: true, shift: true, key: 'c' }],
    other: [{ alt: true, shift: true, key: 'n' }]
  },
  'zoom.in': {
    darwin: [
      { mod: true, code: 'Equal' },
      { mod: true, shift: true, key: '+' },
      { mod: true, code: 'NumpadAdd' }
    ],
    other: [
      { mod: true, code: 'Equal' },
      { mod: true, shift: true, key: '+' },
      { mod: true, code: 'NumpadAdd' }
    ]
  },
  'zoom.out': {
    darwin: [
      { mod: true, code: 'Minus' },
      { mod: true, code: 'NumpadSubtract' }
    ],
    other: [
      { mod: true, code: 'Minus' },
      { mod: true, code: 'NumpadSubtract' }
    ]
  },
  'zoom.reset': {
    darwin: [{ mod: true, key: '0' }],
    other: [{ mod: true, key: '0' }]
  }
}

const ACTIONS = Object.keys(BROWSER_SHORTCUT_BINDINGS) as BrowserShortcutAction[]

const CODE_LABELS: Record<string, string> = {
  Equal: '=',
  Minus: '-',
  NumpadAdd: '+',
  NumpadSubtract: '-'
}

function groupOf(platform: NodeJS.Platform): PlatformGroup {
  return platform === 'darwin' ? 'darwin' : 'other'
}

function bindingMatches(binding: Binding, input: BrowserShortcutInput, group: PlatformGroup) {
  const modIsMeta = group === 'darwin'
  const wantsControl = modIsMeta ? false : !!binding.mod
  const wantsMeta = modIsMeta ? !!binding.mod : false
  if (
    !!input.control !== wantsControl ||
    !!input.meta !== wantsMeta ||
    !!input.shift !== !!binding.shift ||
    !!input.alt !== !!binding.alt
  ) {
    return false
  }
  if (binding.code !== undefined) {
    return input.code === binding.code
  }
  return binding.key !== undefined && input.key.toLowerCase() === binding.key.toLowerCase()
}

export function matchBrowserShortcut(
  input: BrowserShortcutInput,
  platform: NodeJS.Platform
): BrowserShortcutAction | null {
  const group = groupOf(platform)
  for (const action of ACTIONS) {
    if (BROWSER_SHORTCUT_BINDINGS[action][group].some((b) => bindingMatches(b, input, group))) {
      return action
    }
  }
  return null
}

function keyLabel(binding: Binding): string {
  if (binding.code !== undefined) {
    return CODE_LABELS[binding.code] ?? binding.code
  }
  const key = binding.key ?? ''
  if (key === 'ArrowLeft') {
    return 'Left'
  }
  if (key === 'ArrowRight') {
    return 'Right'
  }
  return key.length === 1 ? key.toUpperCase() : key
}

export function formatBrowserShortcutLabel(
  action: BrowserShortcutAction,
  platform: NodeJS.Platform
): string {
  const group = groupOf(platform)
  const binding = BROWSER_SHORTCUT_BINDINGS[action][group][0]
  const key = keyLabel(binding)
  if (group === 'darwin') {
    // macOS order: Control, Option, Shift, Command.
    return `${binding.alt ? '⌥' : ''}${binding.shift ? '⇧' : ''}${binding.mod ? '⌘' : ''}${key}`
  }
  const parts = [
    binding.mod ? 'Ctrl' : null,
    binding.alt ? 'Alt' : null,
    binding.shift ? 'Shift' : null,
    key
  ].filter((part): part is string => part !== null)
  return parts.join('+')
}
