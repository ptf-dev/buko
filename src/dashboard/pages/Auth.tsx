import { Clock, Database, LocateFixed, Mail, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CATEGORIES, CATEGORY_ORDER } from '../../data/categories'
import { api } from '../../lib/api'
import type { Category } from '../../types'
import { useAuth } from '../data'
import { AuthLayout } from '../Shell'
import type { SessionUser } from '../types'
import { Btn, Field, Input, Select, TextArea } from '../ui'

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
      {message}
    </p>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(16,40,38,0.06),0_16px_40px_-24px_rgba(16,40,38,0.3)] sm:p-8">{children}</div>
}

/** Shared submit helper: runs the request, surfaces the server's message on failure. */
function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export function Login() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [forgot, setForgot] = useState<'form' | 'sent' | null>(null)
  const { busy, error, run } = useSubmit()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      if (forgot) {
        await api('auth/forgot', { method: 'POST', json: { email } })
        setForgot('sent')
        return
      }
      if (challenge) {
        const { user } = await api<{ user: SessionUser }>('auth/login/2fa', { method: 'POST', json: { challenge, code } })
        setUser(user)
        navigate('/', { replace: true })
        return
      }
      const r = await api<{ user?: SessionUser; twoFactor?: { challenge: string } }>('auth/login', { method: 'POST', json: { email, password } })
      if (r.twoFactor) return setChallenge(r.twoFactor.challenge)
      setUser(r.user!)
      navigate('/', { replace: true })
    })
  }

  return (
    <AuthLayout>
      <Card>
        {forgot === 'sent' ? (
          <div role="status">
            <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
            <p className="mt-1.5 text-[15px] text-muted">If {email} has an account, we’ve sent a link to choose a new password. It works for 1 hour.</p>
            <Btn className="mt-6 w-full" variant="secondary" onClick={() => setForgot(null)}>
              Back to log in
            </Btn>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">{forgot ? 'Reset your password' : challenge ? 'Enter your code' : 'Log in to Ngopu for Business'}</h1>
            <p className="mt-1.5 text-[15px] text-muted">
              {forgot
                ? 'We’ll email you a link to choose a new password.'
                : challenge
                  ? 'Open your authenticator app and type the 6-digit code for Ngopu. Lost your phone? Use a recovery code.'
                  : 'For partner stores and the Ngopu team.'}
            </p>
            <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
              <FormError message={error} />
              {challenge ? (
                <Field label="Code">
                  {(id) => (
                    <Input
                      id={id}
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={11}
                      value={code}
                      onChange={(e) => setCode(e.target.value.trim())}
                      className="text-center font-mono text-lg tracking-[0.3em]"
                    />
                  )}
                </Field>
              ) : (
                <>
                  <Field label="Email">
                    {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
                  </Field>
                  {!forgot && (
                    <Field label="Password">
                      {(id) => (
                        <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                      )}
                    </Field>
                  )}
                </>
              )}
              <Btn type="submit" className="w-full" loading={busy} disabled={challenge ? code.length < 6 : forgot ? !email : !email || !password}>
                {forgot ? 'Send reset link' : challenge ? 'Verify' : 'Log in'}
              </Btn>
            </form>
            <p className="mt-4 text-center text-sm">
              {challenge ? (
                <button type="button" className="font-semibold text-muted hover:text-ink" onClick={() => (setChallenge(null), setCode(''))}>
                  Start over
                </button>
              ) : (
                <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setForgot(forgot ? null : 'form')}>
                  {forgot ? 'Back to log in' : 'Forgot your password?'}
                </button>
              )}
            </p>
          </>
        )}
      </Card>
      <p className="mt-6 text-center text-[15px] text-muted">
        Own a store and want to join?{' '}
        <Link to="/apply" className="font-semibold text-brand hover:underline">
          Apply to become a partner
        </Link>
      </p>
    </AuthLayout>
  )
}

export function Setup() {
  const { setUser, reload } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const { busy, error, run } = useSubmit()
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { user } = await api<{ user: SessionUser }>('auth/setup', { method: 'POST', json: form })
      setUser(user)
      await reload()
      navigate('/admin', { replace: true })
    })
  }

  return (
    <AuthLayout>
      <Card>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-light text-brand">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Create the first admin account</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          This page only works once. After this, invite the rest of your team from <span className="font-medium text-ink">Team & settings</span>.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
          <FormError message={error} />
          <Field label="Your name">{(id) => <Input id={id} autoComplete="name" value={form.name} onChange={set('name')} />}</Field>
          <Field label="Work email">{(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} />}</Field>
          <Field label="Password" hint="At least 8 characters.">
            {(id, hint) => (
              <Input id={id} type="password" autoComplete="new-password" aria-describedby={hint} value={form.password} onChange={set('password')} />
            )}
          </Field>
          <Btn type="submit" className="w-full" loading={busy} disabled={!form.name || !form.email || form.password.length < 8}>
            Create admin account
          </Btn>
        </form>
      </Card>
    </AuthLayout>
  )
}

