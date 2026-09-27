import { Banknote, Download, FileText, Landmark, MessageSquareWarning, ReceiptText } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { BarChart, shortDay } from '../BarChart'
import { useResource, useToast } from '../data'
import { COMPLAINT_REASON_LABELS, minus, money, monthLabel, shortDate, type Billing, type Complaint, type PartnerEarnings, type Payout, type PaymentRequest, type Terms } from '../money'
import { Breakdown, Btn, ComplaintBadge, DataTable, Empty, ErrorState, Field, Input, Kpi, PageSkeleton, PageTitle, Panel, PayoutBadge, Pill, Switch, type Column } from '../ui'

export function PartnerEarnings() {
  const { data, error, loading, reload } = useResource<PartnerEarnings>('partner/earnings', 60_000)
  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />
  const { balance, summary: s, terms, policy, billing } = data
  const needsBank = !billing.iban && !billing.pending
  const nextAmount = balance.payable + balance.in_payout
  const paidCount = data.payouts.filter((p) => p.status === 'paid').length

  return (
    <>
      <PageTitle
        title="Earnings"
        subtitle={`What you’ve earned through Ngopu. Payouts go to your bank every ${policy.payoutEveryDays} days.`}
      />

      {needsBank && (
        <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[#fff1cc] p-4 text-[#5c4000]">
          <Landmark className="h-5 w-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 text-[15px]">
            <strong>Add your bank details to get paid.</strong> We check them within a working day.
          </p>
          <Btn size="sm" variant="secondary" onClick={() => document.getElementById('bank')?.scrollIntoView({ behavior: 'smooth' })}>
            Add bank details
          </Btn>
        </div>
      )}

      {data.requests
        .filter((r) => r.status === 'open')
        .map((r) => (
          <div key={r.id} role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[#fff1cc] p-4 text-[#5c4000]">
            <FileText className="h-5 w-5 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 text-[15px]">
              <strong>
                Payment request {r.number}: {money(r.amount)}
              </strong>{' '}
              due {shortDate(r.dueAt)}. Pay by bank transfer with reference {r.number}, or it’s taken from your next payouts.
            </p>
            <a href={`/api/partner/payment-requests/${r.id}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-xl bg-white px-3 text-sm font-semibold text-ink ring-1 ring-line hover:bg-cream">
              View and print
            </a>
          </div>
        ))}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Next payout" value={money(Math.max(0, nextAmount))} emphasis>
          <p className="mt-1 text-[13px] text-mint">
            {nextAmount < 0 ? `${money(-nextAmount)} in fees is taken from your next sales` : `Planned for ${shortDate(data.nextPayoutAt)}`}
          </p>
        </Kpi>
        <Kpi label="On hold" value={money(balance.pending)}>
          <p className="mt-1 text-[13px] text-muted">Released {policy.holdDays} days after pickup</p>
        </Kpi>
        <Kpi label="Your earnings · 30 days" value={money(s.store_net)}>
          <p className="mt-1 text-[13px] text-muted">After commission and refunds</p>
        </Kpi>
        <Kpi label="Paid to your bank · 30 days" value={money(s.paid_out)}>
          <p className="mt-1 text-[13px] text-muted">{paidCount} payout{paidCount === 1 ? '' : 's'} in total</p>
        </Kpi>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Your earnings per day · last 30 days">
          <BarChart
            data={data.series.map((d) => ({ key: d.day, label: shortDay(d.day), value: Math.max(0, d.store_net) / 100 }))}
            format={(v) => money(v * 100)}
            unit="earnings"
          />
        </Panel>
        <Panel title="Last 30 days">
          <Breakdown
            rows={[
              { label: 'Bags sold', value: money(s.gross) },
              ...(s.cash_sales ? [{ label: 'Paid to you in cash at pickup', value: minus(s.cash_sales), muted: true }] : []),
              { label: 'Cancelled and refunded', value: minus(s.cancelled), muted: true },
              ...(s.complaint_refunds ? [{ label: 'Complaint refunds', value: minus(s.complaint_refunds), muted: true }] : []),
              { label: <CommissionLabel terms={terms} />, value: minus(s.commission), muted: true },
              ...(s.membership ? [{ label: 'Membership fee', value: minus(s.membership), muted: true }] : []),
              ...(s.adjustments ? [{ label: 'Adjustments', value: money(s.adjustments), muted: true }] : []),
              { label: 'Your earnings', value: money(s.store_net), strong: true },
            ]}
          />
          <p className="mt-3 text-[13px] text-muted">
            {s.orders.collected} collected · {s.orders.no_show} not picked up (still paid) · {s.orders.cancelled_store} cancelled by you ·{' '}
            {s.orders.cancelled_customer} by customers
          </p>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5">
        <PayoutsPanel payouts={data.payouts} minPayout={policy.minPayoutLek} />
        <MonthlyPanel data={data} />
      </div>

      <ComplaintsPanel complaints={data.complaints} />

      <div id="bank" className="mt-5 grid scroll-mt-24 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <BankDetails billing={billing} onSaved={reload} />
        <div className="space-y-5">
          <TermsPanel terms={terms} billing={billing} freeMonths={policy.membershipFreeMonths} />
          <CashPanel billing={billing} terms={terms} onSaved={reload} />
        </div>
      </div>
      {data.requests.length > 0 && <RequestsPanel requests={data.requests} />}
      <p className="mt-6 text-center text-[13px] text-muted">
        The monthly CSV lists every sale, refund and fee line, for your accountant.
      </p>
    </>
  )
}

function CommissionLabel({ terms }: { terms: Terms }) {
  return (
    <span>
      Ngopu commission
      <span className="block text-[13px] text-muted">
        {terms.commissionPercent}%, at least {terms.commissionMinLek} L a bag
      </span>
    </span>
  )
}

function PayoutsPanel({ payouts, minPayout }: { payouts: Payout[]; minPayout: number }) {
  const columns: Column<Payout>[] = [
    { key: 'date', header: 'Date', sort: (p) => p.paidAt ?? p.createdAt, render: (p) => shortDate(p.paidAt ?? p.createdAt) },
    { key: 'amount', header: 'Amount', align: 'right', sort: (p) => p.amount, render: (p) => <span className="font-semibold">{money(p.amount)}</span> },
    { key: 'status', header: 'Status', render: (p) => <PayoutBadge status={p.status} /> },
    { key: 'ref', header: 'Bank ref.', render: (p) => <span className="text-muted">{p.bankReference ?? '—'}</span> },
    {
      key: 'csv',
      header: 'Statement',
      render: (p) => (
        <a href={`/api/partner/payouts/${p.id}/statement?format=csv`} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
          <Download className="h-4 w-4" aria-hidden /> CSV
        </a>
      ),
    },
  ]
  return (
    <Panel title="Payouts">
      <DataTable
        rows={payouts}
        columns={columns}
        initialSort={{ key: 'date', dir: 'desc' }}
        empty={<Empty icon={<Banknote className="h-6 w-6" />} title="No payouts yet" text={`Your first payout is sent once you’ve earned at least ${minPayout.toLocaleString('en')} L.`} />}
      />
    </Panel>
  )
}

function MonthlyPanel({ data }: { data: PartnerEarnings }) {
  const rows = data.monthly.map((m) => ({ ...m, id: m.month }))
  return (
    <Panel title="Monthly statements">
      <DataTable
        rows={rows}
        columns={[
          { key: 'month', header: 'Month', render: (m) => monthLabel(m.month) },
          { key: 'gross', header: 'Sales', align: 'right', render: (m) => money(m.gross) },
          { key: 'commission', header: 'Commission', align: 'right', render: (m) => money(m.commission) },
          { key: 'net', header: 'Earnings', align: 'right', render: (m) => <span className="font-semibold">{money(m.store_net)}</span> },
          {
            key: 'csv',
            header: '',
            render: (m) => (
              <a href={`/api/partner/statement?month=${m.month}`} className="inline-flex items-center gap-1 font-medium text-brand hover:underline" aria-label={`Download ${monthLabel(m.month)} as CSV`}>
                <Download className="h-4 w-4" aria-hidden /> CSV
              </a>
            ),
          },
        ]}
        empty={<Empty icon={<ReceiptText className="h-6 w-6" />} title="No statements yet" text="A statement appears here for every month you sell through Ngopu." />}
      />
    </Panel>
  )
}

function ComplaintsPanel({ complaints }: { complaints: Complaint[] }) {
  if (!complaints.length) return null
  return (
    <Panel title="Customer complaints" className="mt-5">
      <ul className="divide-y divide-line/70">
        {complaints.map((k) => (
          <li key={k.id} className="flex flex-wrap items-start gap-3 py-3">
            <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {COMPLAINT_REASON_LABELS[k.reason] ?? k.reason} <span className="font-normal text-muted">· order {k.order.pickupCode} · {shortDate(k.createdAt)}</span>
              </p>
              {k.details && <p className="mt-0.5 text-sm text-muted">“{k.details}”</p>}
              {k.status === 'refunded' && (
                <p className="mt-0.5 text-sm">
                  {k.order.cash
                    ? k.fundedBy === 'ngopu'
                      ? `${money(k.refundAmount ?? 0)} refunded by Ngopu`
                      : `Please give the customer ${money(k.refundAmount ?? 0)} back in cash. Ngopu returned its commission on it.`
                    : `${money(k.refundAmount ?? 0)} refunded ${k.fundedBy === 'ngopu' ? 'by Ngopu (not taken from your earnings)' : 'from your earnings, commission returned'}`}
                </p>
              )}
              {k.resolutionNote && <p className="mt-0.5 text-sm text-muted">Ngopu: {k.resolutionNote}</p>}
            </div>
            <ComplaintBadge status={k.status} />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function BankDetails({ billing, onSaved }: { billing: Billing; onSaved: () => void }) {
  const toast = useToast()
  const [editing, setEditing] = useState(!billing.iban && !billing.pending)
  const [form, setForm] = useState({ legalName: billing.legalName ?? '', nipt: billing.nipt ?? '', iban: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await api('partner/billing', { method: 'PATCH', json: form })
      toast('Bank details sent for review')
      setEditing(false)
      onSaved()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Bank details" action={!editing && <Btn variant="ghost" size="sm" onClick={() => setEditing(true)}>{billing.iban ? 'Change' : 'Add'}</Btn>}>
      {billing.pending && (
        <p role="status" className="mb-4 rounded-xl bg-[#fff1cc] p-3 text-sm text-[#5c4000]">
          New details for <strong>{billing.pending.legalName}</strong> (IBAN ending {billing.pending.iban.slice(-4)}) are waiting for Ngopu to check them. Payouts
          use them 48 hours after approval.
        </p>
      )}
      {!editing ? (
        billing.iban ? (
          <Breakdown
            rows={[
              { label: 'Legal name', value: billing.legalName },
              { label: 'NIPT', value: billing.nipt },
              { label: 'IBAN', value: billing.iban },
              { label: 'Checked', value: shortDate(billing.verifiedAt), muted: true },
            ]}
          />
        ) : (
          <p className="text-sm text-muted">No bank details yet.</p>
        )
      ) : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Legal name of the business" className="sm:col-span-2" hint="Exactly as registered with QKB. The bank account must be in this name.">
            {(id, d) => <Input id={id} aria-describedby={d} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} required />}
          </Field>
          <Field label="NIPT" hint="e.g. L12345678A">
            {(id, d) => <Input id={id} aria-describedby={d} value={form.nipt} onChange={(e) => setForm({ ...form, nipt: e.target.value.toUpperCase() })} required />}
          </Field>
          <Field label="IBAN" hint="28 characters, starts with AL">
            {(id, d) => (
              <Input id={id} aria-describedby={d} value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })} autoComplete="off" required />
            )}
          </Field>
          {err && (
            <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">
              {err}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Btn type="submit" loading={busy}>
              Send for review
            </Btn>
            {(billing.iban || billing.pending) && (
              <Btn variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Btn>
            )}
          </div>
        </form>
      )}
    </Panel>
  )
}

function TermsPanel({ terms, billing, freeMonths }: { terms: Terms; billing: Billing; freeMonths: number }) {
  const paidUntil = billing.membershipPaidUntil
  return (
    <Panel title="Your terms">
      <Breakdown
        rows={[
          { label: 'Commission', value: `${terms.commissionPercent}% per sale` },
          { label: 'Minimum per bag', value: `${terms.commissionMinLek} L` },
          { label: 'Membership', value: `${terms.membershipFeeLek.toLocaleString('en')} L a year` },
          {
            label: 'Membership covered until',
            value: paidUntil ? shortDate(paidUntil) : `${freeMonths} months free from approval`,
            muted: true,
          },
        ]}
      />
      <p className="mt-3 text-[13px] text-muted">
        You only pay commission on bags that are sold and not cancelled. If a customer doesn’t show up, you keep the money. Card fees are paid by Ngopu.
      </p>
    </Panel>
  )
}

function CashPanel({ billing, terms, onSaved }: { billing: Billing; terms: Terms; onSaved: () => void }) {
  const toast = useToast()
  const [on, setOn] = useState(billing.acceptsCash)
  const [busy, setBusy] = useState(false)
  const change = async (v: boolean) => {
    setBusy(true)
    setOn(v)
    try {
      await api('partner/cash', { method: 'PATCH', json: { acceptsCash: v } })
      toast(v ? 'Trusted customers can now pay cash at pickup' : 'Cash at pickup turned off')
      onSaved()
    } catch (e) {
      setOn(!v)
      toast(e instanceof Error ? e.message : 'Could not save.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel title="Cash at pickup" action={<Switch checked={on} onChange={change} disabled={busy} label="Accept cash at pickup" />}>
      <p className="text-sm text-muted">
        Let trusted customers (several collected orders, no missed pickups) reserve now and pay you in cash when they collect. You keep the cash; Ngopu’s{' '}
        {terms.commissionPercent}% commission is taken from your card-sale payouts or sent to you as a payment request. If a cash customer doesn’t come, you
        owe nothing.
      </p>
    </Panel>
  )
}

const REQUEST_STATUS: Record<PaymentRequest['status'], ['warn' | 'good' | 'info' | 'neutral', string]> = {
  open: ['warn', 'To pay'],
  paid: ['good', 'Paid'],
  settled: ['info', 'Taken from payouts'],
  cancelled: ['neutral', 'Cancelled'],
}

function RequestsPanel({ requests }: { requests: PaymentRequest[] }) {
  return (
    <Panel title="Payment requests from Ngopu" className="mt-5">
      <DataTable
        rows={requests}
        columns={[
          { key: 'number', header: 'Number', render: (r) => <span className="font-medium">{r.number}</span> },
          { key: 'date', header: 'Issued', render: (r) => shortDate(r.createdAt) },
          { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="font-semibold">{money(r.amount)}</span> },
          { key: 'status', header: 'Status', render: (r) => <Pill tone={REQUEST_STATUS[r.status][0]}>{REQUEST_STATUS[r.status][1]}</Pill> },
          {
            key: 'view',
            header: '',
            render: (r) => (
              <a href={`/api/partner/payment-requests/${r.id}`} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                View
              </a>
            ),
          },
        ]}
      />
    </Panel>
  )
}
