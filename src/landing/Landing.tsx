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
  const android = PLAY_STORE_URL ? (
    <StoreBadge key="android" dark={dark} href={PLAY_STORE_URL} icon={<PlayIcon className="h-7 w-7" />} top="Get it on" bottom="Google Play" />
  ) : (
    <StoreBadge key="android" dark={dark} href={ANDROID_APK_PATH} download icon={<PlayIcon className="h-7 w-7" />} top="Download the beta" bottom="Android app" />
  )
  const ios = APP_STORE_URL ? (
    <StoreBadge key="ios" dark={dark} href={APP_STORE_URL} icon={<AppleIcon className="h-7 w-7" />} top="Download on the" bottom="App Store" />
  ) : (
    <StoreBadge key="ios" dark={dark} disabled icon={<AppleIcon className="h-7 w-7" />} top="Coming soon to the" bottom="App Store" />
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
        Start rescuing food
        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
      </a>
      <p className={`text-sm ${dark ? 'text-muted' : 'text-mint'}`}>Free · Works in your browser — no download needed</p>
      <div className={`mt-2 flex flex-wrap gap-3 ${center ? 'justify-center' : 'justify-center lg:justify-start'}`}>{badges}</div>
      {platform === 'ios' && !APP_STORE_URL && (
        <p className={`max-w-sm text-center text-xs lg:text-left ${dark ? 'text-muted' : 'text-mint'}`}>
          On iPhone? Open the web app, tap <span className="font-semibold">Share</span> →{' '}
          <span className="font-semibold">Add to Home Screen</span> and Ngopu works just like an app.
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

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#impact', label: 'Impact' },
  { href: '#stores', label: 'For stores' },
  { href: '#faq', label: 'FAQ' },
]

function Nav() {
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
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="hover:text-brand">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <a href={WEB_APP} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
            Open app
          </a>
          <button
            type="button"
            className="rounded-full p-2 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>
      {open && (
        <ul className="border-t border-black/5 px-5 pb-4 md:hidden">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} onClick={() => setOpen(false)} className="block py-3 text-lg font-medium">
                {n.label}
              </a>
            </li>
          ))}
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
              Good food.
              <br />
              <span className="text-brand">Rescued</span>
              <span className="text-sun">.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-xl text-muted sm:text-2xl lg:mx-0">
              Surprise Bags of delicious unsold food from the best bakeries, restaurants and shops near you — at a{' '}
              <span className="font-semibold text-ink">third of the price</span>. Launching soon in Tirana.
            </p>
          </Reveal>
          <Reveal delay={240} className="mt-10">
            <GetTheApp platform={platform} />
          </Reveal>
        </div>

        <Reveal delay={200} className="relative mx-auto h-[560px] w-full max-w-[460px] sm:h-[640px]">
          <Phone src="/landing/store.jpg" alt="A bakery's Surprise Bag in the Ngopu app" className="absolute top-16 left-0 w-[46%] -rotate-6 opacity-95" />
          <Phone src="/landing/reserved.jpg" alt="Reservation confirmed with pickup code" className="absolute top-16 right-0 w-[46%] rotate-6 opacity-95" />
          <Phone src="/landing/discover.jpg" alt="Discover surprise bags near you" priority className="absolute top-0 left-1/2 z-10 w-[56%] -translate-x-1/2" />
          <FloatingChip className="animate-float top-24 -left-2 sm:left-0">
            <span className="rounded-md bg-sun px-1.5 py-0.5 text-xs font-bold">-67%</span> 350 L instead of 1,050 L
          </FloatingChip>
          <FloatingChip className="animate-float-slow right-0 bottom-28">
            <Leaf className="h-5 w-5 text-brand" /> 2.7 kg CO₂e saved
          </FloatingChip>
          <FloatingChip className="animate-float bottom-6 left-6">
            <Clock className="h-5 w-5 text-brand" /> Pick up today 19:00
          </FloatingChip>
        </Reveal>
      </div>
    </section>
  )
}

