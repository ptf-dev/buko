import {
  ArrowRight,
  BadgePercent,
  Bell,
  Clock,
  Globe,
  Heart,
  Leaf,
  MapPin,
  Menu,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ANDROID_APK_PATH, APP_STORE_URL, LANDING_URL, PLAY_STORE_URL } from '../config'
import { COPY, LANDING_TITLES } from './copy'
import { LangProvider, LangSwitch, useLang } from './i18n'

function useCopy() {
  return COPY[useLang().lang]
}

const WEB_APP = '/app'

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  return 'desktop'
}

/** Adds the `in` class to `.reveal` elements as they scroll into view. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`reveal ${className}`} style={{ '--delay': `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href="/" className={`flex items-center gap-2 text-2xl font-black tracking-tight ${light ? 'text-white' : 'text-brand'}`}>
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span>
        ngopu<span className="text-sun">.</span>
      </span>
    </a>
  )
}

/** iPhone-style device frame around an app screenshot. `className` positions and sizes the device. */
function Phone({ src, alt, className = '', priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={className}>
      <div className="relative aspect-[390/844] rounded-[2.9rem] bg-[#0b1413] p-[10px] shadow-[0_40px_80px_-20px_rgba(0,64,62,0.45),0_0_0_1px_rgba(255,255,255,0.08)_inset]">
        <div className="relative h-full w-full overflow-hidden rounded-[2.3rem] bg-white">
          <img src={src} alt={alt} className="h-full w-full object-cover object-top" loading={priority ? 'eager' : 'lazy'} />
          <div className="absolute top-2 left-1/2 h-[22px] w-[34%] -translate-x-1/2 rounded-full bg-[#0b1413]" />
        </div>
      </div>
    </div>
  )
}

function AppleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.37 12.73c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66ZM14.1 5.98c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.26Z" />
    </svg>
  )
}

function PlayIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#34A853" d="M3.6 2.3 13.3 12l-9.7 9.7c-.4-.2-.6-.7-.6-1.2V3.5c0-.5.2-1 .6-1.2Z" />
      <path fill="#FBBC04" d="m16.6 15.3-3.3-3.3 3.3-3.3 3.7 2.1c1 .6 1 1.9 0 2.4l-3.7 2.1Z" />
      <path fill="#EA4335" d="M13.3 12 3.6 21.7c.3.2.8.2 1.2 0l11.8-6.4-3.3-3.3Z" />
      <path fill="#4285F4" d="M13.3 12 16.6 8.7 4.8 2.3c-.4-.2-.9-.2-1.2 0L13.3 12Z" />
    </svg>
  )
}

function StoreBadge({
  href,
  icon,
  top,
  bottom,
  download,
  disabled,
  dark = true,
}: {
  href?: string
  icon: ReactNode
  top: string
  bottom: string
  download?: boolean
  disabled?: boolean
  dark?: boolean
}) {
  const cls = `inline-flex h-14 items-center gap-3 rounded-2xl px-5 text-left transition ${
    dark ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-line'
  } ${disabled ? 'cursor-default opacity-60' : 'hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0'}`
  const content = (
    <>
      {icon}
      <span className="leading-tight">
        <span className="block text-[11px] opacity-80">{top}</span>
        <span className="block text-base font-semibold">{bottom}</span>
      </span>
    </>
  )
  if (disabled || !href) return <span className={cls} aria-disabled>{content}</span>
  return (
    <a href={href} className={cls} {...(download ? { download: 'ngopu.apk' } : {})}>
      {content}
    </a>
  )
}

