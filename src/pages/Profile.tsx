import {
  Award,
  Bell,
  ChevronRight,
  CircleHelp,
  Gift,
  Languages,
  Leaf,
  Loader2,
  LogOut,
  MailWarning,
  PiggyBank,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  UserRound,
  FileText,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthForm, type AuthMode } from '../components/AuthForm'
import { Button, Chip } from '../components/Button'
import { Toggle } from '../components/FiltersSheet'
import { PageHeader } from '../components/PageHeader'
import { Sheet } from '../components/Sheet'
import { APP_NAME, DASHBOARD_URL, LANDING_URL, PRIVACY_URL, TERMS_URL } from '../config'
import { DIET_LABELS } from '../data/categories'
import { formatPrice } from '../lib/format'
import { shareContent } from '../lib/native'
import { computeImpact } from '../state/reducer'
import { useAccount, useAppState, useDispatch, useSync } from '../state/store'
import type { Diet } from '../types'
import { t, tn } from '../i18n'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { customerApi } from '../lib/api'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'
import { track } from '../lib/telemetry'

/** Milestones for the gamified "impact level", like badges in the original app. */
const LEVELS = [
  { name: 'Food Saver', min: 0 },
  { name: 'Waste Warrior', min: 3 },
  { name: 'Planet Protector', min: 10 },
  { name: 'Food Hero', min: 25 },
  { name: 'Legend', min: 50 },
]

function levelFor(bags: number) {
  let idx = 0
  LEVELS.forEach((l, i) => {
    if (bags >= l.min) idx = i
  })
  const next = LEVELS[idx + 1]
  return {
    current: LEVELS[idx]!,
    next,
    progress: next ? (bags - LEVELS[idx]!.min) / (next.min - LEVELS[idx]!.min) : 1,
  }
}

