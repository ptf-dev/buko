import { Award, Bell, ChevronRight, CircleHelp, Gift, Leaf, PiggyBank, RotateCcw, ShoppingBag, Store, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Chip } from '../components/Button'
import { Toggle } from '../components/FiltersSheet'
import { PageHeader } from '../components/PageHeader'
import { Sheet } from '../components/Sheet'
import { APP_NAME, DASHBOARD_URL, LANDING_URL } from '../config'
import { DIET_LABELS } from '../data/categories'
import { formatPrice } from '../lib/format'
import { shareContent } from '../lib/native'
import { computeImpact } from '../state/reducer'
import { useAppState, useDispatch } from '../state/store'
import type { Diet } from '../types'

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
  return { current: LEVELS[idx]!, next, progress: next ? (bags - LEVELS[idx]!.min) / (next.min - LEVELS[idx]!.min) : 1 }
}

export function Profile() {
  const { profile, orders } = useAppState()
  const dispatch = useDispatch()
  const impact = computeImpact(orders)
  const level = levelFor(impact.bagsSaved)
  const [editOpen, setEditOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)

  const invite = async () => {
    const result = await shareContent({
      title: APP_NAME,
      text: `Join me on ${APP_NAME} and rescue delicious surplus food at a third of the price!`,
      url: LANDING_URL,
    })
    if (result === 'copied') {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    }
  }

  return (
    <div className="bg-cream pb-8">
      <PageHeader title="Profile" />
      <section className="bg-white px-4 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white">
            {profile.name ? profile.name[0]!.toUpperCase() : <UserRound className="h-8 w-8" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{profile.name || 'Food saver'}</p>
            <p className="truncate text-sm text-muted">{profile.email || 'Add your email'}</p>
          </div>
          <Button variant="ghost" className="h-9 px-3 text-sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>
      </section>

      <section className="mt-2 bg-white px-4 py-5">
        <h2 className="text-lg font-bold">Your impact</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat icon={<ShoppingBag className="h-5 w-5" />} value={String(impact.bagsSaved)} label="Meals saved" />
          <Stat icon={<PiggyBank className="h-5 w-5" />} value={formatPrice(impact.moneySaved)} label="Money saved" />
          <Stat icon={<Leaf className="h-5 w-5" />} value={`${impact.co2eKg} kg`} label="CO₂e avoided" />
        </div>
        <div className="mt-4 rounded-2xl bg-brand p-4 text-white">
          <div className="flex items-center gap-3">
            <Award className="h-10 w-10 text-sun" />
            <div>
              <p className="text-sm text-mint">Your level</p>
              <p className="text-lg font-bold">{level.current.name}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-sun transition-all" style={{ width: `${Math.round(level.progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-mint">
            {level.next
              ? `Rescue ${level.next.min - impact.bagsSaved} more ${level.next.min - impact.bagsSaved === 1 ? 'bag' : 'bags'} to become a ${level.next.name}.`
              : 'You’ve reached the top level. Legendary!'}
          </p>
        </div>
      </section>

      <section className="mt-2 bg-white">
        <label className="flex items-center gap-3 px-4 py-4">
          <Bell className="h-5 w-5 text-muted" />
          <span className="flex-1 font-medium">Notifications for favourites</span>
          <Toggle
            checked={profile.notifications}
            onChange={(v) => dispatch({ type: 'updateProfile', profile: { notifications: v } })}
            label="Notifications"
          />
        </label>
        <MenuButton icon={<Gift className="h-5 w-5" />} label={inviteCopied ? 'Invite link copied!' : 'Invite your friends'} onClick={invite} />
        <a href={DASHBOARD_URL} className="flex items-center gap-3 border-t border-line px-4 py-4">
          <span className="text-muted">
            <Store className="h-5 w-5" />
          </span>
          <span className="flex-1 font-medium">Ngopu for Business</span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </a>
        <MenuLink icon={<CircleHelp className="h-5 w-5" />} label="How Ngopu works" to="/welcome" />
        <MenuButton icon={<RotateCcw className="h-5 w-5" />} label="Reset demo data" onClick={() => setResetOpen(true)} />
      </section>

      <p className="mt-6 text-center text-xs text-muted">
        {APP_NAME} · Fight food waste, one bag at a time
      </p>

      {editOpen && <EditProfileSheet onClose={() => setEditOpen(false)} />}

      <Sheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo data?"
        footer={
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              dispatch({ type: 'resetDemo' })
              setResetOpen(false)
            }}
          >
            Reset everything
          </Button>
        }
      >
        <p className="text-muted">This clears your orders, favourites and profile and restocks every store.</p>
      </Sheet>
    </div>
  )
}

function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const { profile } = useAppState()
  const dispatch = useDispatch()
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [diets, setDiets] = useState<Diet[]>(profile.diets)
  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const save = () => {
    dispatch({ type: 'updateProfile', profile: { name: name.trim(), email: email.trim(), diets } })
    // Carry diet preferences into Browse filters, as the original app does.
    dispatch({ type: 'setFilters', filters: { diets } })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit profile"
      footer={
        <Button className="w-full" disabled={!emailValid} onClick={save}>
          Save
        </Button>
      }
    >
      <label className="block text-sm font-semibold">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-xl bg-cream px-3 font-normal outline-brand" />
      </label>
      <label className="mt-4 block text-sm font-semibold">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl bg-cream px-3 font-normal outline-brand"
        />
      </label>
      {!emailValid && <p className="mt-1 text-sm text-red-600">Enter a valid email address.</p>}
      <p className="mt-4 text-sm font-semibold">Diet preferences</p>
      <div className="mt-2 flex gap-2">
        {(Object.keys(DIET_LABELS) as Diet[]).map((d) => (
          <Chip key={d} active={diets.includes(d)} onClick={() => setDiets((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))}>
            {DIET_LABELS[d]}
          </Chip>
        ))}
      </div>
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