/** Web app + Android + iOS calls to action. Store badges switch to real links once the store URLs are configured. */
function GetTheApp({ platform, dark = true, center = false }: { platform: Platform; dark?: boolean; center?: boolean }) {
  const t = useCopy().cta
  const android = PLAY_STORE_URL ? (
    <StoreBadge key="android" dark={dark} href={PLAY_STORE_URL} icon={<PlayIcon className="h-7 w-7" />} top={t.playTop} bottom="Google Play" />
  ) : (
    <StoreBadge key="android" dark={dark} href={ANDROID_APK_PATH} download icon={<PlayIcon className="h-7 w-7" />} top={t.apkTop} bottom={t.apkBottom} />
  )
  const ios = APP_STORE_URL ? (
    <StoreBadge key="ios" dark={dark} href={APP_STORE_URL} icon={<AppleIcon className="h-7 w-7" />} top={t.appStoreTop} bottom="App Store" />
  ) : (
    <StoreBadge key="ios" dark={dark} disabled icon={<AppleIcon className="h-7 w-7" />} top={t.appStoreSoonTop} bottom="App Store" />
  )
  const badges = platform === 'ios' ? [ios, android] : [android, ios]
  return (
    <div className={`flex flex-col gap-4 ${center ? 'items-center' : 'items-center lg:items-start'}`}>
      <a
        href={WEB_APP}
        className={`group inline-flex h-14 items-center gap-2 rounded-full px-8 text-lg font-semibold transition hover:-translate-y-0.5 ${
          dark
            ? 'bg-brand text-white shadow-[0_12px_30px_-10px_rgba(0,97,95,0.7)] hover:bg-brand-dark'
            : 'bg-sun text-ink shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)] hover:bg-white'
        }`}
      >
        {t.main}
        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
      </a>
      <p className={`text-sm ${dark ? 'text-muted' : 'text-mint'}`}>{t.note}</p>
      <div className={`mt-2 flex flex-wrap gap-3 ${center ? 'justify-center' : 'justify-center lg:justify-start'}`}>{badges}</div>
      {platform === 'ios' && !APP_STORE_URL && (
        <p className={`max-w-sm text-center text-xs lg:text-left ${dark ? 'text-muted' : 'text-mint'}`}>
          {t.iosHint[0]}
          <span className="font-semibold">{t.iosHint[1]}</span>
          {t.iosHint[2]}
          <span className="font-semibold">{t.iosHint[3]}</span>
          {t.iosHint[4]}
        </p>
      )}
    </div>
  )
}

function SectionTitle({ title, text, light = false }: { title: ReactNode; text?: string; light?: boolean }) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <h2 className={`text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl ${light ? 'text-white' : ''}`}>{title}</h2>
      {text && <p className={`mx-auto mt-5 max-w-2xl text-lg sm:text-xl ${light ? 'text-mint' : 'text-muted'}`}>{text}</p>}
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Nav() {
  const t = useCopy().nav
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition ${
        scrolled || open ? 'border-b border-black/5 bg-white/75 backdrop-blur-xl backdrop-saturate-150' : ''
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <ul className="hidden items-center gap-8 text-sm font-medium text-ink/80 md:flex">
          {t.links.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="hover:text-brand">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <span className="hidden sm:block">
            <LangSwitch />
          </span>
          <a href={WEB_APP} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-brand-dark">
            {t.openApp}
          </a>
          <button
            type="button"
            className="rounded-full p-2 md:hidden"
            aria-label={open ? t.closeMenu : t.openMenu}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>
      {open && (
        <ul className="border-t border-black/5 px-5 pb-4 md:hidden">
          {t.links.map((n) => (
            <li key={n.href}>
              <a href={n.href} onClick={() => setOpen(false)} className="block py-3 text-lg font-medium">
                {n.label}
              </a>
            </li>
          ))}
          <li className="pt-3">
            <LangSwitch />
          </li>
        </ul>
      )}
    </header>
  )
}

function FloatingChip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`absolute z-20 flex items-center gap-2 rounded-2xl bg-white/90 px-3.5 py-2.5 text-sm font-semibold shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/5 backdrop-blur ${className}`}
    >
      {children}
    </div>
  )
}

function Hero({ platform }: { platform: Platform }) {
  const t = useCopy().hero
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(185,228,212,0.8),transparent)]" />
        <div className="absolute top-60 -right-40 h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(255,201,77,0.35),transparent)]" />
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="text-center lg:text-left">
          <Reveal>
            <h1 className="text-6xl leading-[0.95] font-black tracking-[-0.04em] sm:text-7xl lg:text-8xl">
              {t.line1}
              <br />
              <span className="text-brand">{t.line2}</span>
              <span className="text-sun">.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-xl text-muted sm:text-2xl lg:mx-0">
              {t.sub[0]}
              <span className="font-semibold text-ink">{t.sub[1]}</span>
              {t.sub[2]}
            </p>
          </Reveal>
          <Reveal delay={240} className="mt-10">
            <GetTheApp platform={platform} />
          </Reveal>
        </div>

        <Reveal delay={200} className="relative mx-auto h-[560px] w-full max-w-[460px] sm:h-[640px]">
          <Phone src="/landing/store.jpg" alt={t.altStore} className="absolute top-16 left-0 w-[46%] -rotate-6 opacity-95" />
          <Phone src="/landing/reserved.jpg" alt={t.altReserved} className="absolute top-16 right-0 w-[46%] rotate-6 opacity-95" />
          <Phone src="/landing/discover.jpg" alt={t.altDiscover} priority className="absolute top-0 left-1/2 z-10 w-[56%] -translate-x-1/2" />
          <FloatingChip className="animate-float top-24 -left-2 sm:left-0">
            <span className="rounded-md bg-sun px-1.5 py-0.5 text-xs font-bold">-67%</span> {t.chipPrice}
          </FloatingChip>
          <FloatingChip className="animate-float-slow right-0 bottom-28">
            <Leaf className="h-5 w-5 text-brand" /> {t.chipCo2}
          </FloatingChip>
          <FloatingChip className="animate-float bottom-6 left-6">
            <Clock className="h-5 w-5 text-brand" /> {t.chipPickup}
          </FloatingChip>
        </Reveal>
      </div>
    </section>
  )
}