export function Profile() {
  const { profile, orders } = useAppState()
  const dispatch = useDispatch()
  const impact = computeImpact(orders)
  const level = levelFor(impact.bagsSaved)
  const [editOpen, setEditOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const { live } = useSync()
  const { account, logout } = useAccount()
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const displayName = account?.name ?? profile.name

  const invite = async () => {
    const result = await shareContent({
      title: APP_NAME,
      text: t('Join me on Ngopu and rescue delicious surplus food at a third of the price!'),
      url: LANDING_URL,
    })
    if (result === 'copied') {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    }
  }

  return (
    <div className="bg-cream pb-8">
      <PageHeader title={t('Profile')} />
      <section className="bg-white px-4 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white">
            {displayName ? displayName[0]!.toUpperCase() : <UserRound className="h-8 w-8" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{displayName || t('Food saver')}</p>
            <p className="truncate text-sm text-muted">
              {account ? account.email : live ? t('Guest · not signed in') : profile.email || t('Add your email')}
            </p>
          </div>
          <Button variant="ghost" className="h-9 px-3 text-sm" onClick={() => setEditOpen(true)}>
            {t('Edit')}
          </Button>
        </div>
        {live && !account && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button className="h-11" onClick={() => setAuthMode('signup')}>
              {t('Create account')}
            </Button>
            <Button variant="secondary" className="h-11" onClick={() => setAuthMode('login')}>
              {t('Log in')}
            </Button>
          </div>
        )}
        {account && account.emailVerified === false && <VerifyEmailBanner />}
      </section>

      <section className="mt-2 bg-white px-4 py-5">
        <h2 className="text-lg font-bold">{t('Your impact')}</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat icon={<ShoppingBag className="h-5 w-5" />} value={String(impact.bagsSaved)} label={t('Meals saved')} />
          <Stat icon={<PiggyBank className="h-5 w-5" />} value={formatPrice(impact.moneySaved)} label={t('Money saved')} />
          <Stat icon={<Leaf className="h-5 w-5" />} value={`${impact.co2eKg} kg`} label={t('CO₂e avoided')} />
        </div>
        <div className="mt-4 rounded-2xl bg-brand p-4 text-white">
          <div className="flex items-center gap-3">
            <Award className="h-10 w-10 text-sun" />
            <div>
              <p className="text-sm text-mint">{t('Your level')}</p>
              <p className="text-lg font-bold">{t(level.current.name)}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-sun transition-all" style={{ width: `${Math.round(level.progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-mint">
            {level.next
              ? tn(level.next.min - impact.bagsSaved, 'Rescue {n} more bag to become a {level}.', 'Rescue {n} more bags to become a {level}.', { level: t(level.next.name) })
              : t('You’ve reached the top level. Legendary!')}
          </p>
        </div>
      </section>

      <section className="mt-2 bg-white">
        <div className="flex items-center gap-3 px-4 py-4">
          <Languages className="h-5 w-5 text-muted" aria-hidden />
          <span className="flex-1 font-medium">{t('Language')}</span>
          <LanguageSwitch />
        </div>
        {account && <PushRow />}
        <MenuButton
          icon={<Gift className="h-5 w-5" />}
          label={inviteCopied ? t('Invite link copied!') : t('Invite your friends')}
          onClick={invite}
        />
        <a href={DASHBOARD_URL} className="flex items-center gap-3 border-t border-line px-4 py-4">
          <span className="text-muted">
            <Store className="h-5 w-5" />
          </span>
          <span className="flex-1 font-medium">{t('Ngopu for Business')}</span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </a>
        <MenuLink icon={<CircleHelp className="h-5 w-5" />} label={t('How Ngopu works')} to="/welcome" />
        <a href={TERMS_URL} className="flex items-center gap-3 border-t border-line px-4 py-4">
          <span className="text-muted">
            <FileText className="h-5 w-5" />
          </span>
          <span className="flex-1 font-medium">{t('Terms of service')}</span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </a>
        <a href={PRIVACY_URL} className="flex items-center gap-3 border-t border-line px-4 py-4">
          <span className="text-muted">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="flex-1 font-medium">{t('Privacy policy')}</span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </a>
        {!live && <MenuButton icon={<RotateCcw className="h-5 w-5" />} label={t('Reset demo data')} onClick={() => setResetOpen(true)} />}
      </section>

      {account && (
        <section className="mt-2 bg-white">
          <MenuButton icon={<LogOut className="h-5 w-5" />} label={t('Log out')} onClick={logout} />
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="flex w-full items-center gap-3 border-t border-line px-4 py-4 text-left text-red-600"
          >
            <Trash2 className="h-5 w-5" />
            <span className="flex-1 font-medium">{t('Delete account')}</span>
          </button>
        </section>
      )}

      <p className="mt-6 text-center text-xs text-muted">{APP_NAME} · {t('Fight food waste, one bag at a time')}</p>

      {editOpen && <EditProfileSheet onClose={() => setEditOpen(false)} />}
      {deleteOpen && <DeleteAccountSheet onClose={() => setDeleteOpen(false)} />}
      {authMode && (
        <Sheet open onClose={() => setAuthMode(null)} title={authMode === 'signup' ? t('Create your account') : t('Welcome back')}>
          <AuthForm initialMode={authMode} defaultName={profile.name} onDone={() => setAuthMode(null)} />
        </Sheet>
      )}

      <Sheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t('Reset demo data?')}
        footer={
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              dispatch({ type: 'resetDemo' })
              setResetOpen(false)
            }}
          >
            {t('Reset everything')}
          </Button>
        }
      >
        <p className="text-muted">{t('This clears your orders, favourites and profile and restocks every store.')}</p>
      </Sheet>
    </div>
  )
}

