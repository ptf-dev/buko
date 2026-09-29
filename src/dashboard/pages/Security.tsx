import { Copy, KeyRound, ShieldCheck } from 'lucide-react'
import QRCode from 'qrcode'
import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAuth, useToast } from '../data'
import { AuthLayout } from '../Shell'
import { Btn, Field, Input, Panel } from '../ui'

/**
 * Two-factor setup: scan a QR code with an authenticator app (Google Authenticator, 1Password, Authy…),
 * confirm with a code, then save the recovery codes. Admins must finish this before using the dashboard.
 */
export function TwoFactorSetup({ onDone, required = false }: { onDone: () => void; required?: boolean }) {
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; qr: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<string[] | null>(null)
  const [saved, setSaved] = useState(false)

  const start = async () => {
    setError(null)
    setBusy(true)
    try {
      const r = await api<{ secret: string; otpauthUrl: string }>('auth/2fa/setup', { method: 'POST', json: {} })
      setSetup({ ...r, qr: await QRCode.toDataURL(r.otpauthUrl, { margin: 1, width: 220 }) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the setup.')
    } finally {
      setBusy(false)
    }
  }

  const enable = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ recoveryCodes: string[] }>('auth/2fa/enable', { method: 'POST', json: { code } })
      setRecovery(r.recoveryCodes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code didn’t work.')
    } finally {
      setBusy(false)
    }
  }

  if (recovery)
    return (
      <div>
        <h2 className="text-xl font-bold tracking-tight">Save your recovery codes</h2>
        <p className="mt-1.5 text-[15px] text-muted">
          If you lose your phone, each code lets you log in once. Keep them somewhere safe, like a password manager. They won’t be shown again.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-cream p-4 font-mono text-[15px]">
          {recovery.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn variant="secondary" onClick={() => navigator.clipboard?.writeText(recovery.join('\n'))}>
            <Copy className="h-4 w-4" /> Copy codes
          </Btn>
        </div>
        <label className="mt-5 flex items-center gap-2 text-[15px]">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 accent-[#00615f]" />
          I’ve saved my recovery codes
        </label>
        <Btn className="mt-4 w-full" disabled={!saved} onClick={onDone}>
          Continue
        </Btn>
      </div>
    )

  return (
    <div>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-light text-brand">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-xl font-bold tracking-tight">{required ? 'Turn on two-factor login' : 'Two-factor login'}</h2>
      <p className="mt-1.5 text-[15px] text-muted">
        {required
          ? 'Admin accounts can see money and personal data, so they need a code from your phone as well as your password.'
          : 'Ask for a code from your phone as well as your password when you log in.'}
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
      {!setup ? (
        <Btn className="mt-5 w-full" loading={busy} onClick={start}>
          <KeyRound className="h-4 w-4" /> Set up with an authenticator app
        </Btn>
      ) : (
        <form onSubmit={enable} className="mt-5 space-y-4" noValidate>
          <ol className="list-decimal space-y-1 pl-5 text-[15px]">
            <li>Open your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
            <li>Scan this code, or enter the key by hand.</li>
            <li>Type the 6-digit code it shows.</li>
          </ol>
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-cream p-4">
            <img src={setup.qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-lg bg-white" />
            <code className="text-sm break-all text-muted">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
          </div>
          <Field label="6-digit code">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="text-center font-mono text-lg tracking-[0.3em]"
              />
            )}
          </Field>
          <Btn type="submit" className="w-full" loading={busy} disabled={code.length !== 6}>
            Turn on
          </Btn>
        </form>
      )}
    </div>
  )
}

/** Full-screen gate shown to admins who haven't turned on two-factor login yet. */
export function RequireTwoFactor() {
  const { reload, logout } = useAuth()
  return (
    <AuthLayout>
      <div className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(16,40,38,0.06),0_16px_40px_-24px_rgba(16,40,38,0.3)] sm:p-8">
        <TwoFactorSetup required onDone={reload} />
      </div>
      <p className="mt-4 text-center text-sm">
        <button type="button" onClick={logout} className="font-semibold text-muted hover:text-ink">
          Log out
        </button>
      </p>
    </AuthLayout>
  )
}

/** Security panel on the partner's store page and the admin team page. */
export function SecurityPanel() {
  const { user, reload } = useAuth()
  const toast = useToast()
  const [setupOpen, setSetupOpen] = useState(false)
  const [off, setOff] = useState({ open: false, password: '', code: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!user) return null
  const enabled = user.twoFactor?.enabled
  const isAdmin = user.role === 'admin'

  const disable = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('auth/2fa/disable', { method: 'POST', json: { password: off.password, code: off.code } })
      toast('Two-factor login is off')
      setOff({ open: false, password: '', code: '' })
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn it off.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Login security">
      {setupOpen ? (
        <TwoFactorSetup
          onDone={() => {
            setSetupOpen(false)
            toast('Two-factor login is on')
            reload()
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Two-factor login {enabled ? 'is on' : 'is off'}</p>
            <p className="text-sm text-muted">
              {enabled
                ? isAdmin
                  ? 'Required for admins. If you lose your phone, use a recovery code or ask another admin to reset it.'
                  : 'You’ll be asked for a code from your authenticator app when you log in.'
                : 'Add a code from your phone to your password, so a leaked password isn’t enough to get in.'}
            </p>
          </div>
          {!enabled && <Btn onClick={() => setSetupOpen(true)}>Turn on</Btn>}
          {enabled && !isAdmin && !off.open && (
            <Btn variant="secondary" onClick={() => (setError(null), setOff({ ...off, open: true }))}>
              Turn off
            </Btn>
          )}
        </div>
      )}
      {off.open && (
        <form onSubmit={disable} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 sm:col-span-3">
              {error}
            </p>
          )}
          <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={off.password} onChange={(e) => setOff({ ...off, password: e.target.value })} />}</Field>
          <Field label="Code from your app">
            {(id) => <Input id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={11} value={off.code} onChange={(e) => setOff({ ...off, code: e.target.value })} />}
          </Field>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => setOff({ open: false, password: '', code: '' })}>
              Keep it on
            </Btn>
            <Btn type="submit" variant="danger" loading={busy} disabled={!off.password || !off.code}>
              Turn off
            </Btn>
          </div>
        </form>
      )}
    </Panel>
  )
}
