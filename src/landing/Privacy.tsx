import { ArrowLeft } from 'lucide-react'
import { LangProvider, LangSwitch, useLang } from './i18n'
import { PRIVACY_COPY, PRIVACY_TITLES, PRIVACY_UPDATED } from './privacyCopy'

function PrivacyPage() {
  const { lang } = useLang()
  const t = PRIVACY_COPY[lang]
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <a href="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-brand">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span>
              ngopu<span className="text-sun">.</span>
            </span>
          </a>
          <LangSwitch />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-10 pb-20">
        <a href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t.back}
        </a>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">{t.title}</h1>
        <p className="mt-3 text-sm text-muted">
          {t.updated} {PRIVACY_UPDATED[lang]}
        </p>
        <p className="mt-6 max-w-[68ch] text-lg leading-relaxed text-ink/85">{t.intro}</p>

        <nav aria-label={t.contents} className="mt-8 rounded-2xl bg-cream p-5">
          <p className="text-sm font-semibold">{t.contents}</p>
          <ol className="mt-2 grid list-decimal gap-x-8 gap-y-1 pl-5 text-[15px] marker:text-muted sm:grid-cols-2">
            {t.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-brand hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-4">
          {t.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-20 pt-10">
              <h2 className="text-2xl font-bold tracking-tight">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 max-w-[68ch] space-y-3 text-[17px] leading-relaxed text-ink/85">
                {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
                {s.bullets && (
                  <ul className="list-disc space-y-2 pl-5 marker:text-brand">
                    {s.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {s.after?.map((p) => <p key={p}>{p}</p>)}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">© {new Date().getFullYear()} Ngopu</footer>
    </div>
  )
}

export function Privacy() {
  return (
    <LangProvider titles={PRIVACY_TITLES}>
      <PrivacyPage />
    </LangProvider>
  )
}
