import { Eye, EyeOff, Loader2, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PRIVACY_URL, TERMS_URL } from '../config'
import { t } from '../i18n'
import { customerApi } from '../lib/api'
import { useAccount } from '../state/store'
import { Button } from './Button'

export type AuthMode = 'signup' | 'login' | 'forgot'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Customer sign up / log in / forgot password. `tone="dark"` sits on the brand-green onboarding
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
  const [sent, setSent] = useState(false)
  const dark = tone === 'dark'
  const isSignup = mode === 'signup'
  const forgot = mode === 'forgot'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSignup && !name.trim()) return setError(t('Tell us your name.'))
    if (!EMAIL_RE.test(email.trim())) return setError(t('Enter a valid email address.'))
    if (!forgot) {
      if (isSignup && password.length < 8) return setError(t('Use at least 8 characters for your password.'))
      if (!password) return setError(t('Enter your password.'))
    }
    setBusy(true)
    setError('')
    try {
      if (forgot) {
        await customerApi.forgotPassword(email.trim())
        setSent(true)
        setBusy(false)
        return
      }
      if (isSignup) await signup(name.trim(), email.trim(), password)
      else await login(email.trim(), password)
      onDone?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong. Please try again.'))
      setBusy(false)
    }
  }

  const switchTo = (m: AuthMode) => {
    setMode(m)
    setError('')
    setSent(false)
  }

  const label = `block text-sm font-semibold ${dark ? 'text-mint' : ''}`
  const input = `mt-1.5 h-12 w-full rounded-xl px-4 text-base font-normal text-ink outline-none placeholder:text-muted ${
    dark ? 'bg-white focus:ring-2 focus:ring-sun' : 'bg-cream focus:ring-2 focus:ring-brand'
  }`
  const link = `font-semibold underline underline-offset-2 ${dark ? 'text-white' : 'text-brand'}`

  if (forgot && sent)
    return (
      <div className={`space-y-4 text-center ${dark ? 'text-white' : ''}`} role="status">
        <MailCheck className={`mx-auto h-10 w-10 ${dark ? 'text-sun' : 'text-brand'}`} aria-hidden />
        <p className="font-semibold">{t('Check your email')}</p>
        <p className={`text-sm ${dark ? 'text-mint' : 'text-muted'}`}>
          {t('If {email} has an account, we’ve sent a link to choose a new password. It works for 1 hour.', { email: email.trim() })}
        </p>
        <button type="button" onClick={() => switchTo('login')} className={link}>
          {t('Back to log in')}
        </button>
      </div>
    )

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {forgot ? (
        <div className={dark ? 'text-white' : ''}>
          <p className="font-semibold">{t('Forgot your password?')}</p>
          <p className={`mt-1 text-sm ${dark ? 'text-mint' : 'text-muted'}`}>{t('Enter your email and we’ll send you a link to choose a new one.')}</p>
        </div>
      ) : (
        <div className={`grid grid-cols-2 rounded-full p-1 text-sm font-semibold ${dark ? 'bg-white/10' : 'bg-cream'}`}>
          {(['signup', 'login'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchTo(m)}
              className={`h-9 rounded-full transition ${
                mode === m ? (dark ? 'bg-white text-brand' : 'bg-white text-brand shadow-sm') : dark ? 'text-mint' : 'text-muted'
              }`}
            >
              {m === 'signup' ? t('Create account') : t('Log in')}
            </button>
          ))}
        </div>
      )}

      {isSignup && (
        <label className={label}>
          {t('Name')}
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder={t('Your first name')} className={input} />
        </label>
      )}
      <label className={label}>
        {t('Email')}
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('you@example.com')}
          className={input}
        />
      </label>
      {!forgot && (
        <label className={label}>
          {t('Password')}
          <span className="relative block">
            <input
              type={show ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? t('At least 8 characters') : ''}
              className={`${input} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? t('Hide password') : t('Show password')}
              className="absolute top-1/2 right-2 mt-0.5 -translate-y-1/2 rounded-full p-2 text-muted"
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className={`rounded-xl p-3 text-sm font-medium ${dark ? 'bg-white text-red-700' : 'bg-red-50 text-red-700'}`}>
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className={`w-full ${dark ? 'bg-white !text-brand hover:bg-mint' : ''}`}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : forgot ? t('Send reset link') : isSignup ? t('Create account') : t('Log in')}
      </Button>

      <p className={`text-center text-xs ${dark ? 'text-mint' : 'text-muted'}`}>
        {isSignup ? (
          <>
            {t('By creating an account you agree to our')}{' '}
            <a href={TERMS_URL} className="underline">
              {t('terms of service')}
            </a>{' '}
            {t('and')}{' '}
            <a href={PRIVACY_URL} className="underline">
              {t('privacy policy')}
            </a>
            .
          </>
        ) : forgot ? (
          <button type="button" onClick={() => switchTo('login')} className={link}>
            {t('Back to log in')}
          </button>
        ) : (
          <button type="button" onClick={() => switchTo('forgot')} className={link}>
            {t('Forgot your password?')}
          </button>
        )}
      </p>
    </form>
  )
}