function Marquee() {
  const t = useCopy()
  const items = [...t.categories, ...t.categories]
  return (
    <section aria-label={t.categoriesLabel} className="overflow-hidden border-y border-line bg-cream py-5">
      <div className="animate-marquee flex w-max gap-10 text-lg font-semibold whitespace-nowrap text-ink/70">
        {items.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
    </section>
  )
}

function Stats() {
  const t = useCopy()
  const stats: { value: string; label: string; source?: string }[] = t.stats
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid gap-10 text-center sm:grid-cols-3">
        {stats.map((s, i) => (
          <Reveal key={s.value} delay={i * 100}>
            <p className="text-6xl font-black tracking-tight text-brand sm:text-7xl">{s.value}</p>
            <p className="mx-auto mt-3 max-w-[16rem] text-lg text-muted">{s.label}</p>
            {s.source && (
              <p className="mt-1 text-xs text-muted/70">
                {t.sourceLabel}: {s.source}
              </p>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  )
}

const STEP_VISUALS = [
  { icon: MapPin, img: '/landing/discover.jpg' },
  { icon: ShoppingBag, img: '/landing/checkout.jpg' },
  { icon: Smartphone, img: '/landing/order.jpg' },
]

function HowItWorks() {
  const t = useCopy().how
  const steps = t.steps.map((s, i) => ({ ...s, ...STEP_VISUALS[i] }))
  const [active, setActive] = useState(0)
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-step]')
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.step))),
      { rootMargin: '-45% 0px -45% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section id="how" className="bg-cream py-24 sm:py-32">
      <SectionTitle
        title={
          <>
            {t.title[0]}
            <br />
            <span className="text-brand">{t.title[1]}</span>
          </>
        }
      />
      <div className="mx-auto mt-16 grid max-w-6xl gap-10 px-5 lg:grid-cols-2 lg:gap-20">
        {/* Sticky phone on large screens, swapping screenshots as each step scrolls past. */}
        <div className="hidden lg:block">
          <div className="sticky top-[12vh] mx-auto w-[320px]">
            <div className="relative">
              {steps.map((s, i) => (
                <div key={s.title} className={`transition-opacity duration-500 ${i === 0 ? 'relative' : 'absolute inset-0'} ${active === i ? 'opacity-100' : 'opacity-0'}`}>
                  <Phone src={s.img} alt={s.title} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <ol className="space-y-10 lg:space-y-0">
          {steps.map((s, i) => (
            <li key={s.title} data-step={i} className="flex flex-col justify-center lg:min-h-[80vh]">
              <Reveal>
                <div className={`transition-opacity duration-500 ${active === i ? 'lg:opacity-100' : 'lg:opacity-40'}`}>
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
                      <s.icon className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-bold text-brand">
                      {t.step} {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">{s.title}</h3>
                  <p className="mt-4 max-w-md text-lg text-muted sm:text-xl">{s.text}</p>
                  <Phone src={s.img} alt={s.title} className="mx-auto mt-8 w-[260px] lg:hidden" />
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Bento({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={`overflow-hidden rounded-[2rem] p-8 ${className}`}>
      {children}
    </Reveal>
  )
}

function Features() {
  const t = useCopy().features
  return (
    <section id="features" className="py-24 sm:py-32">
      <SectionTitle
        title={
          <>
            {t.title[0]}
            <br />
            <span className="text-muted">{t.title[1]}</span>
          </>
        }
      />
      <div className="mx-auto mt-16 grid max-w-6xl gap-5 px-5 md:grid-cols-6">
        <Bento className="relative bg-brand text-white md:col-span-4 md:row-span-2">
          <MapPin className="h-8 w-8 text-sun" />
          <h3 className="mt-4 text-3xl font-extrabold tracking-tight">{t.discoverTitle}</h3>
          <p className="mt-2 max-w-sm text-lg text-mint">{t.discoverText}</p>
          <div className="mt-8 flex justify-center gap-5 md:justify-start">
            <Phone src="/landing/discover.jpg" alt={t.altDiscover} className="w-[200px] translate-y-10" />
            <Phone src="/landing/browse.jpg" alt={t.altBrowse} className="hidden w-[200px] translate-y-20 sm:block" />
          </div>
        </Bento>
        <Bento delay={80} className="bg-sun md:col-span-2">
          <BadgePercent className="h-8 w-8" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">{t.items[0].title}</h3>
          <p className="mt-2 text-ink/75">{t.items[0].text}</p>
        </Bento>
        <Bento delay={160} className="bg-brand-light md:col-span-2">
          <Smartphone className="h-8 w-8 text-brand" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">{t.items[1].title}</h3>
          <p className="mt-2 text-muted">{t.items[1].text}</p>
        </Bento>
        <Bento className="bg-cream md:col-span-2">
          <Leaf className="h-8 w-8 text-brand" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">{t.items[2].title}</h3>
          <p className="mt-2 text-muted">{t.items[2].text}</p>
        </Bento>
        <Bento delay={80} className="bg-cream md:col-span-2">
          <Heart className="h-8 w-8 text-brand" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">{t.items[3].title}</h3>
          <p className="mt-2 text-muted">{t.items[3].text}</p>
        </Bento>
        <Bento delay={160} className="bg-cream md:col-span-2">
          <ShieldCheck className="h-8 w-8 text-brand" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">{t.items[4].title}</h3>
          <p className="mt-2 text-muted">{t.items[4].text}</p>
        </Bento>
      </div>
    </section>
  )
}

function Impact() {
  const t = useCopy().impact
  return (
    <section id="impact" className="relative overflow-hidden bg-brand-dark py-24 text-white sm:py-32">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(31,157,122,0.5),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 lg:grid-cols-2">
        <div>
          <Reveal>
            <h2 className="text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              {t.title}
            </h2>
            <p className="mt-5 text-lg text-mint sm:text-xl">{t.text}</p>
          </Reveal>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { v: '2.7 kg', l: t.stats[0] },
              { v: '~70%', l: t.stats[1] },
              { v: '5', l: t.stats[2] },
            ].map((s, i) => (
              <Reveal key={s.l} delay={i * 100} className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur">
                <p className="text-2xl font-black whitespace-nowrap text-sun sm:text-4xl">{s.v}</p>
                <p className="mt-1 text-sm text-mint">{s.l}</p>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={150} className="flex justify-center">
          <Phone src="/landing/profile.jpg" alt={t.alt} className="w-[290px]" />
        </Reveal>
      </div>
    </section>
  )
}

const PERK_ICONS = [TrendingUp, Users, Store]

function ForStores() {
  const t = useCopy().stores
  const perks = t.perks.map((p, i) => ({ ...p, icon: PERK_ICONS[i] }))
  return (
    <section id="stores" className="py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <div className="rounded-[2.5rem] bg-cream p-8 sm:p-12">
            <ul className="space-y-8">
              {perks.map((p) => (
                <li key={p.title} className="flex gap-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
                    <p.icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold">{p.title}</h3>
                    <p className="mt-1 text-muted">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <div className="order-1 text-center lg:order-2 lg:text-left">
          <Reveal>
            <h2 className="text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">{t.title}</h2>
            <p className="mt-5 text-lg text-muted sm:text-xl">{t.text}</p>
            <a
              href="/dashboard/apply"
              className="group mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-ink px-8 text-lg font-semibold text-white transition hover:-translate-y-0.5"
            >
              {t.cta}
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function FAQ() {
  const t = useCopy().faq
  return (
    <section id="faq" className="bg-cream py-24 sm:py-32">
      <SectionTitle title={t.title} />
      <div className="mx-auto mt-14 max-w-3xl divide-y divide-line px-5">
        {t.items.map((f, i) => (
          <Reveal key={f.q} delay={i * 40}>
            <details className="group py-6">
              <summary className="flex cursor-pointer items-center justify-between gap-6 text-xl font-semibold">
                {f.q}
                <Plus className="faq-icon h-6 w-6 shrink-0 text-brand transition-transform" />
              </summary>
              <p className="mt-3 text-lg text-muted">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function QR({ url }: { url: string }) {
  const t = useCopy().final
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#00403e', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [url])
  if (!svg) return null
  return <div className="h-32 w-32" aria-label={`${t.qrLabel} ${url}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
}

function FinalCTA({ platform }: { platform: Platform }) {
  const t = useCopy().final
  return (
    <section className="relative overflow-hidden bg-brand py-24 text-white sm:py-32">
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(255,201,77,0.35),transparent)]" />
      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <Reveal>
          <h2 className="text-5xl leading-[1] font-black tracking-tight sm:text-7xl">
            {t.lines[0]}
            <br />
            {t.lines[1]}
            <br />
            <span className="text-sun">{t.lines[2]}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-xl text-mint">{t.text}</p>
        </Reveal>
        <Reveal delay={120} className="mt-10">
          <GetTheApp platform={platform} dark={false} center />
        </Reveal>
        {platform === 'desktop' && (
          <Reveal delay={200} className="mt-12 hidden items-center justify-center gap-5 md:flex">
            <div className="rounded-2xl bg-white p-3">
              <QR url={`${LANDING_URL}${WEB_APP}`} />
            </div>
            <p className="max-w-[12rem] text-left text-mint">{t.qr}</p>
          </Reveal>
        )}
      </div>
    </section>
  )
}

function Footer() {
  const t = useCopy().footer
  return (
    <footer className="bg-ink py-14 text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo light />
          <p className="mt-3 max-w-xs text-sm">
            <span className="font-semibold text-white">{t.tagline[0]}</span>
            {t.tagline[1]}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-4">
          <div>
            <p className="font-semibold text-white">{t.product}</p>
            <ul className="mt-3 space-y-2">
              <li><a href={WEB_APP} className="hover:text-white">{t.webApp}</a></li>
              <li><a href={PLAY_STORE_URL || ANDROID_APK_PATH} className="hover:text-white">Android</a></li>
              <li><span>{t.iphoneSoon}</span></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">{t.learn}</p>
            <ul className="mt-3 space-y-2">
              <li><a href="#how" className="hover:text-white">{t.how}</a></li>
              <li><a href="#impact" className="hover:text-white">{t.impact}</a></li>
              <li><a href="#faq" className="hover:text-white">{t.faq}</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">{t.business}</p>
            <ul className="mt-3 space-y-2">
              <li><a href="/dashboard" className="hover:text-white">{t.partnerLogin}</a></li>
              <li><a href="/dashboard/apply" className="hover:text-white">{t.becomePartner}</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">{t.legal}</p>
            <ul className="mt-3 space-y-2">
              <li><a href="/privacy" className="hover:text-white">{t.privacy}</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-3 border-t border-white/10 px-5 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} Ngopu. {t.rights}
        </p>
        <div className="flex items-center gap-3">
          <p className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> {t.place}
          </p>
          <LangSwitch dark />
        </div>
      </div>
    </footer>
  )
}

/** Sticky "Open app" bar for phones once the hero CTA has scrolled away. */
function MobileStickyCTA() {
  const t = useCopy().sticky
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div
      className={`fixed inset-x-3 bottom-3 z-40 transition duration-300 md:hidden ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-24 opacity-0'
      }`}
    >
      <a
        href={WEB_APP}
        className="flex h-14 items-center justify-between rounded-full bg-ink/90 pr-2 pl-5 text-white shadow-2xl backdrop-blur-xl"
      >
        <span className="flex items-center gap-2 font-semibold">
          <Bell className="h-5 w-5 text-sun" /> {t.text}
        </span>
        <span className="rounded-full bg-sun px-4 py-2 text-sm font-bold text-ink">{t.open}</span>
      </a>
    </div>
  )
}

export function Landing() {
  return (
    <LangProvider titles={LANDING_TITLES}>
      <LandingPage />
    </LangProvider>
  )
}

function LandingPage() {
  const [platform] = useState<Platform>(detectPlatform)
  useReveal()
  return (
    <>
      <Nav />
      <main>
        <Hero platform={platform} />
        <Marquee />
        <Stats />
        <HowItWorks />
        <Features />
        <Impact />
        <ForStores />
        <FAQ />
        <FinalCTA platform={platform} />
      </main>
      <Footer />
      <MobileStickyCTA />
    </>
  )
}
