import { AlertTriangle, Banknote, CheckCircle2, Download, FileSpreadsheet, History, Landmark, MessageSquareWarning, Play } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { BarChart, shortDay } from '../BarChart'
import { useResource, useToast } from '../data'
import {
  COMPLAINT_REASON_LABELS,
  LEDGER_LABELS,
  minus,
  money,
  shortDate,
  signedMoney,
  sold,
  type AdminFinanceOverview,
  type Balance,
  type Billing,
  type Complaint,
  type ComplaintStatus,
  type FinanceSettings,
  type LedgerLine,
  type Payout,
  type Terms,
} from '../money'
import {
  Breakdown,
  Btn,
  ComplaintBadge,
  ConfirmBtn,
  DataTable,
  Delta,
  Dialog,
  Empty,
  ErrorState,
  Field,
  Input,
  Kpi,
  PageSkeleton,
  PageTitle,
  Panel,
  PayoutBadge,
  Pill,
  Segmented,
  Select,
  Switch,
  TextArea,
  type Column,
} from '../ui'

/* Section tabs ------------------------------------------------------------ */

function FinanceTabs() {
  const tabs = [
    { to: '/admin/finance', label: 'Overview', end: true },
    { to: '/admin/finance/payouts', label: 'Payouts' },
    { to: '/admin/finance/complaints', label: 'Complaints' },
    { to: '/admin/finance/stores', label: 'Store billing' },
    { to: '/admin/finance/settings', label: 'Settings & exports' },
  ]
  return (
    <nav aria-label="Finance sections" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-1 rounded-xl bg-[#ece9e2] p-1">
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                  isActive ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-muted hover:text-ink'
                }`
              }
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function FinancePage({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageTitle title={title} subtitle={subtitle} actions={actions} />
      <FinanceTabs />
      {children}
    </>
  )
}

const percent = (v: number) => `${(v * 100).toFixed(1)}%`

/* Overview ---------------------------------------------------------------- */

export function AdminFinance() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const [metric, setMetric] = useState<'revenue' | 'sales'>('revenue')
  const { data, error, loading, reload } = useResource<AdminFinanceOverview>(`admin/finance?days=${days}`, 60_000)
  const navigate = useNavigate()

  const body = () => {
    if (loading) return <PageSkeleton />
    if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />
    const { summary: s, previous: p, totals, counts } = data
    const closed = s.orders.collected + s.orders.no_show
    const alerts = [
      counts.open_complaints && { to: '/admin/finance/complaints', text: `${counts.open_complaints} complaint${counts.open_complaints > 1 ? 's' : ''} to decide` },
      counts.pending_bank && { to: '/admin/finance/stores', text: `${counts.pending_bank} bank detail${counts.pending_bank > 1 ? 's' : ''} to check` },
      counts.draft_payouts && { to: '/admin/finance/payouts', text: `${counts.draft_payouts} payout${counts.draft_payouts > 1 ? 's' : ''} waiting for approval` },
      counts.approved_payouts && { to: '/admin/finance/payouts', text: `${counts.approved_payouts} approved payout${counts.approved_payouts > 1 ? 's' : ''} to send` },
      counts.missing_bank && { to: '/admin/finance/stores', text: `${counts.missing_bank} active store${counts.missing_bank > 1 ? 's' : ''} without bank details` },
    ].filter(Boolean) as { to: string; text: string }[]

    const balanceColumns: Column<Balance & { id: string }>[] = [
      { key: 'store', header: 'Store', sort: (b) => b.name, render: (b) => <span className="font-medium">{b.name}{b.branch ? ` – ${b.branch}` : ''}</span> },
      { key: 'owed', header: 'Owed', align: 'right', sort: (b) => b.owed, render: (b) => <span className="font-semibold">{money(b.owed)}</span> },
      { key: 'payable', header: 'Payable now', align: 'right', sort: (b) => b.payable, render: (b) => money(b.payable) },
      { key: 'pending', header: 'On hold', align: 'right', sort: (b) => b.pending, render: (b) => money(b.pending) },
      { key: 'inpayout', header: 'In a payout', align: 'right', sort: (b) => b.in_payout, render: (b) => money(b.in_payout) },
    ]

    return (
      <>
        {alerts.length > 0 && (
          <ul className="mb-5 flex flex-wrap gap-2">
            {alerts.map((a) => (
              <li key={a.text}>
                <Link to={a.to} className="inline-flex items-center gap-2 rounded-xl bg-[#fff1cc] px-3 py-2 text-sm font-medium text-[#5c4000] hover:bg-[#ffe7a8]">
                  <AlertTriangle className="h-4 w-4" aria-hidden /> {a.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label={`Ngopu revenue · ${days} days`} value={money(s.net_revenue)} emphasis>
            <p className="mt-1 text-[13px] text-mint">Excl. VAT{data.settings.vatRegistered ? ` (${money(s.vat)} VAT)` : ''}</p>
          </Kpi>
          <Kpi label="Sales kept by customers" value={money(sold(s))}>
            <Delta current={sold(s)} previous={sold(p)} label={`vs previous ${days} days`} />
          </Kpi>
          <Kpi label="Take rate" value={percent(s.take_rate)}>
            <p className="mt-1 text-[13px] text-muted">Commission ÷ sales</p>
          </Kpi>
          <Kpi label="Owed to stores" value={money(totals.owed)}>
            <p className="mt-1 text-[13px] text-muted">
              {totals.owed < 0 ? 'Stores owe Ngopu fees, taken from their next sales' : `${money(totals.payable)} payable · ${money(totals.pending)} on hold`}
            </p>
          </Kpi>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Panel
            title={metric === 'revenue' ? 'Ngopu revenue per day' : 'Sales per day'}
            action={
              <Segmented
                label="Chart"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'revenue', label: 'Revenue' },
                  { value: 'sales', label: 'Sales' },
                ]}
              />
            }
          >
            <BarChart
              data={data.series.map((d) => ({ key: d.day, label: shortDay(d.day), value: Math.max(0, metric === 'revenue' ? d.revenue : d.sales) / 100 }))}
              format={(v) => money(v * 100)}
              unit={metric}
            />
          </Panel>
          <Panel title={`Breakdown · ${days} days`}>
            <Breakdown
              rows={[
                { label: 'Bags sold', value: money(s.gross) },
                { label: 'Cancelled and refunded', value: minus(s.cancelled), muted: true },
                { label: 'Complaint refunds (stores)', value: minus(s.complaint_refunds), muted: true },
                { label: 'Commission', value: money(s.commission) },
                { label: 'Membership fees', value: money(s.membership) },
                { label: 'Refunds paid by Ngopu', value: minus(s.goodwill), muted: true },
                { label: 'Adjustments to stores', value: signedMoney(-s.adjustments), muted: true },
                ...(data.settings.vatRegistered ? [{ label: 'VAT owed', value: minus(s.vat), muted: true }] : []),
                { label: 'Ngopu revenue', value: money(s.net_revenue), strong: true },
              ]}
            />
            <p className="mt-3 text-[13px] text-muted">
              No-show rate {closed ? percent(s.orders.no_show / closed) : '—'} · {s.orders.cancelled_customer} cancelled by customers ·{' '}
              {s.orders.cancelled_store} by stores · {s.orders.complaints} complaints
            </p>
          </Panel>
        </div>

        <Panel
          className="mt-5"
          title="Money owed to stores"
          action={
            <span className="text-sm text-muted">
              Next payout {shortDate(data.nextPayoutAt)} ·{' '}
              <Link to="/admin/finance/payouts" className="font-medium text-brand hover:underline">
                Payouts
              </Link>
            </span>
          }
        >
          <DataTable
            rows={data.balances.map((b) => ({ ...b, id: b.store_id }))}
            columns={balanceColumns}
            initialSort={{ key: 'owed', dir: 'desc' }}
            onRowClick={(b) => navigate(`/admin/partners/${b.store_id}?tab=money`)}
            empty={<Empty icon={<Banknote className="h-6 w-6" />} title="Nothing owed" text="Store balances appear here after the first sales." />}
          />
          <p className="mt-3 text-[13px] text-muted">Real money only. Sample data from the demo loader is shown in the totals above but never paid out.</p>
        </Panel>
      </>
    )
  }

  return (
    <FinancePage
      title="Finance"
      subtitle="Sales, Ngopu’s revenue and what’s owed to stores. Payments are simulated until the card provider is connected."
      actions={
        <Segmented
          label="Period"
          value={days}
          onChange={setDays}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
        />
      }
    >
      {body()}
    </FinancePage>
  )
}

/* Payouts ----------------------------------------------------------------- */

interface RunResult {
  runId: string
  payouts: { id: string; name: string; amount: number }[]
  skipped: { storeId: string; name: string; branch: string | null; amount: number; reason: string }[]
  membershipsCharged: number
}

export function AdminPayouts() {
  const { data, error, loading, reload } = useResource<{ payouts: Payout[] }>('admin/finance/payouts')
  const toast = useToast()
  const [building, setBuilding] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [paying, setPaying] = useState<Payout | null>(null)

  const runs = useMemo(() => {
    const map = new Map<string, Payout[]>()
    for (const p of data?.payouts ?? []) map.set(p.runId, [...(map.get(p.runId) ?? []), p])
    return [...map.entries()].map(([id, payouts]) => ({ id, payouts, createdAt: payouts[0]!.createdAt }))
  }, [data])

  const build = async () => {
    setBuilding(true)
    try {
      const r = await api<RunResult>('admin/finance/payouts/run', { method: 'POST', json: {} })
      setResult(r)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not build the run.', 'error')
    } finally {
      setBuilding(false)
    }
  }
  const act = async (path: string, done: string) => {
    try {
      await api(path, { method: 'POST', json: {} })
      toast(done)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong.', 'error')
    }
  }

  return (
    <FinancePage
      title="Payouts"
      subtitle="Build a run, approve it, send the bank file, then mark each payout paid with the bank reference."
      actions={
        <Btn onClick={build} loading={building}>
          <Play className="h-4 w-4" aria-hidden /> Build payout run
        </Btn>
      }
    >
      {result && (
        <Panel className="mb-5" title="New run" action={<Btn variant="ghost" size="sm" onClick={() => setResult(null)}>Dismiss</Btn>}>
          <p className="text-[15px]">
            {result.payouts.length
              ? `${result.payouts.length} draft payout${result.payouts.length > 1 ? 's' : ''} for ${money(result.payouts.reduce((a, p) => a + p.amount, 0))}.`
              : 'No store is ready for a payout right now.'}
            {result.membershipsCharged ? ` ${result.membershipsCharged} membership fee${result.membershipsCharged > 1 ? 's' : ''} charged.` : ''}
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-3 divide-y divide-line/70 text-sm">
              {result.skipped.map((s) => (
                <li key={s.storeId} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-medium">
                    {s.name}
                    {s.branch ? ` – ${s.branch}` : ''} <span className="font-normal text-muted">{money(s.amount)}</span>
                  </span>
                  <span className="text-muted">{s.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {loading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !runs.length ? (
        <Panel>
          <Empty icon={<Banknote className="h-6 w-6" />} title="No payouts yet" text="Build a run to pay every store whose money is past the hold period and above the minimum." />
        </Panel>
      ) : (
        <div className="space-y-5">
          {runs.map((run) => {
            const live = run.payouts.filter((p) => p.status !== 'cancelled')
            const drafts = run.payouts.filter((p) => p.status === 'draft').length
            const approved = run.payouts.filter((p) => p.status === 'approved').length
            const columns: Column<Payout>[] = [
              { key: 'store', header: 'Store', render: (p) => <span className="font-medium">{p.storeName}{p.branch ? ` – ${p.branch}` : ''}</span> },
              { key: 'bank', header: 'Account', render: (p) => <span className="text-muted">{p.legalName} · {p.iban}</span> },
              { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-semibold">{money(p.amount)}</span> },
              { key: 'status', header: 'Status', render: (p) => <PayoutBadge status={p.status} /> },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (p) => (
                  <span className="inline-flex items-center justify-end gap-1">
                    <a href={`/api/admin/finance/payouts/${p.id}/statement?format=csv`} className="rounded-lg px-2 py-1 text-sm font-medium text-brand hover:bg-brand-light">
                      Statement
                    </a>
                    {p.status === 'draft' && <Btn size="sm" variant="secondary" onClick={() => act(`admin/finance/payouts/${p.id}/approve`, 'Payout approved')}>Approve</Btn>}
                    {p.status === 'approved' && <Btn size="sm" onClick={() => setPaying(p)}>Mark paid</Btn>}
                    {p.status === 'paid' && <span className="px-2 text-sm text-muted">Ref {p.bankReference}</span>}
                    {(p.status === 'draft' || p.status === 'approved') && (
                      <ConfirmBtn label="Cancel" confirmLabel="Cancel payout" onConfirm={() => act(`admin/finance/payouts/${p.id}/cancel`, 'Payout cancelled; the money rolls into the next run')} />
                    )}
                  </span>
                ),
              },
            ]
            return (
              <Panel
                key={run.id}
                title={
                  <span>
                    Run of {shortDate(run.createdAt)}{' '}
                    <span className="font-normal text-muted">
                      · {live.length} payout{live.length === 1 ? '' : 's'} · {money(live.reduce((a, p) => a + p.amount, 0))}
                    </span>
                  </span>
                }
                action={
                  <span className="flex flex-wrap gap-2">
                    {drafts > 0 && (
                      <Btn size="sm" variant="secondary" onClick={() => act(`admin/finance/runs/${run.id}/approve`, `${drafts} payouts approved`)}>
                        <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve all ({drafts})
                      </Btn>
                    )}
                    {approved > 0 && (
                      <a href={`/api/admin/finance/runs/${run.id}/bank-file`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-dark">
                        <Download className="h-4 w-4" aria-hidden /> Bank file
                      </a>
                    )}
                  </span>
                }
              >
                <DataTable rows={run.payouts} columns={columns} />
              </Panel>
            )
          })}
        </div>
      )}
      {paying && <MarkPaidDialog payout={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); reload() }} />}
    </FinancePage>
  )
}

function MarkPaidDialog({ payout, onClose, onDone }: { payout: Payout; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`admin/finance/payouts/${payout.id}/paid`, { method: 'POST', json: { reference: ref } })
      toast('Marked as paid')
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog title={`Mark ${money(payout.amount)} to ${payout.storeName} as paid`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">
          Only after the bank has sent it to {payout.legalName} ({payout.iban}). The store sees the reference on its statement.
        </p>
        <Field label="Bank transfer reference">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} required autoFocus />}</Field>
        <div className="flex gap-2">
          <Btn type="submit" loading={busy} disabled={!ref.trim()}>
            Mark paid
          </Btn>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </form>
    </Dialog>
  )
}

/* Complaints -------------------------------------------------------------- */

export function AdminComplaints() {
  const [status, setStatus] = useState<ComplaintStatus | 'all'>('open')
  const { data, error, loading, reload } = useResource<{ complaints: Complaint[] }>(`admin/complaints${status === 'all' ? '' : `?status=${status}`}`, 60_000)
  const [deciding, setDeciding] = useState<Complaint | null>(null)
  return (
    <FinancePage title="Complaints" subtitle="Customers can report a problem up to 24 hours after pickup. Decide each one here.">
      <div className="mb-4">
        <Segmented
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'refunded', label: 'Refunded' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      {loading ? (
        <PageSkeleton />
      ) : error || !data ? (
        <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />
      ) : !data.complaints.length ? (
        <Panel>
          <Empty icon={<MessageSquareWarning className="h-6 w-6" />} title={status === 'open' ? 'No open complaints' : 'Nothing here'} text="New complaints from the app appear here." />
        </Panel>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.complaints.map((k) => (
            <li key={k.id}>
              <Panel>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{COMPLAINT_REASON_LABELS[k.reason] ?? k.reason}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {k.storeName} · {k.customerName ?? 'Deleted account'} · {shortDate(k.createdAt)}
                    </p>
                  </div>
                  <ComplaintBadge status={k.status} />
                </div>
                {k.details && <p className="mt-3 rounded-xl bg-cream p-3 text-[15px] leading-relaxed">“{k.details}”</p>}
                <p className="mt-3 text-sm text-muted">
                  Order {k.order.pickupCode} · {k.order.quantity} × {k.order.unitPrice} L = {money(k.order.total)} · collected {shortDate(k.order.collectedAt)}
                </p>
                {k.status === 'refunded' && (
                  <p className="mt-1 text-sm">
                    Refunded {money(k.refundAmount ?? 0)}, paid by {k.fundedBy === 'ngopu' ? 'Ngopu' : 'the store'}
                  </p>
                )}
                {k.resolutionNote && <p className="mt-1 text-sm text-muted">Note: {k.resolutionNote}</p>}
                {k.status === 'open' && (
                  <Btn className="mt-4" size="sm" onClick={() => setDeciding(k)}>
                    Decide
                  </Btn>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      )}
      {deciding && <DecideDialog complaint={deciding} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); reload() }} />}
    </FinancePage>
  )
}

function DecideDialog({ complaint: k, onClose, onDone }: { complaint: Complaint; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [action, setAction] = useState<'refund' | 'reject'>('refund')
  const [amount, setAmount] = useState(String(k.order.total / 100))
  const [fundedBy, setFundedBy] = useState<'store' | 'ngopu'>('store')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`admin/complaints/${k.id}/resolve`, { method: 'POST', json: action === 'refund' ? { action, amount: Number(amount), fundedBy, note } : { action, note } })
      toast(action === 'refund' ? 'Refund recorded' : 'Complaint rejected')
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog title={`${COMPLAINT_REASON_LABELS[k.reason] ?? k.reason} · ${k.storeName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Segmented
          label="Decision"
          value={action}
          onChange={setAction}
          options={[
            { value: 'refund', label: 'Refund' },
            { value: 'reject', label: 'Reject' },
          ]}
        />
        {action === 'refund' && (
          <>
            <Field label="Refund amount" hint={`Order total ${money(k.order.total)}. Partial refunds are fine.`}>
              {(id, d) => <Input id={id} aria-describedby={d} type="number" min={1} max={k.order.total / 100} step="1" suffix="L" value={amount} onChange={(e) => setAmount(e.target.value)} />}
            </Field>
            <Field
              label="Who pays"
              hint={fundedBy === 'store' ? 'Taken from the store’s balance; Ngopu returns its commission on the refunded part.' : 'Ngopu pays it as goodwill; the store keeps its money.'}
            >
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={fundedBy} onChange={(e) => setFundedBy(e.target.value as 'store' | 'ngopu')}>
                  <option value="store">The store</option>
                  <option value="ngopu">Ngopu (goodwill)</option>
                </Select>
              )}
            </Field>
          </>
        )}
        <Field label={action === 'reject' ? 'Reason (required)' : 'Note (optional)'} hint="The store sees this note.">
          {(id, d) => <TextArea id={id} aria-describedby={d} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <p className="text-[13px] text-muted">The refund to the customer’s card is sent automatically once card payments are live.</p>
        <div className="flex gap-2">
          <Btn type="submit" loading={busy} disabled={action === 'reject' && !note.trim()} variant={action === 'reject' ? 'danger' : 'primary'}>
            {action === 'refund' ? `Refund ${money(Math.round(Number(amount || 0) * 100))}` : 'Reject complaint'}
          </Btn>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </form>
    </Dialog>
  )
}

