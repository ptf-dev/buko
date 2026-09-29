import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SQ } from '../i18n-sq'

/** Every t('…') / tn(…) string in the customer app must have an Albanian translation. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'dashboard' || f === 'landing' ? [] : sources(p)
    return /\.tsx?$/.test(f) && !f.endsWith('.test.ts') ? [p] : []
  })
}

describe('Albanian translations', () => {
  it('cover every string the app translates', () => {
    const missing = new Set<string>()
    for (const file of sources(join(__dirname, '..'))) {
      const s = readFileSync(file, 'utf8')
      for (const m of s.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) if (!(m[1] in SQ)) missing.add(m[1])
      for (const m of s.matchAll(/\btn\([^,]+,\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'/g)) for (const k of [m[1], m[2]]) if (!(k in SQ)) missing.add(k)
    }
    expect([...missing]).toEqual([])
  })

  it('keep every {placeholder}', () => {
    const wrong = Object.entries(SQ).filter(([en, sq]) => {
      const names = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()
      return names(en) !== names(sq)
    })
    expect(wrong).toEqual([])
  })
})
