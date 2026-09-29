import { useSyncExternalStore } from 'react'
import { SQ } from './i18n-sq'

/**
 * App languages. Albanian first: it's the home market. The choice is shared with the website (same storage
 * key), so someone who read the landing page in English opens the app in English.
 */
export type Lang = 'sq' | 'en'

const STORAGE_KEY = 'ngopu:lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'sq' || saved === 'en') return saved
  } catch {
    // Storage blocked: fall through.
  }
  // An English-only phone gets English; everyone else (and Albanian phones) starts in Albanian.
  const langs = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  if (langs.length && !langs.some((l) => /^sq\b/i.test(l)) && langs.some((l) => /^en\b/i.test(l))) return 'en'
  return 'sq'
}

let current: Lang = initial()
const listeners = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.lang = current

export function getLang(): Lang {
  return current
}

export function setLang(l: Lang) {
  if (l === current) return
  current = l
  try {
    localStorage.setItem(STORAGE_KEY, l)
  } catch {
    // Not persisted; applies to this visit.
  }
  document.documentElement.lang = l
  listeners.forEach((f) => f())
}

/** Re-renders when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => current,
  )
}

/**
 * Translates an English UI string. Keys are the English text itself, so untranslated strings still read
 * fine. {name} placeholders are filled from vars.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = current === 'sq' ? (SQ[key] ?? key) : key
  return vars ? s.replace(/\{(\w+)\}/g, (m: string, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

/** Plural helper: t(one) for 1, t(other) otherwise, with {n}. */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  return t(n === 1 ? one : other, { n, ...vars })
}

/** Messages from the server arrive in English; translate the ones the app shows, including a few with numbers. */
export function translateServer(message: string): string {
  if (current === 'en') return message
  if (SQ[message]) return SQ[message]
  const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^Only (\d+) left\.$/, (m) => t('Only {n} left.', { n: m[1] })],
    [/^Too many attempts\. Try again in (\d+) minutes?\.$/, (m) => t('Too many attempts. Try again in {n} min.', { n: m[1] })],
    [/^Pickup hasn’t opened yet\. You can collect from (\d\d:\d\d)\.$/, (m) => t('Pickup hasn’t opened yet. You can collect from {time}.', { time: m[1] })],
    [/^Unlocks after (\d+) collected orders \(you have (\d+)\)\.$/, (m) => t('Unlocks after {n} collected orders (you have {have}).', { n: m[1], have: m[2] })],
  ]
  for (const [re, f] of patterns) {
    const m = message.match(re)
    if (m) return f(m)
  }
  return message
}

/** Locale for dates and numbers. */
export function locale(): string {
  return current === 'sq' ? 'sq-AL' : 'en-GB'
}

/** Saved place labels are stored in English ("Current location", "Home, Blloku", "Near Blloku"): show them translated. */
export function placeLabel(label: string): string {
  if (current === 'en') return label
  const m = label.match(/^(Home|Work), (.*)$/)
  if (m) return `${t(m[1])}, ${placeLabel(m[2])}`
  const near = label.match(/^Near (.*)$/)
  if (near) return t('Near {place}', { place: near[1] })
  return SQ[label] ?? label
}