const CATEGORIES = ['🥐 Bakeries', '🍣 Sushi', '🥗 Salad bars', '🍕 Pizzerias', '🛒 Supermarkets', '🍰 Pastry shops', '☕ Cafés', '🥙 Delis', '🍩 Donuts', '🥬 Greengrocers', '💐 Florists', '🍽️ Hotel buffets']

function Marquee() {
  const items = [...CATEGORIES, ...CATEGORIES]
  return (
    <section aria-label="Types of stores on Ngopu" className="overflow-hidden border-y border-line bg-cream py-5">
      <div className="animate-marquee flex w-max gap-10 text-lg font-semibold whitespace-nowrap text-ink/70">
        {items.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
    </section>
  )
}

function Stats() {
  const stats = [
    { value: '⅓', label: 'of all food produced worldwide is lost or wasted', source: 'UN FAO' },
    { value: '~70%', label: 'off the original price of every Surprise Bag' },
    { value: '2.7 kg', label: 'of CO₂e avoided each time you rescue a bag' },
  ]
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid gap-10 text-center sm:grid-cols-3">
        {stats.map((s, i) => (
          <Reveal key={s.value} delay={i * 100}>
            <p className="text-6xl font-black tracking-tight text-brand sm:text-7xl">{s.value}</p>
            <p className="mx-auto mt-3 max-w-[16rem] text-lg text-muted">{s.label}</p>
            {s.source && <p className="mt-1 text-xs text-muted/70">Source: {s.source}</p>}
          </Reveal>
        ))}
      </div>
    </section>
  )
}

const STEPS = [
  {
    icon: MapPin,
    title: 'Find a bag near you',
    text: 'Browse bakeries, restaurants and shops on the map or in a list. Filter by pickup time, food type and diet.',
    img: '/landing/discover.jpg',
  },
  {
    icon: ShoppingBag,
    title: 'Reserve in seconds',
    text: 'See what you could get, the pickup window and the price. Reserve and pay in the app — before it’s gone.',
    img: '/landing/checkout.jpg',
  },
  {
    icon: Smartphone,
    title: 'Swipe to collect',
    text: 'Head to the store during the pickup window, show your code and swipe. Enjoy your food — and your savings.',
    img: '/landing/order.jpg',
  },
]

