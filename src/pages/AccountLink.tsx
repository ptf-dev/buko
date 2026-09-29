import { CircleCheck, CircleX, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { DASHBOARD_URL } from '../config'
import { t } from '../i18n'
import { customerApi } from '../lib/api'
import { useAccount } from '../state/store'

/** Opened from the confirmation email: /verify?token=… */
export function VerifyEmail() {
  const [params] = useSearchParams()
  const { reload } = useAccount()
  const [state, setState] = useState<'working' | 'done' | 'error'>('working')
  const [error, setError] = useState('')
  const started = useRef(false)
  useEffect(() => {
    // Tokens work once: guard against React running the effect twice in development.
    if (started.current) return
    started.current = true
    customerApi
      .verifyEmail(params.get('token') ?? '')
      .then(() => {
        setState('done')
        reload()
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('Something went wrong. Please try again.'))
        setState('error')
      })
  }, [params, reload])
  return (
    <div className="min-h-full bg-cream">
      <PageHeader title={t('Confirm email')} />
      <div className="mx-4 mt-6 rounded-2xl bg-white p-6 text-center" role="status">
        {state === 'working' ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
        ) : state === 'done' ? (
          <>
            <CircleCheck className="mx-auto h-10 w-10 text-brand" aria-hidden />
            <p className="mt-3 text-lg font-bold">{t('Email confirmed')}</p>
            <p className="mt-1 text-sm text-muted">{t('Thanks! Your receipts will arrive at this address.')}</p>
          </>
        ) : (
          <>
            <CircleX className="mx-auto h-10 w-10 text-red-600" aria-hidden />
            <p className="mt-3 font-semibold">{error}</p>
            <p className="mt-1 text-sm text-muted">{t('You can ask for a new link in your profile.')}</p>
          </>
        )}
        {state !== 'working' && (
          <Link to="/" className="mt-5 inline-block">
            <Button>{t('Open Ngopu')}</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

/** Opened from the password-reset email: /reset?token=… */
export function ResetPassword() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<null | string>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError(t('Use at least 8 characters for your password.'))
    setBusy(true)
    setError('')
    try {
      const r = await customerApi.resetPassword(params.get('token') ?? '', password)
      setDone(r.role)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-cream">
      <PageHeader title={t('New password')} />
      <div className="mx-4 mt-6 rounded-2xl bg-white p-6">
        {done ? (
          <div className="text-center" role="status">
            <CircleCheck className="mx-auto h-10 w-10 text-brand" aria-hidden />
            <p className="mt-3 text-lg font-bold">{t('Password changed')}</p>
            <p className="mt-1 text-sm text-muted">{t('You’ve been logged out everywhere. Log in with your new password.')}</p>
            {done === 'customer' ? (
              <Link to="/profile" className="mt-5 inline-block">
                <Button>{t('Log in')}</Button>
              </Link>
            ) : (
              <a href={DASHBOARD_URL} className="mt-5 inline-block">
                <Button>{t('Go to the dashboard')}</Button>
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <label className="block text-sm font-semibold">
              {t('Choose a new password')}
              <span className="relative block">
                <input
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('At least 8 characters')}
                  className="mt-1.5 h-12 w-full rounded-xl bg-cream px-4 pr-12 text-base font-normal outline-none focus:ring-2 focus:ring-brand"
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
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t('Save new password')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
