import { setLang, useLang, type Lang } from '../i18n'
import { customerApi, customerToken } from '../lib/api'
import { track } from '../lib/telemetry'

/** SQ | EN switch. Signed-in customers also get emails and notifications in the chosen language. */
export function LanguageSwitch({ dark = false }: { dark?: boolean }) {
  const lang = useLang()
  const choose = (l: Lang) => {
    setLang(l)
    track('language_changed', { lang: l })
    if (customerToken.get()) customerApi.setLanguage(l).catch(() => {})
  }
  return (
    <div role="radiogroup" aria-label={lang === 'sq' ? 'Gjuha' : 'Language'} className={`inline-flex rounded-full p-0.5 text-xs font-bold ${dark ? 'bg-white/10' : 'bg-ink/5'}`}>
      {(['sq', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          lang={l}
          aria-label={l === 'sq' ? 'Shqip' : 'English'}
          onClick={() => choose(l)}
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