function HowItWorks() {
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
      <SectionTitle title={<>Three taps from waste to taste.</>} />
      <div className="mx-auto mt-16 grid max-w-6xl gap-10 px-5 lg:grid-cols-2 lg:gap-20">
        {/* Sticky phone on large screens, swapping screenshots as each step scrolls past. */}
        <div className="hidden lg:block">
          <div className="sticky top-[12vh] mx-auto w-[320px]">
            <div className="relative">
              {STEPS.map((s, i) => (
                <div key={s.title} className={`transition-opacity duration-500 ${i === 0 ? 'relative' : 'absolute inset-0'} ${active === i ? 'opacity-100' : 'opacity-0'}`}>
                  <Phone src={s.img} alt={s.title} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <ol className="space-y-10 lg:space-y-0">
          {STEPS.map((s, i) => (
            <li key={s.title} data-step={i} className="flex flex-col justify-center lg:min-h-[80vh]">
              <Reveal>
                <div className={`transition-opacity duration-500 ${active === i ? 'lg:opacity-100' : 'lg:opacity-40'}`}>
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
                      <s.icon className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-bold text-brand">Step {i + 1}</span>
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
  return (
    <section id="features" className="py-24 sm:py-32">
      <SectionTitle
        title={
          <>
            Everything you need.
            <br />
            <span className="text-muted">Nothing you don’t.</span>
          </>
        }
      />
      <div className="mx-auto mt-16 grid max-w-6xl gap-5 px-5 md:grid-cols-6">
        <Bento className="relative bg-brand text-white md:col-span-4 md:row-span-2">
          <MapPin className="h-8 w-8 text-sun" />
          <h3 className="mt-4 text-3xl font-extrabold tracking-tight">Discover what’s near you</h3>
          <p className="mt-2 max-w-sm text-lg text-mint">
            “Collect now”, “Save before it’s too late”, new stores and your favourites — all in one feed, sorted for you.
          </p>
          <div className="mt-8 flex justify-center gap-5 md:justify-start">
            <Phone src="/landing/discover.jpg" alt="Discover feed" className="w-[200px] translate-y-10" />
            <Phone src="/landing/browse.jpg" alt="Browse list with filters" className="hidden w-[200px] translate-y-20 sm:block" />
          </div>
        </Bento>
        <Bento delay={80} className="bg-sun md:col-span-2">
          <BadgePercent className="h-8 w-8" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">Up to 70% off</h3>
          <p className="mt-2 text-ink/75">Real food from real stores, priced to be rescued, not thrown away.</p>
        </Bento>
        <Bento delay={160} className="bg-brand-light md:col-span-2">
          <Smartphone className="h-8 w-8 text-brand" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">Swipe to collect</h3>
          <p className="mt-2 text-muted">A pickup code and one swipe at the counter. No printing, no waiting.</p>
        </Bento>
        <Bento className="bg-cream md:col-span-2">
          <Leaf className="h-8 w-8 text-brand" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">Track your impact</h3>
          <p className="mt-2 text-muted">Meals saved, money saved and CO₂e avoided — plus levels to unlock.</p>
        </Bento>
        <Bento delay={80} className="bg-cream md:col-span-2">
          <Heart className="h-8 w-8 text-brand" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">Favourites & alerts</h3>
          <p className="mt-2 text-muted">Heart the spots you love and see their bags first.</p>
        </Bento>
        <Bento delay={160} className="bg-cream md:col-span-2">
          <ShieldCheck className="h-8 w-8 text-brand" />
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">Cancel with a tap</h3>
          <p className="mt-2 text-muted">Plans changed? Cancel up to 2 hours before pickup for a full refund.</p>
        </Bento>
      </div>
    </section>
  )
}

function Impact() {
  return (
    <section id="impact" className="relative overflow-hidden bg-brand-dark py-24 text-white sm:py-32">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(31,157,122,0.5),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 lg:grid-cols-2">
        <div>
          <Reveal>
            <h2 className="text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              Every bag is a small win for the planet.
            </h2>
            <p className="mt-5 text-lg text-mint sm:text-xl">
              Food waste is responsible for around 8–10% of global greenhouse gas emissions. When you rescue a bag, that food
              gets eaten instead of binned — and Ngopu keeps count.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { v: '2.7 kg', l: 'CO₂e avoided per bag' },
              { v: '~70%', l: 'saved on every bag' },
              { v: '5', l: 'levels to unlock' },
            ].map((s, i) => (
              <Reveal key={s.l} delay={i * 100} className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur">
                <p className="text-2xl font-black whitespace-nowrap text-sun sm:text-4xl">{s.v}</p>
                <p className="mt-1 text-sm text-mint">{s.l}</p>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={150} className="flex justify-center">
          <Phone src="/landing/profile.jpg" alt="Your impact in the Ngopu app" className="w-[290px]" />
        </Reveal>
      </div>
    </section>
  )
}

function ForStores() {
  const perks = [
    { icon: TrendingUp, title: 'Earn from surplus', text: 'Turn food you’d throw away into revenue every day.' },
    { icon: Users, title: 'Win new regulars', text: 'Bring new customers through your door who come back.' },
    { icon: Store, title: 'Zero hassle', text: 'Set today’s bag count, check pickup codes, done.' },
  ]
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
            <h2 className="text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">Own a bakery, café or shop?</h2>
            <p className="mt-5 text-lg text-muted sm:text-xl">
              Join Ngopu as a launch partner. Apply in two minutes; once we approve your store, you list your unsold food from your own dashboard and the neighbourhood rescues it.
            </p>
            <a
              href="/dashboard/apply"
              className="group mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-ink px-8 text-lg font-semibold text-white transition hover:-translate-y-0.5"
            >
              Apply to become a partner
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

const FAQS = [
  {
    q: 'What is a Surprise Bag?',
    a: 'Stores can’t predict exactly what will be left at the end of the day, so they pack a bag of whatever didn’t sell — bread, meals, groceries or treats. You’ll know the type of food and the store, and the rest is a (delicious) surprise.',
  },
  {
    q: 'How much does it cost?',
    a: 'The app is free. Each bag is priced at roughly a third of the value of what’s inside, and you see both prices before you reserve.',
  },
  {
    q: 'How do I pick up my order?',
    a: 'Go to the store during the pickup window shown in the app, show your pickup code and swipe to collect in front of the staff.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes. You can cancel up to 2 hours before the pickup window starts and get a full refund.',
  },
  {
    q: 'What about allergies and diets?',
    a: 'You can filter for vegetarian and vegan bags. Because contents change daily, stores can’t guarantee a bag is free of any allergen — ask at pickup if you’re unsure.',
  },
  {
    q: 'Is there an iPhone and Android app?',
    a: 'Ngopu works right now in any browser. The Android beta can be downloaded from this page, and the iPhone app is coming to the App Store soon.',
  },
]

function FAQ() {
  return (
    <section id="faq" className="bg-cream py-24 sm:py-32">
      <SectionTitle title="Questions? Answered." />
      <div className="mx-auto mt-14 max-w-3xl divide-y divide-line px-5">
        {FAQS.map((f, i) => (
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
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#00403e', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [url])
  if (!svg) return null
  return <div className="h-32 w-32" aria-label={`QR code for ${url}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
}

function FinalCTA({ platform }: { platform: Platform }) {
  return (
    <section className="relative overflow-hidden bg-brand py-24 text-white sm:py-32">
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(255,201,77,0.35),transparent)]" />
      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <Reveal>
          <h2 className="text-5xl leading-[1] font-black tracking-tight sm:text-7xl">
            Save food.
            <br />
            Save money.
            <br />
            <span className="text-sun">Start tonight.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-xl text-mint">Your first Surprise Bag is a few taps away.</p>
        </Reveal>
        <Reveal delay={120} className="mt-10">
          <GetTheApp platform={platform} dark={false} center />
        </Reveal>
        {platform === 'desktop' && (
          <Reveal delay={200} className="mt-12 hidden items-center justify-center gap-5 md:flex">
            <div className="rounded-2xl bg-white p-3">
              <QR url={`${LANDING_URL}${WEB_APP}`} />
            </div>
            <p className="max-w-[12rem] text-left text-mint">Scan with your phone camera to open Ngopu on your phone.</p>
          </Reveal>
        )}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-ink py-14 text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo light />
          <p className="mt-3 max-w-xs text-sm">
            <span className="font-semibold text-white">ngopu</span> <span className="italic">(Albanian)</span>: eat your fill. Fight food waste, one
            bag at a time. Made with care in Tirana.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold text-white">Product</p>
            <ul className="mt-3 space-y-2">
              <li><a href={WEB_APP} className="hover:text-white">Web app</a></li>
              <li><a href={PLAY_STORE_URL || ANDROID_APK_PATH} className="hover:text-white">Android</a></li>
              <li><span>iPhone (soon)</span></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">Learn</p>
            <ul className="mt-3 space-y-2">
              <li><a href="#how" className="hover:text-white">How it works</a></li>
              <li><a href="#impact" className="hover:text-white">Impact</a></li>
              <li><a href="#faq" className="hover:text-white">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">Business</p>
            <ul className="mt-3 space-y-2">
              <li><a href="/dashboard" className="hover:text-white">Partner login</a></li>
              <li><a href="/dashboard/apply" className="hover:text-white">Become a partner</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-2 border-t border-white/10 px-5 pt-6 text-xs sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Ngopu. All rights reserved.</p>
        <p className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5" /> English · Tirana, Albania
        </p>
      </div>
    </footer>
  )
}

/** Sticky "Open app" bar for phones once the hero CTA has scrolled away. */
function MobileStickyCTA() {
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
          <Bell className="h-5 w-5 text-sun" /> Bags waiting near you
        </span>
        <span className="rounded-full bg-sun px-4 py-2 text-sm font-bold text-ink">Open</span>
      </a>
    </div>
  )
}

export function Landing() {
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
