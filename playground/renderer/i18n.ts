import type { BrowserRendererHost } from '../../src/renderer'
import en from './locales/en.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import zhHans from './locales/zh-Hans.json'
import zhHant from './locales/zh-Hant.json'

// Locale files are copied from Multica's desktop browser-plugin translations.
type Locale = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko' | 'fr'

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ja,
  ko,
  fr
}

const PLAYGROUND_LABELS: Partial<Record<Locale, Record<string, string>>> = {
  'zh-Hant': { settings: '設定', hideSettings: '隱藏設定' },
  'zh-Hans': { settings: '设置', hideSettings: '隐藏设置' }
}

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g

// Maps a BCP 47 tag from navigator.languages to a supported locale, or null.
function matchLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase()
  if (lower.startsWith('zh')) {
    return /hant|-tw|-hk|-mo/.test(lower) ? 'zh-Hant' : 'zh-Hans'
  }
  const base = lower.split('-')[0]
  return base === 'en' || base === 'ja' || base === 'ko' || base === 'fr' ? base : null
}

export function detectLocale(languages: readonly string[] = navigator.languages): Locale {
  for (const tag of languages) {
    const locale = matchLocale(tag)
    if (locale) {
      return locale
    }
  }
  return 'en'
}

export const locale = detectLocale()

// Lookup order: detected locale, English, then the fallback the package passes in.
export const t: BrowserRendererHost['t'] = (key, fallback, vars) => {
  const template = DICTIONARIES[locale][key] ?? DICTIONARIES.en[key] ?? fallback
  if (!vars) {
    return template
  }
  return template.replace(PLACEHOLDER, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match
  )
}

export function label(key: 'settings' | 'hideSettings', fallback: string): string {
  return PLAYGROUND_LABELS[locale]?.[key] ?? fallback
}
