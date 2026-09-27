import { ArrowLeft, ClipboardList, Database, Inbox, Mail, Phone, Search, Star, Store, UserPlus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { StoreLogo } from '../../components/BagArt'
import { CATEGORIES } from '../../data/categories'
import { api } from '../../lib/api'
import { formatPrice, formatRange } from '../../lib/format'
import type { Category } from '../../types'
import { useNow } from '../../state/store'
import { StoreMoneyPanel } from './Finance'
import { BarChart, shortDay } from '../BarChart'
import { useAuth, useResource, useToast } from '../data'
import type { AdminMember, AdminOverview, AdminStoreDetail, DashOrder, ManagedStore, StoreStatus } from '../types'
import {
  Btn,
  ConfirmBtn,
  DataTable,
  Delta,
  Empty,
  ErrorState,
  Field,
  Input,
  Kpi,
  OrderBadge,
  PageSkeleton,
  PageTitle,
  Panel,
  Segmented,
  StatusBadge,
  type Column,
} from '../ui'
import { BagEditor, StoreProfileForm } from './Partner'

const since = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

async function setStatus(id: string, status: StoreStatus) {
  return api<{ store: ManagedStore }>(`admin/stores/${id}`, { method: 'PATCH', json: { status } }).then((r) => r.store)
}

const STATUS_DONE: Record<StoreStatus, string> = {
  active: 'Store approved: it’s live in the app',
  rejected: 'Application rejected',
  suspended: 'Store suspended: hidden from customers',
  pending: 'Moved back to review',
}

/* Overview ---------------------------------------------------------------- */

export function AdminOverviewPage() {
  const [days, setDays] = useState<'14' | '30'>('14')
  const { data, error, loading, reload } = useResource<AdminOverview>(`admin/overview?days=${days}`, 60_000)
  const stores = useResource<{ stores: ManagedStore[] }>('admin/stores')
  const toast = useToast()

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />

  const { totals, counts, series, topStores } = data
  const pending = (stores.data?.stores ?? []).filter((s) => s.status === 'pending')
  const total = series.reduce((n, d) => n + d.bags, 0)

  const decide = async (s: ManagedStore, status: StoreStatus) => {
    try {
      await setStatus(s.id, status)
      toast(STATUS_DONE[status])
      stores.reload()
      reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the store.', 'error')
    }
  }

  return (
    <>
      <PageTitle
        title="Overview"
        subtitle={`${counts.active} partner stores live · ${counts.bags_live} bags available right now`}
        actions={
          <Segmented
            label="Period"
            value={days}
            onChange={setDays}
            options={[
              { value: '14', label: '14 days' },
              { value: '30', label: '30 days' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Bags rescued" value={totals.bags.toLocaleString('en-US')} emphasis>
          <p className="mt-1 text-[13px] text-mint">
            {totals.prev_bags ? `${totals.bags >= totals.prev_bags ? '+' : ''}${Math.round(((totals.bags - totals.prev_bags) / totals.prev_bags) * 100)}% vs previous ${days} days` : `Last ${days} days`}
          </p>
        </Kpi>
        <Kpi label="Order value" value={formatPrice(totals.revenue)}>
          <Delta current={totals.revenue} previous={totals.prev_revenue} label={`vs previous ${days} days`} />
        </Kpi>
        <Kpi label="Customers" value={totals.customers.toLocaleString('en-US')}>
          <p className="mt-1 text-[13px] text-muted">Saved {formatPrice(totals.saved)} in total</p>
        </Kpi>
        <Kpi label="To collect now" value={counts.to_collect}>
          <p className="mt-1 text-[13px] text-muted">Reserved, pickup not yet ended</p>
        </Kpi>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel title={total ? `${total.toLocaleString('en-US')} bags rescued in the last ${days} days` : 'Bags rescued per day'}>
          {total ? (
            <BarChart data={series.map((d) => ({ key: d.day, label: shortDay(d.day), value: d.bags }))} format={(v) => String(Math.round(v))} unit="Bags" />
          ) : (
            <Empty
              icon={<ClipboardList className="h-6 w-6" />}
              title="No orders yet"
              text="The chart fills in as customers reserve bags. To explore the dashboard before launch, load sample data from Team & settings."
            />
          )}
        </Panel>

        <Panel
          title={pending.length ? `${pending.length} application${pending.length > 1 ? 's' : ''} to review` : 'Applications'}
          action={
            <Link to="/admin/partners?status=pending" className="text-sm font-medium text-brand hover:underline">
              View all
            </Link>
          }
        >
          {pending.length === 0 ? (
            <Empty icon={<Inbox className="h-6 w-6" />} title="You’re all caught up" text="New store applications from the landing page appear here." />
          ) : (
            <ul className="divide-y divide-line/70">
              {pending.slice(0, 4).map((s) => (
                <li key={s.id} className="py-3">
                  <Link to={`/admin/partners/${s.id}`} className="block hover:text-brand">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-muted">
                      {CATEGORIES[s.category as Category]?.label} · applied {since(s.createdAt)}
                    </p>
                  </Link>
                  <div className="mt-2 flex gap-2">
                    <Btn size="sm" onClick={() => decide(s, 'active')}>
                      Approve
                    </Btn>
                    <ConfirmBtn label="Reject" confirmLabel="Reject store" onConfirm={() => decide(s, 'rejected')} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-5" title={`Top partners · last ${days} days`}>
        {topStores.every((s) => s.bags === 0) ? (
          <p className="pb-2 text-sm text-muted">No sales in this period yet.</p>
        ) : (
          <ol className="divide-y divide-line/70">
            {topStores.map((s, i) => (
              <li key={s.id}>
                <Link to={`/admin/partners/${s.id}`} className="flex items-center gap-4 py-3 hover:text-brand">
                  <span className="w-5 text-sm font-semibold text-muted tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block text-xs text-muted">{CATEGORIES[s.category as Category]?.label}</span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    <span className="block font-semibold">{s.bags} bags</span>
                    <span className="block text-muted">{formatPrice(s.revenue)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  )
}

/* Partners list ----------------------------------------------------------- */

type StatusFilter = 'all' | StoreStatus

export function AdminPartners() {
  const navigate = useNavigate()
  const initialStatus = (new URLSearchParams(window.location.search).get('status') as StatusFilter) || 'all'
  const [status, setStatusFilter] = useState<StatusFilter>(initialStatus)
  const [q, setQ] = useState('')
  const { data, error, loading, reload } = useResource<{ stores: ManagedStore[] }>('admin/stores')
  const stores = useMemo(() => data?.stores ?? [], [data])
  const count = (s: StatusFilter) => (s === 'all' ? stores.length : stores.filter((x) => x.status === s).length)
  const shown = stores.filter(
    (s) =>
      (status === 'all' || s.status === status) &&
      (!q || `${s.name} ${s.branch ?? ''} ${s.address} ${s.contactEmail ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )

  const columns: Column<ManagedStore>[] = [
    {
      key: 'name',
      header: 'Store',
      sort: (s) => s.name,
      render: (s) => (
        <span className="flex items-center gap-3">
          <StoreLogo store={s as never} size={34} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {s.name}
              {s.branch ? ` – ${s.branch}` : ''}
            </span>
            <span className="block truncate text-xs text-muted">{s.address}</span>
          </span>
        </span>
      ),
    },
    { key: 'category', header: 'Type', sort: (s) => s.category, render: (s) => CATEGORIES[s.category as Category]?.label },
    { key: 'status', header: 'Status', sort: (s) => s.status, render: (s) => <StatusBadge status={s.status} /> },
    { key: 'live', header: 'Bags left', align: 'right', sort: (s) => (s.bag.paused ? -1 : s.bag.quantity), render: (s) => (s.bag.paused ? <span className="text-muted">Paused</span> : s.bag.quantity) },
    { key: 'bags30', header: 'Sold · 30d', align: 'right', sort: (s) => s.bags30d ?? 0, render: (s) => s.bags30d ?? 0 },
    { key: 'rev30', header: 'Value · 30d', align: 'right', sort: (s) => s.revenue30d ?? 0, render: (s) => formatPrice(s.revenue30d ?? 0) },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      sort: (s) => s.rating,
      render: (s) => (s.ratingCount ? s.rating.toFixed(1) : <span className="text-muted">—</span>),
    },
  ]

  return (
    <>
      <PageTitle title="Partners" subtitle="Every store on Ngopu: review applications, check performance, suspend or reactivate." />
      <Panel
        title={
          <Segmented
            label="Filter by status"
            value={status}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All', count: count('all') },
              { value: 'pending', label: 'To review', count: count('pending') },
              { value: 'active', label: 'Active', count: count('active') },
              { value: 'suspended', label: 'Suspended', count: count('suspended') },
              { value: 'rejected', label: 'Rejected', count: count('rejected') },
            ]}
          />
        }
        action={
          <label className="relative hidden sm:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stores"
              aria-label="Search stores"
              className="h-9 w-56 rounded-xl bg-cream pr-3 pl-9 text-sm ring-1 ring-transparent placeholder:text-muted focus:bg-white focus:ring-2 focus:ring-brand focus:outline-none"
            />
          </label>
        }
      >
        <label className="relative mb-3 block sm:hidden">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stores"
            aria-label="Search stores"
            className="h-10 w-full rounded-xl bg-cream pr-3 pl-9 text-sm placeholder:text-muted focus:bg-white focus:ring-2 focus:ring-brand focus:outline-none"
          />
        </label>
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <DataTable
            rows={shown}
            columns={columns}
            onRowClick={(s) => navigate(`/admin/partners/${s.id}`)}
            initialSort={{ key: 'bags30', dir: 'desc' }}
            empty={
              <Empty
                icon={<Store className="h-6 w-6" />}
                title={q ? 'No stores match your search' : status === 'pending' ? 'No applications waiting' : 'No stores here'}
                text={status === 'pending' ? 'Stores apply at /dashboard/apply, linked from the landing page.' : 'Try another filter.'}
              />
            }
          />
        )}
      </Panel>
    </>
  )
}

/* Partner detail ---------------------------------------------------------- */

export function AdminPartnerDetail() {
  const { id } = useParams()
  const { data, error, loading, reload, setData } = useResource<AdminStoreDetail>(`admin/stores/${id}`)
  const toast = useToast()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'performance' | 'money' | 'listing' | 'profile'>(params.get('tab') === 'money' ? 'money' : 'performance')
  const now = useNow(30_000)

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />
  const { store, series, totals, orders, users } = data

  const change = async (status: StoreStatus) => {
    try {
      const updated = await setStatus(store.id, status)
      setData({ ...data, store: updated })
      toast(STATUS_DONE[status])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the store.', 'error')
    }
  }
  const patch = (body: Record<string, unknown>) =>
    api<{ store: ManagedStore }>(`admin/stores/${store.id}`, { method: 'PATCH', json: body }).then((r) => r.store)

  const orderColumns: Column<DashOrder>[] = [
    { key: 'code', header: 'Code', render: (o) => <span className="font-mono font-semibold tracking-[0.12em]">{o.pickupCode}</span> },
    { key: 'pickup', header: 'Pickup', sort: (o) => o.pickupStart, render: (o) => formatRange(o.pickupStart, o.pickupEnd, now) },
    { key: 'qty', header: 'Bags', align: 'right', render: (o) => o.quantity },
    { key: 'total', header: 'Paid', align: 'right', render: (o) => formatPrice(o.unitPrice * o.quantity) },
    { key: 'status', header: 'Status', render: (o) => <OrderBadge status={o.status === 'reserved' && o.pickupEnd < now ? 'missed' : o.status} /> },
  ]

  return (
    <>
      <Link to="/admin/partners" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Partners
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <StoreLogo store={store as never} size={56} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
              {store.name}
              {store.branch ? ` – ${store.branch}` : ''}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] text-muted">
              <StatusBadge status={store.status} />
              {CATEGORIES[store.category as Category]?.label} · joined {since(store.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {store.status === 'pending' && (
            <>
              <Btn onClick={() => change('active')}>Approve store</Btn>
              <ConfirmBtn label="Reject" confirmLabel="Reject store" size="md" onConfirm={() => change('rejected')} />
            </>
          )}
          {store.status === 'active' && (
            <ConfirmBtn label="Suspend store" confirmLabel="Suspend: hide from customers" size="md" onConfirm={() => change('suspended')} />
          )}
          {(store.status === 'suspended' || store.status === 'rejected') && <Btn onClick={() => change('active')}>Reactivate store</Btn>}
        </div>
      </div>

      {store.status === 'pending' && (
        <Panel className="mb-5" title="Application">
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Contact</dt>
              <dd className="mt-0.5 font-medium">{store.contactName}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="mt-0.5 font-medium break-all">{store.contactEmail}</dd>
            </div>
            <div>
              <dt className="text-muted">Phone</dt>
              <dd className="mt-0.5 font-medium">{store.contactPhone || '—'}</dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-muted">Address</dt>
              <dd className="mt-0.5 font-medium">{store.address}</dd>
            </div>
            {store.note && (
              <div className="sm:col-span-3">
                <dt className="text-muted">Their message</dt>
                <dd className="mt-1 rounded-xl bg-cream p-3 leading-relaxed whitespace-pre-line">{store.note}</dd>
              </div>
            )}
          </dl>
        </Panel>
      )}

      <div className="mb-5">
        <Segmented
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'performance', label: 'Performance' },
            { value: 'money', label: 'Money' },
            { value: 'listing', label: 'Surprise Bag' },
            { value: 'profile', label: 'Profile & contact' },
          ]}
        />
      </div>

      {tab === 'performance' && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Bags sold · 30 days" value={totals.bags} emphasis>
              <p className="mt-1 text-[13px] text-mint">{totals.customers} customers</p>
            </Kpi>
            <Kpi label="Order value · 30 days" value={formatPrice(totals.revenue)}>
              <Delta current={totals.revenue} previous={totals.prev_revenue} label="vs previous 30 days" />
            </Kpi>
            <Kpi label="Bags left now" value={store.bag.paused ? 'Paused' : store.bag.quantity}>
              <p className="mt-1 text-[13px] text-muted">{formatPrice(store.bag.price)} each</p>
            </Kpi>
            <Kpi
              label="Rating"
              value={
                store.ratingCount ? (
                  <span className="inline-flex items-center gap-1.5">
                    {store.rating.toFixed(1)} <Star className="h-5 w-5 fill-sun text-sun" aria-hidden />
                  </span>
                ) : (
                  '—'
                )
              }
            >
              <p className="mt-1 text-[13px] text-muted">{store.ratingCount.toLocaleString('en-US')} ratings</p>
            </Kpi>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <Panel title="Bags sold per day · last 14 days">
              {series.some((d) => d.bags) ? (
                <BarChart data={series.map((d) => ({ key: d.day, label: shortDay(d.day), value: d.bags }))} format={(v) => String(Math.round(v))} unit="Bags" />
              ) : (
                <Empty icon={<ClipboardList className="h-6 w-6" />} title="No sales in the last 14 days" text="Sales show up here day by day." />
              )}
            </Panel>
            <StoreLogins
              storeId={store.id}
              users={users}
              phone={store.contactPhone}
              defaultName={store.contactName ?? ''}
              onCreated={(u) => setData({ ...data, users: [...users, u] })}
            />
          </div>
          <Panel className="mt-5" title="Recent orders">
            <DataTable
              rows={orders}
              columns={orderColumns}
              empty={<Empty icon={<ClipboardList className="h-6 w-6" />} title="No orders yet" text="Orders for this store appear here." />}
            />
          </Panel>
        </>
      )}

      {tab === 'money' && <StoreMoneyPanel storeId={store.id} />}

      {tab === 'listing' && <BagEditor store={store} save={(bag) => patch({ bag })} onSaved={(s) => setData({ ...data, store: s })} />}
      {tab === 'profile' && <StoreProfileForm store={store} save={patch} onSaved={(s) => setData({ ...data, store: s })} />}
    </>
  )
}

/** A readable temporary password the admin can share with the store (by phone or message). */
function tempPassword() {
  const words = ['buke', 'byrek', 'kafe', 'fruta', 'tave', 'petull', 'sallate', 'djathe']
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length]
  return `${pick()}-${pick()}-${1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000)}`
}

type StoreUser = AdminStoreDetail['users'][number]

/** Partner logins for one store: create a login (seeded or phone-onboarded stores) and reset passwords. */
function StoreLogins({
  storeId,
  users,
  phone,
  defaultName,
  onCreated,
}: {
  storeId: string
  users: StoreUser[]
  phone: string | null
  defaultName: string
  onCreated: (u: StoreUser) => void
}) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: defaultName, email: '', password: tempPassword() })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetFor, setResetFor] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [shared, setShared] = useState<{ email: string; password: string } | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { user } = await api<{ user: StoreUser }>(`admin/stores/${storeId}/users`, { method: 'POST', json: form })
      onCreated(user)
      setShared({ email: form.email, password: form.password })
      setAdding(false)
      toast('Login created')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the login.')
    } finally {
      setBusy(false)
    }
  }

  const reset = async (u: StoreUser) => {
    setBusy(true)
    try {
      await api(`admin/users/${u.id}/password`, { method: 'POST', json: { password: newPassword } })
      setShared({ email: u.email, password: newPassword })
      setResetFor(null)
      toast(`New password set for ${u.name}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not reset the password.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title="Logins"
      action={
        !adding && (
          <Btn variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> Create login
          </Btn>
        )
      }
    >
      {shared && (
        <div role="status" className="mb-4 rounded-xl bg-[#e1f3ec] p-3.5 text-sm text-[#0b4d3a]">
          <p className="font-semibold">Share these details with the store</p>
          <p className="mt-1">
            Log in at <span className="font-medium">{window.location.origin}/dashboard</span>
          </p>
          <p>
            Email: <span className="font-medium">{shared.email}</span>
          </p>
          <p>
            Password: <span className="font-mono font-semibold">{shared.password}</span>
          </p>
          <p className="mt-1 text-xs">This password isn’t shown again. It works right away.</p>
        </div>
      )}

      {adding && (
        <form onSubmit={create} className="mb-4 space-y-3 rounded-xl bg-cream p-4" noValidate>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {error}
            </p>
          )}
          <Field label="Contact name">{(id) => <Input id={id} value={form.name} onChange={set('name')} />}</Field>
          <Field label="Email they’ll log in with">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
          <Field label="Temporary password" hint="Share it with the store by phone or message.">
            {(id, hint) => (
              <div className="flex gap-2">
                <Input id={id} aria-describedby={hint} value={form.password} onChange={set('password')} className="font-mono" />
                <Btn variant="secondary" onClick={() => setForm({ ...form, password: tempPassword() })}>
                  New
                </Btn>
              </div>
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Btn>
            <Btn type="submit" size="sm" loading={busy} disabled={!form.name || !form.email || form.password.length < 8}>
              Create login
            </Btn>
          </div>
        </form>
      )}

      {users.length === 0 && !adding ? (
        <p className="text-sm text-muted">No login yet, so this store can’t use the dashboard. Create one and share it with the store.</p>
      ) : (
        <ul className="space-y-4 text-sm">
          {users.map((u) => (
            <li key={u.id}>
              <p className="font-semibold">{u.name}</p>
              <p className="flex items-center gap-1.5 break-all text-muted">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {u.email}
              </p>
              <p className="text-muted">
                Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'never'}
              </p>
              {resetFor === u.id ? (
                <div className="mt-2 flex gap-2">
                  <Input aria-label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="font-mono" />
                  <Btn size="sm" className="h-11" loading={busy} disabled={newPassword.length < 8} onClick={() => reset(u)}>
                    Save
                  </Btn>
                  <Btn variant="ghost" size="sm" className="h-11" onClick={() => setResetFor(null)} disabled={busy}>
                    Cancel
                  </Btn>
                </div>
              ) : (
                <Btn
                  variant="ghost"
                  size="sm"
                  className="mt-1 -ml-3"
                  onClick={() => {
                    setNewPassword(tempPassword())
                    setResetFor(u.id)
                  }}
                >
                  Reset password
                </Btn>
              )}
            </li>
          ))}
        </ul>
      )}
      {phone && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
          <Phone className="h-3.5 w-3.5" /> {phone}
        </p>
      )}
    </Panel>
  )
}

/* Orders ------------------------------------------------------------------ */

type OrderFilter = 'all' | 'reserved' | 'collected' | 'cancelled'

export function AdminOrders() {
  const [filter, setFilter] = useState<OrderFilter>('all')
  const { data, error, loading, reload } = useResource<{ orders: DashOrder[] }>(`admin/orders${filter === 'all' ? '' : `?status=${filter}`}`, 60_000)
  const now = useNow(30_000)

  const columns: Column<DashOrder>[] = [
    { key: 'code', header: 'Code', render: (o) => <span className="font-mono font-semibold tracking-[0.12em]">{o.pickupCode}</span> },
    {
      key: 'store',
      header: 'Store',
      sort: (o) => o.storeName ?? '',
      render: (o) => (
        <Link to={`/admin/partners/${o.storeId}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-brand">
          {o.storeName}
        </Link>
      ),
    },
    { key: 'placed', header: 'Reserved', sort: (o) => o.createdAt, render: (o) => new Date(o.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) },
    { key: 'qty', header: 'Bags', align: 'right', sort: (o) => o.quantity, render: (o) => o.quantity },
    { key: 'total', header: 'Value', align: 'right', sort: (o) => o.unitPrice * o.quantity, render: (o) => formatPrice(o.unitPrice * o.quantity) },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <span className="inline-flex items-center gap-2">
          <OrderBadge status={o.status === 'reserved' && o.pickupEnd < now ? 'missed' : o.status} />
          {o.isDemo && <span className="text-xs text-muted">sample</span>}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageTitle title="Orders" subtitle="The latest 500 orders across all stores." />
      <Panel
        title={
          <Segmented
            label="Filter orders"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'reserved', label: 'To collect' },
              { value: 'collected', label: 'Collected' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        }
      >
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <DataTable
            rows={data?.orders ?? []}
            columns={columns}
            initialSort={{ key: 'placed', dir: 'desc' }}
            empty={<Empty icon={<ClipboardList className="h-6 w-6" />} title="No orders yet" text="Orders from the customer app appear here." />}
          />
        )}
      </Panel>
    </>
  )
}

/* Team & settings --------------------------------------------------------- */

export function AdminTeam() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useResource<{ admins: AdminMember[] }>('admin/team')
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [demoBusy, setDemoBusy] = useState(false)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await api('admin/team', { method: 'POST', json: form })
      toast(`${form.name} can now log in`)
      setForm({ name: '', email: '', password: '' })
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add the admin.')
    } finally {
      setBusy(false)
    }
  }

  const demo = async (action: 'load' | 'clear') => {
    setDemoBusy(true)
    try {
      const r = await api<{ inserted?: number; removed?: number }>('admin/demo', { method: 'POST', json: { action } })
      toast(action === 'load' ? `Added ${r.inserted} sample orders` : `Removed ${r.removed} sample orders`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update sample data.', 'error')
    } finally {
      setDemoBusy(false)
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  return (
    <>
      <PageTitle title="Team & settings" subtitle="Everyone on the Ngopu team has the same full access." />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Admins">
          {loading ? (
            <PageSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <ul className="divide-y divide-line/70">
              {data?.admins.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {a.name} {a.id === user?.id && <span className="text-sm font-normal text-muted">(you)</span>}
                    </p>
                    <p className="truncate text-sm text-muted">{a.email}</p>
                    <p className="text-xs text-muted">
                      Last login: {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'never'}
                    </p>
                  </div>
                  {a.id !== user?.id && (
                    <ConfirmBtn
                      label="Remove"
                      confirmLabel="Remove access"
                      onConfirm={async () => {
                        await api(`admin/team/${a.id}`, { method: 'DELETE' })
                        toast(`${a.name} no longer has access`)
                        reload()
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Add an admin">
          <form onSubmit={add} className="space-y-4" noValidate>
            {formError && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {formError}
              </p>
            )}
            <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={set('name')} />}</Field>
            <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
            <Field label="Temporary password" hint="At least 8 characters. Share it with them securely.">
              {(id, hint) => <Input id={id} type="password" autoComplete="new-password" aria-describedby={hint} value={form.password} onChange={set('password')} />}
            </Field>
            <Btn type="submit" loading={busy} disabled={!form.name || !form.email || form.password.length < 8} className="w-full">
              <UserPlus className="h-4 w-4" /> Add admin
            </Btn>
          </form>
        </Panel>
      </div>

      <Panel className="mt-5" title="Sample data">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm text-muted">
            <Database className="mr-1.5 inline h-4 w-4 align-[-3px]" aria-hidden />
            Adds about a month of made-up orders for the active stores, so you can try charts and tables before launch. Sample orders are
            labelled and can be removed at any time. Real orders are never touched.
          </p>
          <div className="flex gap-2">
            <Btn variant="secondary" loading={demoBusy} onClick={() => demo('load')}>
              Load sample orders
            </Btn>
            <ConfirmBtn label="Remove sample orders" confirmLabel="Remove all sample orders" size="md" onConfirm={() => demo('clear')} />
          </div>
        </div>
      </Panel>
    </>
  )
}
