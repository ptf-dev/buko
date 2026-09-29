import { Clock, Leaf, LocateFixed, MapPin, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm } from '../components/AuthForm'
import { Button } from '../components/Button'
import { useGeolocation } from '../components/LocationSheet'
import { APP_NAME, DEFAULT_LOCATION } from '../config'
import { useAccount, useAppState, useDispatch, useSync } from '../state/store'
import { placeLabel, t } from '../i18n'
import { LanguageSwitch } from '../components/LanguageSwitch'

const SLIDES = [
  {
    icon: ShoppingBag,
    title: 'Rescue delicious food',
    text: 'Local bakeries, restaurants and shops sell their unsold food in Surprise Bags at a third of the price.',
  },
  {
    icon: Clock,
    title: 'Reserve, then pick up',
    text: 'Reserve and pay in the app, then collect your bag in the store’s pickup window. Just swipe to collect.',
  },
  {
    icon: Leaf,
    title: 'Good for the planet',
    text: 'Every bag you rescue saves around 2.7 kg of CO₂e. Track your impact as you go.',
  },
]

export function Onboarding() {
  const { onboarded, profile } = useAppState()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { live } = useSync()
  const { account } = useAccount()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile.name)
  const geo = useGeolocation()
  // After the slides: an account step (only when the server is reachable), then location.
  const [phase, setPhase] = useState<'slides' | 'account' | 'setup'>('slides')
  const afterSlides = () => setPhase(live && !account ? 'account' : 'setup')

  const finish = (lat = DEFAULT_LOCATION.lat, lng = DEFAULT_LOCATION.lng, label = DEFAULT_LOCATION.label) => {
    dispatch({
      type: 'completeOnboarding',
      name: account?.name ?? name,
      location: { ...DEFAULT_LOCATION, lat, lng, label },
    })
    navigate('/', { replace: true })
  }

  const next = () => {
    if (step < SLIDES.length - 1) setStep(step + 1)
    else if (onboarded) navigate(-1)
    else afterSlides()
  }

  return (
    <div className="flex min-h-full flex-col bg-brand px-6 pt-10 pb-8 text-white">
      <div className="relative flex items-center justify-center">
        <p className="text-center text-3xl font-black tracking-tight">
          {APP_NAME.toLowerCase()}
          <span className="text-sun">.</span>
        </p>
        <div className="absolute right-0">
          <LanguageSwitch dark />
        </div>
      </div>

      {phase === 'slides' ? (
        <>
          <div key={step} className="animate-fade-in flex flex-1 flex-col items-center justify-center text-center">
            {(() => {
              const Icon = SLIDES[step]!.icon
              return (
                <div className="animate-pop flex h-40 w-40 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-20 w-20 text-sun" strokeWidth={1.5} />
                </div>
              )
            })()}
            <h1 className="mt-10 text-3xl font-bold">{t(SLIDES[step]!.title)}</h1>
            <p className="mt-3 max-w-xs text-mint">{t(SLIDES[step]!.text)}</p>
          </div>
          <div className="mb-6 flex justify-center gap-2">
            {SLIDES.map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-sun' : 'w-2 bg-white/30'}`} />
            ))}
          </div>
          <Button className="w-full bg-white !text-brand hover:bg-mint" onClick={next}>
            {step < SLIDES.length - 1 ? t('Next') : onboarded ? t('Done') : t('Get started')}
          </Button>
          {!onboarded && step < SLIDES.length - 1 && (
            <button type="button" onClick={afterSlides} className="mt-3 text-sm font-semibold text-mint">
              {t('Skip')}
            </button>
          )}
        </>
      ) : phase === 'account' ? (
        <div className="animate-fade-in flex flex-1 flex-col justify-center py-6">
          <h1 className="text-3xl font-bold">{t('Save your bags')}</h1>
          <p className="mt-2 mb-6 text-mint">{t('An account keeps your orders and pickup codes safe on any phone. You need one to reserve.')}</p>
          <AuthForm tone="dark" defaultName={name} onDone={() => setPhase('setup')} />
          <button type="button" onClick={() => setPhase('setup')} className="mt-4 text-sm font-semibold text-mint">
            {t('Just browsing for now')}
          </button>
        </div>
      ) : (
        <div className="animate-fade-in flex flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="text-3xl font-bold">{account ? t('Welcome, {name}!', { name: account.name }) : t('Let’s get you set up')}</h1>
            {!account && (
              <label className="mt-8 block text-sm font-semibold text-mint">
                {t('What should we call you?')}
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('Your first name')}
                  className="mt-2 h-12 w-full rounded-xl bg-white px-4 text-base font-normal text-ink outline-none placeholder:text-muted"
                />
              </label>
            )}
            <p className="mt-8 text-sm font-semibold text-mint">{t('Where do you want to find food?')}</p>
            {geo.status === 'error' && (
              <p className="mt-2 text-sm text-sun">{t('We couldn’t access your location. You can use the city centre instead.')}</p>
            )}
          </div>
          <div className="space-y-3">
            <Button
              className="w-full bg-white !text-brand hover:bg-mint"
              onClick={() => geo.locate((lat, lng) => finish(lat, lng, 'Current location'))}
            >
              <LocateFixed className="h-5 w-5" />
              {geo.status === 'loading' ? t('Finding you…') : t('Use my location')}
            </Button>
            <Button variant="ghost" className="w-full !text-white ring-2 ring-white/40 hover:bg-white/10" onClick={() => finish()}>
              <MapPin className="h-5 w-5" /> {t('Explore {place}', { place: placeLabel(DEFAULT_LOCATION.label) })}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
