import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CONTACT_EMAIL, PRIVACY_URL } from '../config'
import { useAccount } from '../state/store'
import { Button } from './Button'

export type AuthMode = 'signup' | 'login'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Customer sign up / log in. `tone="dark"` sits on the brand-green onboarding
 * screen, `light` inside sheets.
 */
export function AuthForm({
  initialMode = 'signup',
  defaultName = '',
  tone = 'light',
  onDone,
}: {
  initialMode?: AuthMode
  defaultName?: string
  tone?: 'light' | 'dark'
  onDone?: () => void
}) {
  const { signup, login } = useAccount()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dark = tone === 'dark'
  const isSignup = mode === 'signup'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSignup && !name.trim()) return setError('Tell us your name.')
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.')
    if (isSignup && password.length < 8) return setError('Use at least 8 characters for your password.')
    if (!password) return setError('Enter your password.')
    setBusy(true)
    setError('')
    try {
      if (isSignup) await signup(name.trim(), email.trim(), password)
      else await login(email.trim(), password)
      onDone?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  const label = `block text-sm font-semibold ${dark ? 'text-mint' : ''}`
  const input = `mt-1.5 h-12 w-full rounded-xl px-4 text-base font-normal text-ink outline-none placeholder:text-muted ${
    dark ? 'bg-white focus:ring-2 focus:ring-sun' : 'bg-cream focus:ring-2 focus:ring-brand'
  }`

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className={`grid grid-cols-2 rounded-full p-1 text-sm font-semibold ${dark ? 'bg-white/10' : 'bg-cream'}`}>
        {(['signup', 'login'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m)
              setError('')
            }}
            className={`h-9 rounded-full transition ${
              mode === m ? (dark ? 'bg-white text-brand' : 'bg-white text-brand shadow-sm') : dark ? 'text-mint' : 'text-muted'
            }`}
          >
            {m === 'signup' ? 'Create account' : 'Log in'}
          </button>
        ))}
      </div>

      {isSignup && (
        <label className={label}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            placeholder="Your first name"
            className={input}
          />
        </label>
      )}
      <label className={label}>
        Email
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={input}
        />
      </label>
      <label className={label}>
        Password
        <span className="relative block">
          <input
            type={show ? 'text' : 'password'}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? 'At least 8 characters' : ''}
            className={`${input} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-2 mt-0.5 -translate-y-1/2 rounded-full p-2 text-muted"
          >
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </span>
      </label>

      {error && (
        <p role="alert" className={`rounded-xl p-3 text-sm font-medium ${dark ? 'bg-white text-red-700' : 'bg-red-50 text-red-700'}`}>
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className={`w-full ${dark ? 'bg-white !text-brand hover:bg-mint' : ''}`}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : isSignup ? 'Create account' : 'Log in'}
      </Button>

      <p className={`text-center text-xs ${dark ? 'text-mint' : 'text-muted'}`}>
        {isSignup ? (
          <>
            By creating an account you agree to our{' '}
            <a href={PRIVACY_URL} className="underline">
              privacy policy
            </a>
            .
          </>
        ) : (
          <>
            Forgot your password? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Ngopu%20password%20reset`} className="underline">
              {CONTACT_EMAIL}
            </a>
          </>
        )}
      </p>
    </form>
  )
}