/* Store billing ----------------------------------------------------------- */

interface BillingRow {
  storeId: string
  name: string
  branch: string | null
  status: string
  billing: Billing
  terms: Terms
}

export function AdminBilling() {
  const { data, error, loading, reload } = useResource<{ stores: BillingRow[] }>('admin/finance/billing')
  const toast = useToast()
  const navigate = useNavigate()
  const review = async (storeId: string, action: 'approve' | 'reject') => {
    try {
      await api(`admin/stores/${storeId}/billing/review`, { method: 'POST', json: { action } })
      toast(action === 'approve' ? 'Bank details approved. Payouts can use them in 48 hours.' : 'Bank details rejected')
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong.', 'error')
    }
  }
  const pending = (data?.stores ?? []).filter((s) => s.billing.pending)
  const columns: Column<BillingRow & { id: string }>[] = [
    { key: 'store', header: 'Store', sort: (r) => r.name, render: (r) => <span className="font-medium">{r.name}{r.branch ? ` – ${r.branch}` : ''}</span> },
    {
      key: 'terms',
      header: 'Commission',
      render: (r) => (
        <span>
          {r.terms.commissionPercent}% · min {r.terms.commissionMinLek} L {r.terms.custom && <Pill tone="info">Custom</Pill>}
        </span>
      ),
    },
    {
      key: 'bank',
      header: 'Bank details',
      render: (r) =>
        r.billing.pending ? <Pill tone="warn">To check</Pill> : r.billing.iban ? <span className="text-muted">{r.billing.legalName} · {r.billing.iban}</span> : <Pill tone="bad">Missing</Pill>,
    },
    { key: 'member', header: 'Membership until', render: (r) => <span className="text-muted">{r.billing.membershipPaidUntil ? shortDate(r.billing.membershipPaidUntil) : 'Free year not started'}</span> },
    { key: 'paused', header: 'Payouts', render: (r) => (r.billing.payoutsPaused ? <Pill tone="bad">Paused</Pill> : <Pill tone="good">On</Pill>) },
  ]
  return (
    <FinancePage title="Store billing" subtitle="Bank details to check, commission terms and membership per store. Open a store to change its terms.">
      {loading ? (
        <PageSkeleton />
      ) : error || !data ? (
        <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />
      ) : (
        <>
          {pending.length > 0 && (
            <Panel className="mb-5" title={`Bank details to check (${pending.length})`}>
              <p className="mb-3 text-sm text-muted">Compare with the store’s QKB registration and a bank document before approving. Wrong details send money to the wrong account.</p>
              <ul className="divide-y divide-line/70">
                {pending.map((r) => (
                  <li key={r.storeId} className="flex flex-wrap items-center gap-4 py-3">
                    <Landmark className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">
                        {r.name}
                        {r.branch ? ` – ${r.branch}` : ''}
                      </p>
                      <p className="mt-0.5">
                        {r.billing.pending!.legalName} · NIPT {r.billing.pending!.nipt}
                      </p>
                      <p className="mt-0.5 font-mono tracking-wide">{r.billing.pending!.iban.replace(/(.{4})/g, '$1 ').trim()}</p>
                      {r.billing.iban && <p className="mt-0.5 text-muted">Replaces {r.billing.iban}</p>}
                    </div>
                    <span className="flex gap-2">
                      <Btn size="sm" onClick={() => review(r.storeId, 'approve')}>
                        Approve
                      </Btn>
                      <ConfirmBtn label="Reject" confirmLabel="Reject details" onConfirm={() => review(r.storeId, 'reject')} />
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="All stores">
            <DataTable rows={data.stores.map((s) => ({ ...s, id: s.storeId }))} columns={columns} onRowClick={(r) => navigate(`/admin/partners/${r.storeId}?tab=money`)} />
          </Panel>
        </>
      )}
    </FinancePage>
  )
}

/* Settings, exports, audit ------------------------------------------------ */

export function AdminFinanceSettings() {
  const { data, error, loading, reload } = useResource<{ settings: FinanceSettings }>('admin/finance/settings')
  const audit = useResource<{ entries: { id: string; action: string; target: string | null; details: unknown; createdAt: string; actor: string | null }[] }>('admin/finance/audit')
  return (
    <FinancePage title="Settings & exports" subtitle="Platform money terms, monthly files for the accountant, and a log of every money action.">
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {loading ? <PageSkeleton /> : error || !data ? <ErrorState message={error ?? 'Unknown error'} onRetry={reload} /> : <SettingsForm settings={data.settings} onSaved={reload} />}
        <ExportsPanel />
      </div>
      <Panel className="mt-5" title="Money log">
        {audit.data?.entries.length ? (
          <ul className="divide-y divide-line/70 text-sm">
            {audit.data.entries.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
                <span className="w-36 shrink-0 text-muted tabular-nums">{new Date(a.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className="font-medium">{a.actor ?? 'System'}</span>
                <span>{AUDIT_LABELS[a.action] ?? a.action}</span>
                {a.target && <span className="text-muted">{a.target}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<History className="h-6 w-6" />} title="No money actions yet" text="Payout runs, approvals, refunds, adjustments and settings changes are recorded here." />
        )}
      </Panel>
    </FinancePage>
  )
}

const AUDIT_LABELS: Record<string, string> = {
  'settings.update': 'changed finance settings',
  'payout.run': 'built a payout run',
  'payout.approve': 'approved payout',
  'payout.paid': 'marked payout paid',
  'payout.cancel': 'cancelled payout',
  'complaint.refund': 'refunded complaint',
  'complaint.reject': 'rejected complaint',
  'billing.submit': 'submitted bank details for',
  'billing.approve': 'approved bank details for',
  'billing.reject': 'rejected bank details for',
  'billing.terms': 'changed terms for',
  'ledger.adjustment': 'added an adjustment for',
  'order.store_cancel': 'cancelled order (store)',
}

function SettingsForm({ settings, onSaved }: { settings: FinanceSettings; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState(settings)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof FinanceSettings) => (e: { target: { value: string } }) => setF({ ...f, [k]: Number(e.target.value) })
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { payoutAnchor: _anchor, ...rest } = f
      void _anchor
      await api('admin/finance/settings', { method: 'PATCH', json: rest })
      toast('Settings saved. New terms apply to orders from now on.')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
    } finally {
      setBusy(false)
    }
  }
  const num = (k: keyof FinanceSettings, label: string, suffix: string, hint?: string) => (
    <Field label={label} hint={hint}>
      {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} step="any" suffix={suffix} value={String(f[k])} onChange={set(k)} />}
    </Field>
  )
  return (
    <Panel title="Money terms">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {num('commissionPercent', 'Commission', '%', 'Default for stores without custom terms')}
        {num('commissionMinLek', 'Minimum commission per bag', 'L')}
        {num('membershipFeeLek', 'Membership fee per year', 'L')}
        {num('membershipFreeMonths', 'Free months after approval', 'mo')}
        {num('holdDays', 'Hold before payout', 'days', 'Time to handle complaints')}
        {num('minPayoutLek', 'Minimum payout', 'L')}
        {num('payoutEveryDays', 'Payout every', 'days')}
        {num('noShowGraceMinutes', 'No-show after pickup ends', 'min')}
        {num('bankChangeHoldHours', 'Hold after new bank details', 'h')}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-cream p-3 sm:col-span-2">
          <div>
            <p className="font-medium">Ngopu is VAT-registered</p>
            <p className="text-[13px] text-muted">Commission and fees then include {f.vatRatePercent}% VAT, shown separately in reports.</p>
          </div>
          <Switch checked={f.vatRegistered} onChange={(v) => setF({ ...f, vatRegistered: v })} label="VAT registered" />
        </div>
        <p className="text-[13px] text-muted sm:col-span-2">Changes apply to orders closed from now on. Past ledger lines never change.</p>
        <div className="sm:col-span-2">
          <Btn type="submit" loading={busy}>
            Save settings
          </Btn>
        </div>
      </form>
    </Panel>
  )
}

function ExportsPanel() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const files = [
    { type: 'stores', label: 'Store summary', text: 'One row per store: sales, refunds, commission and VAT. The basis for commission invoices.' },
    { type: 'ledger', label: 'All money lines', text: 'Every ledger line in the month.' },
    { type: 'payouts', label: 'Payouts sent', text: 'Paid payouts with IBAN and bank reference.' },
  ]
  return (
    <Panel title="Monthly exports">
      <Field label="Month">{(id) => <Input id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
      <ul className="mt-4 space-y-3">
        {files.map((f) => (
          <li key={f.type} className="flex items-start gap-3">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <a href={`/api/admin/finance/export?month=${month}&type=${f.type}`} className="font-medium text-brand hover:underline">
                {f.label} (CSV)
              </a>
              <p className="text-[13px] text-muted">{f.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* Store money (partner detail page) --------------------------------------- */

interface StoreMoney {
  balance: Balance
  entries: LedgerLine[]
  billing: Billing
  terms: Terms
  payouts: Payout[]
  defaults: { commissionPercent: number; commissionMinLek: number; membershipFeeLek: number }
}

export function StoreMoneyPanel({ storeId }: { storeId: string }) {
  const { data, error, loading, reload } = useResource<StoreMoney>(`admin/stores/${storeId}/money`)
  const [dialog, setDialog] = useState<'terms' | 'adjust' | null>(null)
  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />
  const { balance: b, billing, terms } = data
  const columns: Column<LedgerLine>[] = [
    { key: 'date', header: 'Date', render: (l) => <span className="text-muted tabular-nums">{new Date(l.created_at).toLocaleDateString('en-GB')}</span> },
    { key: 'type', header: 'Type', render: (l) => <span>{LEDGER_LABELS[l.type] ?? l.type}{l.is_demo && <span className="ml-2"><Pill tone="neutral">Sample</Pill></span>}</span> },
    { key: 'store', header: 'Store', align: 'right', render: (l) => (l.store_delta ? signedMoney(l.store_delta) : '') },
    { key: 'ngopu', header: 'Ngopu', align: 'right', render: (l) => <span className="text-muted">{l.platform_delta ? signedMoney(l.platform_delta) : ''}</span> },
    { key: 'note', header: 'Note', render: (l) => <span className="text-muted">{l.note ?? (l.order_id ? `Order ${l.order_id.slice(0, 8)}` : '')}{l.created_by_name ? ` · ${l.created_by_name}` : ''}</span> },
  ]
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Owed to store" value={money(b.owed)} emphasis>
          <p className="mt-1 text-[13px] text-mint">Real money only</p>
        </Kpi>
        <Kpi label="Payable now" value={money(b.payable)} />
        <Kpi label="On hold" value={money(b.pending)} />
        <Kpi label="In a payout" value={money(b.in_payout)} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Terms" action={<span className="flex gap-1"><Btn size="sm" variant="ghost" onClick={() => setDialog('terms')}>Edit</Btn><Btn size="sm" variant="ghost" onClick={() => setDialog('adjust')}>Adjustment</Btn></span>}>
          <Breakdown
            rows={[
              { label: 'Commission', value: `${terms.commissionPercent}%${terms.custom ? ' (custom)' : ''}` },
              { label: 'Minimum per bag', value: `${terms.commissionMinLek} L` },
              { label: 'Membership', value: `${terms.membershipFeeLek.toLocaleString('en')} L / year` },
              { label: 'Membership covered until', value: billing.membershipPaidUntil ? shortDate(billing.membershipPaidUntil) : 'Free year starts at the next payout run', muted: true },
              { label: 'Payouts', value: billing.payoutsPaused ? 'Paused' : 'On' },
            ]}
          />
        </Panel>
        <Panel title="Bank details">
          {billing.iban ? (
            <Breakdown
              rows={[
                { label: 'Legal name', value: billing.legalName },
                { label: 'NIPT', value: billing.nipt },
                { label: 'IBAN', value: billing.iban },
                { label: 'Approved', value: shortDate(billing.verifiedAt), muted: true },
              ]}
            />
          ) : (
            <p className="text-sm text-muted">No approved bank details.</p>
          )}
          {billing.pending && (
            <p className="mt-3 text-sm">
              <Pill tone="warn">To check</Pill>{' '}
              <Link to="/admin/finance/stores" className="font-medium text-brand hover:underline">
                Review new details
              </Link>
            </p>
          )}
        </Panel>
      </div>
      <Panel className="mt-5" title="Money lines (latest 100)">
        <DataTable rows={data.entries} columns={columns} empty={<Empty icon={<Banknote className="h-6 w-6" />} title="No money lines yet" text="Sales, commission and payouts appear here." />} />
      </Panel>
      {dialog === 'terms' && <TermsDialog storeId={storeId} data={data} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload() }} />}
      {dialog === 'adjust' && <AdjustDialog storeId={storeId} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload() }} />}
    </>
  )
}

function TermsDialog({ storeId, data, onClose, onDone }: { storeId: string; data: StoreMoney; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [custom, setCustom] = useState(data.terms.custom)
  const [pct, setPct] = useState(String(data.terms.commissionPercent))
  const [min, setMin] = useState(String(data.terms.commissionMinLek))
  const [fee, setFee] = useState(String(data.terms.membershipFeeLek))
  const [until, setUntil] = useState(data.billing.membershipPaidUntil?.slice(0, 10) ?? '')
  const [paused, setPaused] = useState(data.billing.payoutsPaused)
  const [busy, setBusy] = useState(false)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`admin/stores/${storeId}/billing`, {
        method: 'PATCH',
        json: {
          commissionPercent: custom ? Number(pct) : null,
          commissionMinLek: custom ? Number(min) : null,
          membershipFeeLek: Number(fee) === data.defaults.membershipFeeLek ? null : Number(fee),
          membershipPaidUntil: until || null,
          payoutsPaused: paused,
        },
      })
      toast('Terms saved')
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog title="Store terms" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-cream p-3">
          <p className="text-sm">
            <span className="font-medium">Custom commission</span>
            <span className="block text-muted">Default: {data.defaults.commissionPercent}%, min {data.defaults.commissionMinLek} L a bag</span>
          </p>
          <Switch checked={custom} onChange={setCustom} label="Custom commission" />
        </div>
        {custom && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Commission">{(id) => <Input id={id} type="number" min={0} max={100} step="any" suffix="%" value={pct} onChange={(e) => setPct(e.target.value)} />}</Field>
            <Field label="Minimum per bag">{(id) => <Input id={id} type="number" min={0} step="any" suffix="L" value={min} onChange={(e) => setMin(e.target.value)} />}</Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Membership per year">{(id) => <Input id={id} type="number" min={0} step="any" suffix="L" value={fee} onChange={(e) => setFee(e.target.value)} />}</Field>
          <Field label="Membership covered until" hint="Empty: free year starts at the next run">
            {(id, d) => <Input id={id} aria-describedby={d} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />}
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-cream p-3">
          <p className="text-sm font-medium">Pause payouts to this store</p>
          <Switch checked={paused} onChange={setPaused} label="Pause payouts" />
        </div>
        <p className="text-[13px] text-muted">New terms apply to orders closed from now on.</p>
        <div className="flex gap-2">
          <Btn type="submit" loading={busy}>
            Save terms
          </Btn>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </form>
    </Dialog>
  )
}

function AdjustDialog({ storeId, onClose, onDone }: { storeId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const n = Number(amount)
      await api(`admin/stores/${storeId}/adjustments`, { method: 'POST', json: { amount: direction === 'credit' ? n : -n, reason } })
      toast('Adjustment added')
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog title="Adjustment" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Segmented
          label="Direction"
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'credit', label: 'Ngopu pays the store' },
            { value: 'debit', label: 'The store owes Ngopu' },
          ]}
        />
        <Field label="Amount">{(id) => <Input id={id} type="number" min={1} step="any" suffix="L" value={amount} onChange={(e) => setAmount(e.target.value)} required />}</Field>
        <Field label="Reason" hint="Required. The store sees it on its statement.">
          {(id, d) => <TextArea id={id} aria-describedby={d} value={reason} onChange={(e) => setReason(e.target.value)} required />}
        </Field>
        <div className="flex gap-2">
          <Btn type="submit" loading={busy} disabled={!Number(amount) || !reason.trim()}>
            Add adjustment
          </Btn>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </form>
    </Dialog>
  )
}