function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const { profile } = useAppState()
  const { account, rename } = useAccount()
  const dispatch = useDispatch()
  const [name, setName] = useState(account?.name ?? profile.name)
  const [email, setEmail] = useState(account?.email ?? profile.email)
  const [diets, setDiets] = useState<Diet[]>(profile.diets)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const save = async () => {
    setError('')
    if (account) {
      if (!name.trim()) return setError(t('Your name can’t be empty.'))
      if (name.trim() !== account.name) {
        setSaving(true)
        try {
          await rename(name.trim())
        } catch (err) {
          setSaving(false)
          return setError(err instanceof Error ? err.message : t('Couldn’t save. Please try again.'))
        }
      }
      dispatch({ type: 'updateProfile', profile: { diets } })
    } else {
      dispatch({
        type: 'updateProfile',
        profile: { name: name.trim(), email: email.trim(), diets },
      })
    }
    // Carry diet preferences into Browse filters, as the original app does.
    dispatch({ type: 'setFilters', filters: { diets } })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('Edit profile')}
      footer={
        <>
          {error && (
            <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <Button className="w-full" disabled={!emailValid || saving} onClick={save}>
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t('Save')}
          </Button>
        </>
      }
    >
      <label className="block text-sm font-semibold">
        {t('Name')}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl bg-cream px-3 font-normal outline-brand"
        />
      </label>
      <label className="mt-4 block text-sm font-semibold">
        {t('Email')}
        <input
          type="email"
          value={email}
          readOnly={!!account}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl bg-cream px-3 font-normal outline-brand read-only:text-muted"
        />
      </label>
      {account && <p className="mt-1 text-xs text-muted">{t('Your login email. To change it, contact support.')}</p>}
      {!emailValid && <p className="mt-1 text-sm text-red-600">{t('Enter a valid email address.')}</p>}
      <p className="mt-4 text-sm font-semibold">{t('Diet preferences')}</p>
      <div className="mt-2 flex gap-2">
        {(Object.keys(DIET_LABELS) as Diet[]).map((d) => (
          <Chip
            key={d}
            active={diets.includes(d)}
            onClick={() => setDiets((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))}
          >
            {t(DIET_LABELS[d])}
          </Chip>
        ))}
      </div>
    </Sheet>
  )
}

function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { deleteAccount } = useAccount()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await deleteAccount()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Couldn’t delete your account. Please try again.'))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={busy ? () => {} : onClose}
      title={t('Delete your account?')}
      footer={
        <>
          {error && (
            <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <Button variant="danger" className="w-full" disabled={busy} onClick={confirm}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t('Delete account permanently')}
          </Button>
        </>
      }
    >
      <p className="text-muted">
        {t('Your name, email and password are erased right away and you’ll be logged out. Past orders stay with the stores without your details, for their records. This can’t be undone.')}
      </p>
    </Sheet>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-brand-light p-3 text-brand">
      {icon}
      <p className="mt-2 truncate text-lg font-bold text-brand-dark">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  )
}

function MenuLink({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 border-t border-line px-4 py-4">
      <span className="text-muted">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="h-5 w-5 text-muted" />
    </Link>
  )
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-t border-line px-4 py-4 text-left">
      <span className="text-muted">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="h-5 w-5 text-muted" />
    </button>
  )
}

/** Asks the customer to confirm their email, with a resend button. */
function VerifyEmailBanner() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const resend = async () => {
    setState('sending')
    try {
      await customerApi.resendVerification()
      setState('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong. Please try again.'))
      setState('error')
    }
  }
  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-sun/25 p-3 text-sm ring-1 ring-sun/60" role="status">
      <MailWarning className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t('Confirm your email')}</p>
        <p className="mt-0.5 text-ink/75">
          {state === 'sent' ? t('Sent! Open the link in the email to confirm.') : state === 'error' ? error : t('We sent you a link. It lets us send your receipts and help if you forget your password.')}
        </p>
        {state !== 'sent' && (
          <button type="button" onClick={resend} disabled={state === 'sending'} className="mt-1.5 font-semibold text-brand underline underline-offset-2">
            {state === 'sending' ? t('Sending…') : t('Send the link again')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Pickup reminders and order updates, on this device. */
function PushRow() {
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    pushState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState('unsupported'))
    return () => {
      alive = false
    }
  }, [])
  const toggle = async (on: boolean) => {
    setError('')
    setState('loading')
    try {
      const next = on ? await enablePush() : await disablePush()
      if (next === 'on') track('push_enabled')
      setState(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong. Please try again.'))
      setState('off')
    }
  }
  if (state === 'unsupported') return null
  return (
    <div className="border-t border-line px-4 py-4">
      <label className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-muted" aria-hidden />
        <span className="flex-1">
          <span className="block font-medium">{t('Pickup reminders')}</span>
          <span className="block text-sm text-muted">
            {state === 'blocked' ? t('Notifications are blocked. Allow them in your phone or browser settings.') : t('30 minutes before pickup, and if a store cancels')}
          </span>
        </span>
        <Toggle checked={state === 'on'} onChange={(v) => state !== 'loading' && state !== 'blocked' && toggle(v)} label={t('Pickup reminders')} />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
