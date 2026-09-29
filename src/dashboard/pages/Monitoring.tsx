import { Bug, CheckCircle2, Mail } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../lib/api'
import { BarChart } from '../BarChart'
import { useResource, useToast } from '../data'
import { Btn, Empty, ErrorState, Kpi, PageSkeleton, PageTitle, Panel, Pill, Segmented } from '../ui'

interface ErrorEvent {
  fingerprint: string
  source: 'app' | 'dashboard' | 'api'
  message: string
  stack: string | null
  url: string | null
  userAgent: string | null
  release: string | null
  count: number
  firstSeen: string
  lastSeen: string
  resolvedAt: string | null
}

interface MonitoringData {
  days: number
  errors: ErrorEvent[]
  daily: { day: string; sessions: number; store_views: number; orders: number }[]
  funnel: { name: string; sessions: number }[]
  platforms: { platform: string; sessions: number }[]
  pages: { path: string; views: number }[]
  email: { kind: string; status: 'sent' | 'failed' | 'not_configured'; n: number }[]
  emailFailures: { kind: string; to: string; error: string | null; at: string }[]
  emailConfigured: boolean
}

const FUNNEL: { name: string; label: string }[] = [
  { name: 'app_open', label: 'Opened the app' },
  { name: 'store_view', label: 'Looked at a store' },
  { name: 'checkout_open', label: 'Started checkout' },
  { name: 'order_placed', label: 'Placed an order' },
  { name: 'payment_succeeded', label: 'Paid by card' },
]

const EMAIL_KIND: Record<string, string> = {
  verify_email: 'Email confirmation',
  reset_password: 'Password reset',
  receipt: 'Order receipt',
  store_cancelled: 'Store cancelled',
  password_changed: 'Password changed',
  test: 'Test email',
}

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

