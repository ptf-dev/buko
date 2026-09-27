import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/** Website languages. Albanian first: it's the home market. */
export type Lang = 'sq' | 'en'

const STORAGE_KEY = 'ngopu:lang'

/** ?lang= in the URL wins, then the visitor's saved choice, then Albanian. */
function initialLang(): Lang {
  const fromUrl = new URLSearchParams(window.location.search).get('lang')
  if (fromUrl === 'sq' || fromUrl === 'en') return fromUrl
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'sq' || saved === 'en') return saved
  } catch {
    // Storage blocked: fall through to the default.
  }
  return 'sq'
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'sq', setLang: () => {} })

export function LangProvider({ children, titles }: { children: ReactNode; titles: Record<Lang, { title: string; description: string }> }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      // Not persisted; the choice still applies to this visit.
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('lang')
    window.history.replaceState(null, '', url)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = titles[lang].title
    document.querySelector('meta[name="description"]')?.setAttribute('content', titles[lang].description)
  }, [lang, titles])

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}

/** SQ | EN switch used in the site header. */
export function LangSwitch({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang()
  return (
    <div
      role="radiogroup"
      aria-label={lang === 'sq' ? 'Gjuha' : 'Language'}
      className={`inline-flex rounded-full p-0.5 text-xs font-bold ${dark ? 'bg-white/10' : 'bg-ink/5'}`}
    >
      {(['sq', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          lang={l}
          aria-label={l === 'sq' ? 'Shqip' : 'English'}
          onClick={() => setLang(l)}
          className={`h-7 min-w-9 rounded-full px-2.5 uppercase transition-colors duration-150 ${
            lang === l ? (dark ? 'bg-white text-ink' : 'bg-white text-brand shadow-[0_1px_2px_rgba(0,0,0,0.12)]') : dark ? 'text-white/70 hover:text-white' : 'text-ink/60 hover:text-ink'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