export function Apply() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    storeName: '',
    category: 'bakery' as Category,
    address: '',
    contactName: '',
    phone: '',
    email: '',
    password: '',
    note: '',
  })
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const { busy, error, run } = useSubmit()
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })
  const valid = form.storeName && form.address && form.contactName && form.email && form.password.length >= 8

  const locate = () => {
    if (!('geolocation' in navigator)) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 10_000 },
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { user } = await api<{ user: SessionUser }>('apply', { method: 'POST', json: { ...form, ...(coords ?? {}) } })
      setUser(user)
      navigate('/pending', { replace: true })
    })
  }

  return (
    <AuthLayout wide>
      <Card>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Sell your surplus food on Ngopu</h1>
        <p className="mt-2 max-w-lg text-[15px] text-muted">
          Tell us about your store. We review every application, usually within two working days. Once approved, you list today’s
          Surprise Bags from your dashboard.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-8" noValidate>
          <FormError message={error} />
          <fieldset className="space-y-4">
            <legend className="mb-4 text-base font-semibold">Your store</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Store name">{(id) => <Input id={id} value={form.storeName} onChange={set('storeName')} />}</Field>
              <Field label="Type of store">
                {(id) => (
                  <Select id={id} value={form.category} onChange={set('category')}>
                    {CATEGORY_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORIES[c].label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field
              label="Address"
              hint={
                coords
                  ? 'Location saved, so customers will see your store on the map.'
                  : 'Customers pick up here. Add your map location now or later in your store profile.'
              }
            >
              {(id, hint) => (
                <div className="flex gap-2">
                  <Input id={id} aria-describedby={hint} autoComplete="street-address" value={form.address} onChange={set('address')} className="flex-1" />
                  <Btn variant="secondary" onClick={locate} loading={locating} aria-label="Use my current location">
                    <LocateFixed className="h-4 w-4" />
                    <span className="hidden sm:inline">{coords ? 'Located' : 'Use my location'}</span>
                  </Btn>
                </div>
              )}
            </Field>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-4 text-base font-semibold">Your login</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name">{(id) => <Input id={id} autoComplete="name" value={form.contactName} onChange={set('contactName')} />}</Field>
              <Field label="Phone (optional)">{(id) => <Input id={id} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />}</Field>
              <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} />}</Field>
              <Field label="Password" hint="At least 8 characters.">
                {(id, hint) => (
                  <Input id={id} type="password" autoComplete="new-password" aria-describedby={hint} value={form.password} onChange={set('password')} />
                )}
              </Field>
            </div>
          </fieldset>

          <Field label="Anything we should know? (optional)" hint="Opening hours, what you usually have left, how many bags a day…">
            {(id, hint) => <TextArea id={id} aria-describedby={hint} value={form.note} onChange={set('note')} />}
          </Field>

          <p className="text-[13px] text-muted">
            By applying you agree that we store your contact and store details to review your application, as described in our{' '}
            <a href="/privacy?lang=en" className="font-medium text-brand hover:underline">
              privacy policy
            </a>
            .
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Already a partner?{' '}
              <Link to="/login" className="font-semibold text-brand hover:underline">
                Log in
              </Link>
            </p>
            <Btn type="submit" loading={busy} disabled={!valid}>
              Send application
            </Btn>
          </div>
        </form>
      </Card>
    </AuthLayout>
  )
}

export function Pending() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const rejected = user?.storeStatus === 'rejected'
  const suspended = user?.storeStatus === 'suspended'
  return (
    <AuthLayout>
      <Card>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff1cc] text-[#7a5400]">
          {rejected || suspended ? <Mail className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          {rejected ? 'Your application wasn’t approved' : suspended ? 'Your store is paused' : 'Thanks, we’re reviewing your store'}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {rejected
            ? 'We can’t add your store to Ngopu right now. If you think this is a mistake, reply to our email or contact the Ngopu team.'
            : suspended
              ? 'Customers can’t see your Surprise Bags at the moment. Contact the Ngopu team to reactivate your store.'
              : 'We usually review applications within two working days. As soon as your store is approved, log in here to publish your first Surprise Bag.'}
        </p>
        {user && (
          <p className="mt-5 rounded-xl bg-cream px-4 py-3 text-sm">
            Signed in as <span className="font-semibold">{user.email}</span>
          </p>
        )}
        <div className="mt-6 flex gap-2">
          {!rejected && !suspended && (
            <Btn variant="secondary" onClick={() => window.location.reload()}>
              Check again
            </Btn>
          )}
          <Btn
            variant="ghost"
            onClick={async () => {
              await logout()
              navigate('/login', { replace: true })
            }}
          >
            Log out
          </Btn>
        </div>
      </Card>
    </AuthLayout>
  )
}

export function NoDatabase({ offline }: { offline?: boolean }) {
  return (
    <AuthLayout wide>
      <Card>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-light text-brand">
          <Database className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{offline ? 'Can’t reach the Ngopu server' : 'Connect the database to start'}</h1>
        {offline ? (
          <p className="mt-2 text-[15px] text-muted">Check your internet connection and try again.</p>
        ) : (
          <>
            <p className="mt-2 text-[15px] text-muted">
              The dashboard is deployed, but no database is connected yet. It takes about two minutes in Vercel:
            </p>
            <ol className="mt-5 list-decimal space-y-2.5 pl-5 text-[15px] leading-relaxed marker:font-semibold marker:text-brand">
              <li>
                Open your <span className="font-semibold">buko</span> project on vercel.com and go to the <span className="font-semibold">Storage</span> tab.
              </li>
              <li>
                Click <span className="font-semibold">Create Database</span>, choose <span className="font-semibold">Neon (Serverless Postgres)</span>, and accept the
                defaults (the free plan is fine).
              </li>
              <li>
                Connect it to the <span className="font-semibold">buko</span> project for all environments. Vercel adds{' '}
                <code className="rounded bg-cream px-1.5 py-0.5 text-sm">DATABASE_URL</code> for you.
              </li>
              <li>
                Redeploy the latest deployment. Then come back here to create the first admin account. Ngopu creates its tables and demo stores
                automatically.
              </li>
            </ol>
          </>
        )}
        <Btn variant="secondary" className="mt-6" onClick={() => window.location.reload()}>
          Check again
        </Btn>
      </Card>
    </AuthLayout>
  )
}
