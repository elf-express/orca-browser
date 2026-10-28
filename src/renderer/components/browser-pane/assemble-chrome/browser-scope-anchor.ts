const ANCHOR_NAME_PREFIX = '--orca-browser-'

/**
 * Builds the CSS anchor name that ties a scope's `BrowserPane` placeholder to its overlay slot.
 * Characters outside `[A-Za-z0-9-]` become `_<hex code point>` so any scope id is a valid dashed ident.
 */
export function browserScopeAnchorName(scopeId: string): string {
  let escaped = ''
  for (const char of scopeId) {
    escaped += /[A-Za-z0-9-]/.test(char)
      ? char
      : `_${(char.codePointAt(0) ?? 0).toString(16).padStart(2, '0')}`
  }
  return `${ANCHOR_NAME_PREFIX}${escaped}`
}