/** Errors from the apps and the API, and anonymous usage: visits, the order funnel, platforms and email delivery. */
export function AdminMonitoring() {
  const [days, setDays] = useState<'7' | '14' | '30'>('14')
  const { data, error, loading, reload } = useResource<MonitoringData>(`admin/monitoring?days=${days}`, 60_000)
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; to: string } | null>(null)
  const sendTest = async () => {
    setTesting(true)
    try {
      setTestResult(await api('admin/monitoring/test-email', { method: 'POST', json: {} }))
      reload()
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Could not send.', to: '' })
    } finally {
      setTesting(false)
    }
  }

  const resolve = async (e: ErrorEvent) => {
    try {
      await api(`admin/monitoring/errors/${e.fingerprint}/resolve`, { method: 'POST', json: {} })
      toast('Marked as fixed. It comes back if it happens again.')
      reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update.', 'error')
    }
  }

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />

  const openErrors = data.errors.filter((e) => !e.resolvedAt)
  const funnel = FUNNEL.map((f) => ({ ...f, sessions: data.funnel.find((x) => x.name === f.name)?.sessions ?? 0 }))
  const top = funnel[0]!.sessions || 1
  const totalSessions = data.daily.reduce((a, d) => a + d.sessions, 0)
  const totalOrders = data.daily.reduce((a, d) => a + d.orders, 0)
  const failedMail = data.email.filter((m) => m.status === 'failed').reduce((a, m) => a + m.n, 0)
  const unsentMail = data.email.filter((m) => m.status === 'not_configured').reduce((a, m) => a + m.n, 0)

  return (
    <>
      <PageTitle
        title="Monitoring"
        subtitle="Errors from the app, dashboard and server, and anonymous usage. No cookies or personal data: a visit is a random id per app launch."
        actions={
          <Segmented
            label="Period"
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '7 days' },
              { value: '14', label: '14 days' },
              { value: '30', label: '30 days' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="App visits" value={totalSessions.toLocaleString('en-GB')} />
        <Kpi label="Orders placed" value={totalOrders.toLocaleString('en-GB')} />
        <Kpi label="Open errors" value={openErrors.length} emphasis={openErrors.length > 0} />
        <Kpi label="Emails not delivered" value={failedMail + unsentMail}>
          {unsentMail > 0 && <p className="mt-1 text-xs text-muted">{unsentMail} not sent: email isn’t set up (SMTP)</p>}
        </Kpi>
      </div>

      <Panel className="mt-5" title="Errors">
        {data.errors.length === 0 ? (
          <Empty icon={<CheckCircle2 className="h-6 w-6" />} title="No errors" text="Crashes in the app or dashboard and server errors show up here, grouped and counted." />
        ) : (
          <ul className="divide-y divide-line/70">
            {data.errors.map((e) => (
              <li key={e.fingerprint} className={`py-3 ${e.resolvedAt ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === e.fingerprint ? null : e.fingerprint)} aria-expanded={open === e.fingerprint}>
                    <p className="flex flex-wrap items-center gap-2">
                      <Pill tone={e.source === 'api' ? 'bad' : 'warn'}>{e.source === 'api' ? 'Server' : e.source === 'app' ? 'App' : 'Dashboard'}</Pill>
                      <span className="font-mono text-sm break-all">{e.message}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {e.count}× · last {when(e.lastSeen)} · first {when(e.firstSeen)}
                      {e.url ? ` · ${e.url}` : ''}
                      {e.release ? ` · ${e.release}` : ''}
                      {e.resolvedAt ? ' · marked fixed' : ''}
                    </p>
                  </button>
                  {!e.resolvedAt && (
                    <Btn size="sm" variant="secondary" onClick={() => resolve(e)}>
                      Mark fixed
                    </Btn>
                  )}
                </div>
                {open === e.fingerprint && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-cream p-3 text-xs whitespace-pre-wrap">
                    {e.stack ?? 'No stack trace.'}
                    {e.userAgent ? `\n\n${e.userAgent}` : ''}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="App visits per day">
          <BarChart data={data.daily.map((d) => ({ key: d.day, label: d.day.slice(5).replace('-', '/'), value: d.sessions }))} format={(v) => String(v)} unit="visits" />
        </Panel>
        <Panel title="From visit to order">
          <ol className="space-y-3">
            {funnel.map((f) => (
              <li key={f.name}>
                <div className="flex justify-between text-sm">
                  <span>{f.label}</span>
                  <span className="font-semibold tabular-nums">
                    {f.sessions} <span className="font-normal text-muted">({Math.round((f.sessions / top) * 100)}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line/60">
                  <div className="h-full rounded-full bg-[#10957f]" style={{ width: `${(f.sessions / top) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">Visits that reached each step, in the chosen period.</p>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Platforms">
          {data.platforms.length === 0 ? (
            <p className="text-sm text-muted">No visits yet.</p>
          ) : (
            <ul className="space-y-2 text-[15px]">
              {data.platforms.map((p) => (
                <li key={p.platform} className="flex justify-between">
                  <span>{p.platform === 'web' ? 'Web' : p.platform === 'android' ? 'Android app' : p.platform === 'ios' ? 'iPhone app' : p.platform}</span>
                  <span className="font-semibold tabular-nums">{p.sessions}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Most viewed screens">
          {data.pages.length === 0 ? (
            <p className="text-sm text-muted">No views yet.</p>
          ) : (
            <ul className="space-y-2 text-[15px]">
              {data.pages.map((p) => (
                <li key={p.path} className="flex justify-between gap-3">
                  <span className="truncate font-mono text-sm">{p.path}</span>
                  <span className="font-semibold tabular-nums">{p.views}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Emails"
          action={
            <Btn size="sm" variant="secondary" loading={testing} onClick={sendTest}>
              Send test email
            </Btn>
          }
        >
          {testResult && (
            <p role="status" className={`mb-3 rounded-xl px-3 py-2 text-sm ${testResult.ok ? 'bg-brand-light text-brand-dark' : 'bg-red-50 text-red-800'}`}>
              {testResult.ok ? `Sent to ${testResult.to}. Check the inbox (and spam).` : `Not sent: ${testResult.error}`}
            </p>
          )}
          {!data.emailConfigured && <p className="mb-3 text-sm text-muted">Email isn’t set up yet (SMTP settings missing).</p>}
          {data.email.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Mail className="h-4 w-4" aria-hidden /> No emails in this period.
            </p>
          ) : (
            <ul className="space-y-2 text-[15px]">
              {data.email.map((m) => (
                <li key={`${m.kind}-${m.status}`} className="flex items-center justify-between gap-3">
                  <span>{EMAIL_KIND[m.kind] ?? m.kind}</span>
                  <span className="flex items-center gap-2">
                    <Pill tone={m.status === 'sent' ? 'good' : m.status === 'failed' ? 'bad' : 'warn'}>
                      {m.status === 'sent' ? 'Sent' : m.status === 'failed' ? 'Failed' : 'Not set up'}
                    </Pill>
                    <span className="font-semibold tabular-nums">{m.n}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.emailFailures.length > 0 && (
            <div className="mt-4 border-t border-line/70 pt-3">
              <p className="text-sm font-semibold">Latest failures</p>
              <ul className="mt-2 space-y-2">
                {data.emailFailures.map((f, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-muted">
                      {when(f.at)} · {EMAIL_KIND[f.kind] ?? f.kind} → {f.to}
                    </span>
                    <span className="mt-0.5 block font-mono break-all text-red-800">{f.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs text-muted">
        <Bug className="h-3.5 w-3.5" aria-hidden /> Errors are kept until marked fixed; a fixed error reopens if it happens again.
      </p>
    </>
  )
}
