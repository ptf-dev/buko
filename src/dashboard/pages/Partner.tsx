import { CheckCircle2, ClipboardList, LocateFixed, Minus, Plus, Star, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BagArt, StoreLogo } from '../../components/BagArt'
import { MapView } from '../../components/LazyMap'
import { CATEGORIES, CATEGORY_ORDER, DIET_LABELS } from '../../data/categories'
import { api } from '../../lib/api'
import { discountPercent, formatMinutes, formatPrice, formatRange, isPickupNow } from '../../lib/format'
import type { Category, Diet } from '../../types'
import { useNow } from '../../state/store'
import { BarChart, shortDay } from '../BarChart'
import { useResource, useToast } from '../data'
import type { DashOrder, ManagedStore, PartnerOverview } from '../types'
import { Btn, DataTable, Delta, Dialog, Empty, ErrorState, Field, Input, Kpi, OrderBadge, PageSkeleton, PageTitle, Panel, Segmented, Select, StatusBadge, Switch, TextArea, type Column } from '../ui'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function orderState(o: DashOrder, now: number): 'reserved' | 'collected' | 'cancelled' | 'missed' {
  return o.status === 'reserved' && o.pickupEnd < now ? 'missed' : o.status
}

function useSecondsAgo(ts: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])
  if (!ts) return null
  const s = Math.max(0, Math.round((now - ts) / 1000))
  return s < 60 ? 'just now' : `${Math.floor(s / 60)} min ago`
}

/* Pickup code check (used on Today and Orders) ---------------------------- */

function CodeCheck({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await api<{ order: DashOrder; alreadyCollected: boolean }>('partner/validate', { method: 'POST', json: { code } })
      setResult({
        ok: !r.alreadyCollected,
        text: r.alreadyCollected
          ? `Code ${r.order.pickupCode} was already collected.`
          : `Valid: hand over ${r.order.quantity} bag${r.order.quantity > 1 ? 's' : ''} (${formatPrice(r.order.unitPrice * r.order.quantity)} paid).`,
      })
      setCode('')
      onDone()
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Could not check the code.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="pickup-code" className="mb-1.5 block text-sm font-medium">
        Customer’s pickup code
      </label>
      <div className="flex gap-2">
        <input
          id="pickup-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
            setResult(null)
          }}
          placeholder="e.g. K7M2QX"
          autoComplete="off"
          inputMode="text"
          className="h-12 min-w-0 flex-1 rounded-xl bg-white px-4 font-mono text-lg tracking-[0.2em] uppercase ring-1 ring-line placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:normal-case focus:ring-2 focus:ring-brand focus:outline-none"
        />
        <Btn type="submit" className="h-12" loading={busy} disabled={code.length !== 6}>
          Check
        </Btn>
      </div>
      {result && (
        <p role="status" className={`mt-3 flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm font-medium ${result.ok ? 'bg-[#e1f3ec] text-[#0b6b4f]' : 'bg-red-50 text-red-800'}`}>
          {result.ok ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0" /> : <XCircle className="mt-px h-4 w-4 shrink-0" />}
          {result.text}
        </p>
      )}
    </form>
  )
}

/* Today ------------------------------------------------------------------- */

export function PartnerToday() {
  const { data, error, loading, loadedAt, reload, setData } = useResource<PartnerOverview>('partner/overview', 30_000)
  const toast = useToast()
  const updated = useSecondsAgo(loadedAt)
  const [saving, setSaving] = useState(false)
  const now = useNow(15_000)

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />

  const { store, series, totals, upcoming } = data
  const bag = store.bag
  const toCollect = upcoming.filter((o) => o.status === 'reserved' && o.pickupEnd >= now)
  const bagsToHandOver = toCollect.reduce((n, o) => n + o.quantity, 0)
  const last14 = series.reduce((n, d) => n + d.bags, 0)

  const patch = async (body: Record<string, unknown>, message: string) => {
    setSaving(true)
    try {
      const r = await api<{ store: ManagedStore }>('partner/bag', { method: 'PATCH', json: body })
      setData({ ...data, store: r.store })
      toast(message)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle
        title={`${greeting()}, ${store.name}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {updated && (
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10957f] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10957f]" />
                </span>
                Live · updated {updated}
              </span>
            )}
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Panel title="Today’s Surprise Bags">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm text-muted">Bags left to sell</p>
              <div className="mt-2 flex items-center gap-4">
                <button
                  type="button"
                  aria-label="One bag fewer"
                  disabled={saving || bag.quantity <= 0}
                  onClick={() => patch({ quantity: bag.quantity - 1 }, `${bag.quantity - 1} bags left`)}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream text-ink transition-colors hover:bg-[#efe9dd] disabled:opacity-40"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <span className="w-16 text-center text-5xl leading-none font-bold tracking-tight tabular-nums" aria-live="polite">
                  {bag.quantity}
                </span>
                <button
                  type="button"
                  aria-label="One bag more"
                  disabled={saving || bag.quantity >= 99}
                  onClick={() => patch({ quantity: bag.quantity + 1 }, `${bag.quantity + 1} bags left`)}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white transition-colors hover:bg-brand-dark disabled:opacity-40"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="min-w-[200px] flex-1 space-y-3 sm:max-w-xs">
              <label className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold">{bag.paused ? 'Paused' : 'Selling on Ngopu'}</span>
                  <span className="block text-xs text-muted">{bag.paused ? 'Customers see you as sold out' : 'Customers can reserve now'}</span>
                </span>
                <Switch
                  checked={!bag.paused}
                  disabled={saving}
                  label="Selling on Ngopu"
                  onChange={(on) => patch({ paused: !on }, on ? 'Your bags are live again' : 'Selling paused')}
                />
              </label>
              <p className="px-1 text-sm text-muted">
                Pickup {bag.pickup.day === 'tomorrow' ? 'tomorrow' : 'daily'} {formatMinutes(bag.pickup.start)}–{formatMinutes(bag.pickup.end)} ·{' '}
                {formatPrice(bag.price)} ·{' '}
                <Link to="/partner/listing" className="font-medium text-brand hover:underline">
                  Edit
                </Link>
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Check a pickup code">
          <CodeCheck onDone={reload} />
        </Panel>
      </div>

      <Panel
        className="mt-5"
        title={toCollect.length ? `${bagsToHandOver} bag${bagsToHandOver === 1 ? '' : 's'} to hand over` : 'Upcoming pickups'}
        action={
          <Link to="/partner/orders" className="text-sm font-medium text-brand hover:underline">
            All orders
          </Link>
        }
      >
        {toCollect.length === 0 ? (
          <Empty
            icon={<ClipboardList className="h-6 w-6" />}
            title="No pickups waiting"
            text={
              bag.quantity > 0 && !bag.paused
                ? 'Reservations appear here the moment a customer pays. This page refreshes by itself.'
                : 'Add bags above so customers can reserve them.'
            }
          />
        ) : (
          <ul className="divide-y divide-line/70">
            {toCollect.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-base font-semibold tracking-[0.15em]">{o.pickupCode}</span>
                  <span className="text-sm text-muted">
                    {o.quantity} bag{o.quantity > 1 ? 's' : ''} · {formatRange(o.pickupStart, o.pickupEnd, now)}
                  </span>
                </div>
                {isPickupNow(o.pickupStart, o.pickupEnd, now) && <OrderBadge status="reserved" />}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Last 7 days</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Bags rescued" value={totals.bags} emphasis>
          <p className="mt-1 text-[13px] text-mint">
            {totals.prev_bags ? `${totals.bags >= totals.prev_bags ? '+' : ''}${totals.bags - totals.prev_bags} vs week before` : 'Your first week'}
          </p>
        </Kpi>
        <Kpi label="Revenue" value={formatPrice(totals.revenue)}>
          <Delta current={totals.revenue} previous={totals.prev_revenue} label="vs week before" />
        </Kpi>
        <Kpi label="Customers" value={totals.customers}>
          <p className="mt-1 text-[13px] text-muted">Different people who reserved</p>
        </Kpi>
        <Kpi
          label="Rating"
          value={
            store.ratingCount ? (
              <span className="inline-flex items-center gap-1.5">
                {store.rating.toFixed(1)}
                <Star className="h-5 w-5 fill-sun text-sun" aria-hidden />
              </span>
            ) : (
              '—'
            )
          }
        >
          <p className="mt-1 text-[13px] text-muted">{store.ratingCount ? `${store.ratingCount.toLocaleString('en-US')} ratings` : 'No ratings yet'}</p>
        </Kpi>
      </div>

      <Panel className="mt-5" title={last14 ? `You rescued ${last14} bags in the last 14 days` : 'Bags rescued per day'}>
        {last14 ? (
          <BarChart data={series.map((d) => ({ key: d.day, label: shortDay(d.day), value: d.bags }))} format={(v) => String(Math.round(v))} unit="Bags" />
        ) : (
          <Empty icon={<Star className="h-6 w-6" />} title="Your chart starts with your first order" text="Every bag you sell through Ngopu shows up here, day by day." />
        )}
      </Panel>
    </>
  )
}

/* Surprise Bag editor ----------------------------------------------------- */

function toTime(minutes: number) {
  return formatMinutes(minutes)
}
function fromTime(v: string) {
  const [h, m] = v.split(':').map(Number)
  return h * 60 + m
}

export function BagEditor({ store, onSaved, save }: { store: ManagedStore; onSaved: (s: ManagedStore) => void; save: (body: Record<string, unknown>) => Promise<ManagedStore> }) {
  const toast = useToast()
  const initial = useMemo(
    () => ({
      title: store.bag.title,
      description: store.bag.description,
      price: String(store.bag.price),
      originalPrice: String(store.bag.originalPrice),
      pickupDay: store.bag.pickup.day,
      pickupStart: toTime(store.bag.pickup.start),
      pickupEnd: toTime(store.bag.pickup.end),
      diet: (store.bag.diet ?? '') as Diet | '',
      allergensNote: store.bag.allergensNote,
    }),
    [store],
  )
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const price = Number(form.price)
  const original = Number(form.originalPrice)
  const priceError = form.price && form.originalPrice && price > original ? 'Price should be lower than the original value.' : null
  const timeError = fromTime(form.pickupEnd) <= fromTime(form.pickupStart) ? 'Pickup must end after it starts.' : null
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const updated = await save({
        title: form.title,
        description: form.description,
        price,
        originalPrice: original,
        pickupDay: form.pickupDay,
        pickupStart: fromTime(form.pickupStart),
        pickupEnd: fromTime(form.pickupEnd),
        diet: form.diet || null,
        allergensNote: form.allergensNote,
      })
      onSaved(updated)
      toast('Surprise Bag saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Panel>
        <form onSubmit={submit} className="space-y-5 pt-3" noValidate>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </p>
          )}
          <Field label="Name">{(id) => <Input id={id} maxLength={60} value={form.title} onChange={set('title')} />}</Field>
          <Field label="What customers could get" hint="Describe the kind of food, not exact items. Contents change every day.">
            {(id, hint) => <TextArea id={id} aria-describedby={hint} maxLength={500} value={form.description} onChange={set('description')} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Original value" hint="What the contents would normally cost.">
              {(id, hint) => <Input id={id} aria-describedby={hint} inputMode="numeric" suffix="L" value={form.originalPrice} onChange={set('originalPrice')} />}
            </Field>
            <Field
              label="Ngopu price"
              error={priceError}
              hint={!priceError && price > 0 && original > 0 ? `${discountPercent(price, original)}% off. Most stores price at about a third.` : undefined}
            >
              {(id, hint) => (
                <Input id={id} aria-describedby={hint} aria-invalid={!!priceError} inputMode="numeric" suffix="L" value={form.price} onChange={set('price')} />
              )}
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Pickup window</legend>
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
              <Select aria-label="Pickup day" value={form.pickupDay} onChange={set('pickupDay')}>
                <option value="today">Same day</option>
                <option value="tomorrow">Next day</option>
              </Select>
              <Input type="time" aria-label="From" step={900} value={form.pickupStart} onChange={set('pickupStart')} aria-invalid={!!timeError} />
              <Input type="time" aria-label="Until" step={900} value={form.pickupEnd} onChange={set('pickupEnd')} aria-invalid={!!timeError} />
            </div>
            <p className={`mt-1.5 text-[13px] ${timeError ? 'font-medium text-red-700' : 'text-muted'}`}>
              {timeError ?? 'Short windows (30–60 min) near closing time work best.'}
            </p>
          </fieldset>
          <Field label="Diet">
            {(id) => (
              <Select id={id} value={form.diet} onChange={set('diet')}>
                <option value="">No specific diet</option>
                {(Object.keys(DIET_LABELS) as Diet[]).map((d) => (
                  <option key={d} value={d}>
                    {DIET_LABELS[d]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Allergen note">{(id) => <TextArea id={id} maxLength={500} value={form.allergensNote} onChange={set('allergensNote')} />}</Field>
          <div className="flex items-center justify-end gap-2 border-t border-line pt-5">
            {dirty && (
              <Btn variant="ghost" onClick={() => setForm(initial)} disabled={busy}>
                Discard changes
              </Btn>
            )}
            <Btn type="submit" loading={busy} disabled={!dirty || !!priceError || !!timeError || !form.title}>
              Save changes
            </Btn>
          </div>
        </form>
      </Panel>

      <div>
        <p className="mb-2 text-sm font-medium text-muted">How customers see it</p>
        <div className="sticky top-6 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,40,38,0.06),0_8px_24px_-16px_rgba(16,40,38,0.18)]">
          <div className="relative h-32">
            <BagArt store={{ ...store, bag: { ...store.bag, quantity: 1 } }} className="h-full w-full" />
            <div className="absolute right-3 bottom-2.5 left-3 flex items-center gap-2">
              <StoreLogo store={{ ...store, bag: store.bag }} size={36} />
              <p className="truncate font-semibold text-white drop-shadow">{store.name}</p>
            </div>
          </div>
          <div className="px-4 pt-3 pb-4">
            <p className="truncate font-semibold">{form.title || 'Surprise Bag'}</p>
            <p className="mt-0.5 text-sm text-muted">
              Collect {form.pickupDay === 'tomorrow' ? 'tomorrow' : 'today'} {form.pickupStart} – {form.pickupEnd}
            </p>
            <div className="mt-2 flex items-end justify-between">
              <span className="text-sm text-muted">{form.diet ? DIET_LABELS[form.diet] : CATEGORIES[store.category].label}</span>
              <span className="text-right leading-tight">
                <span className="block text-xs text-muted line-through">{original ? formatPrice(original) : ''}</span>
                <span className="block text-lg font-bold text-brand">{price ? formatPrice(price) : '—'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PartnerListing() {
  const { data, error, loading, reload, setData } = useResource<PartnerOverview>('partner/overview')
  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />
  return (
    <>
      <PageTitle title="Your Surprise Bag" subtitle="The details customers see before they reserve. Set how many bags are left on the Today page." />
      <BagEditor
        store={data.store}
        save={(body) => api<{ store: ManagedStore }>('partner/bag', { method: 'PATCH', json: body }).then((r) => r.store)}
        onSaved={(store) => setData({ ...data, store })}
      />
    </>
  )
}

/* Orders ------------------------------------------------------------------ */

type OrderFilter = 'reserved' | 'collected' | 'cancelled' | 'all'

export function PartnerOrders() {
  const [filter, setFilter] = useState<OrderFilter>('reserved')
  const [cancelling, setCancelling] = useState<DashOrder | null>(null)
  const { data, error, loading, reload } = useResource<{ orders: DashOrder[] }>('partner/orders', 30_000)
  const now = useNow(15_000)
  const orders = data?.orders ?? []
  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
  const count = (s: OrderFilter) => (s === 'all' ? orders.length : orders.filter((o) => o.status === s).length)

  const columns: Column<DashOrder>[] = [
    { key: 'code', header: 'Code', render: (o) => <span className="font-mono font-semibold tracking-[0.12em]">{o.pickupCode}</span> },
    { key: 'pickup', header: 'Pickup', sort: (o) => o.pickupStart, render: (o) => formatRange(o.pickupStart, o.pickupEnd, now) },
    { key: 'qty', header: 'Bags', align: 'right', sort: (o) => o.quantity, render: (o) => o.quantity },
    { key: 'total', header: 'Paid', align: 'right', sort: (o) => o.unitPrice * o.quantity, render: (o) => formatPrice(o.unitPrice * o.quantity) },
    {
      key: 'placed',
      header: 'Reserved',
      sort: (o) => o.createdAt,
      render: (o) => <span className="text-muted">{new Date(o.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <span className="inline-flex items-center gap-1.5">
          <OrderBadge status={orderState(o, now)} />
          {o.cancelledBy === 'store' && <span className="text-xs text-muted">by you</span>}
          {o.complaint && <span className="text-xs font-medium text-[#a1261a]">complaint</span>}
        </span>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      render: (o) =>
        o.rating ? (
          <span className="inline-flex items-center gap-1">
            {o.rating} <Star className="h-3.5 w-3.5 fill-sun text-sun" aria-label="stars" />
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (o) =>
        orderState(o, now) === 'reserved' ? (
          <Btn size="sm" variant="quiet-danger" onClick={() => setCancelling(o)}>
            Can’t honour
          </Btn>
        ) : null,
    },
  ]

  return (
    <>
      <PageTitle title="Orders" subtitle="Every reservation for your store. Refreshes every 30 seconds." />
      {cancelling && (
        <CancelOrderDialog
          order={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null)
            reload()
          }}
        />
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel
          title={
            <Segmented
              label="Filter orders"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'reserved', label: 'To collect', count: count('reserved') },
                { value: 'collected', label: 'Collected', count: count('collected') },
                { value: 'cancelled', label: 'Cancelled', count: count('cancelled') },
                { value: 'all', label: 'All', count: count('all') },
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
              rows={shown}
              columns={columns}
              initialSort={{ key: filter === 'reserved' ? 'pickup' : 'placed', dir: filter === 'reserved' ? 'asc' : 'desc' }}
              empty={
                <Empty
                  icon={<ClipboardList className="h-6 w-6" />}
                  title={filter === 'reserved' ? 'Nothing to collect right now' : 'No orders here yet'}
                  text="New reservations appear automatically."
                />
              }
            />
          )}
        </Panel>
        <Panel title="Check a pickup code" className="self-start">
          <CodeCheck onDone={reload} />
        </Panel>
      </div>
    </>
  )
}

const CANCEL_REASONS = ['We closed early today', 'We ran out of food', 'Something else']

/** The store can't honour a reservation: the customer gets a full refund and is told why. */
function CancelOrderDialog({ order, onClose, onDone }: { order: DashOrder; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [reason, setReason] = useState(CANCEL_REASONS[0]!)
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`partner/orders/${order.id}/cancel`, { method: 'POST', json: { reason: reason === 'Something else' ? other : reason } })
      toast('Order cancelled. The customer gets a full refund.')
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not cancel.', 'error')
      setBusy(false)
    }
  }
  return (
    <Dialog title={`Cancel order ${order.pickupCode}?`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[15px] text-muted">
          The customer gets a full refund of {formatPrice(order.unitPrice * order.quantity)} and no commission is charged. Frequent cancellations are reviewed by
          Ngopu, because customers rely on their reservation.
        </p>
        <Field label="Why?">
          {(id) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              {CANCEL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          )}
        </Field>
        {reason === 'Something else' && (
          <Field label="Tell the customer what happened">{(id) => <TextArea id={id} value={other} onChange={(e) => setOther(e.target.value)} required />}</Field>
        )}
        <div className="flex gap-2">
          <Btn type="submit" variant="danger" loading={busy} disabled={reason === 'Something else' && !other.trim()}>
            Cancel and refund
          </Btn>
          <Btn variant="ghost" onClick={onClose}>
            Keep order
          </Btn>
        </div>
      </form>
    </Dialog>
  )
}

/* Store profile ----------------------------------------------------------- */

export function StoreProfileForm({
  store,
  save,
  onSaved,
  extra,
}: {
  store: ManagedStore
  save: (body: Record<string, unknown>) => Promise<ManagedStore>
  onSaved: (s: ManagedStore) => void
  extra?: React.ReactNode
}) {
  const toast = useToast()
  const initial = useMemo(
    () => ({
      name: store.name,
      branch: store.branch ?? '',
      category: store.category,
      address: store.address,
      lat: String(store.lat),
      lng: String(store.lng),
      contactName: store.contactName ?? '',
      contactPhone: store.contactPhone ?? '',
    }),
    [store],
  )
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })
  const lat = Number(form.lat)
  const lng = Number(form.lng)
  const coordsOk = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

  const locate = () => {
    setLocating(true)
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) }))
        setLocating(false)
      },
      () => {
        setLocating(false)
        toast('Couldn’t get your location', 'error')
      },
      { timeout: 10_000 },
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const updated = await save({ ...form, lat, lng, branch: form.branch || null })
      onSaved(updated)
      toast('Store profile saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const preview = { ...store, lat: coordsOk ? lat : store.lat, lng: coordsOk ? lng : store.lng }

  return (
    <Panel>
      <form onSubmit={submit} className="space-y-5 pt-3" noValidate>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name">{(id) => <Input id={id} value={form.name} onChange={set('name')} />}</Field>
          <Field label="Branch or area (optional)">{(id) => <Input id={id} value={form.branch} onChange={set('branch')} placeholder="e.g. Blloku" />}</Field>
          <Field label="Type of store">
            {(id) => (
              <Select id={id} value={form.category} onChange={set('category')}>
                {CATEGORY_ORDER.map((c: Category) => (
                  <option key={c} value={c}>
                    {CATEGORIES[c].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Pickup address">{(id) => <Input id={id} value={form.address} onChange={set('address')} />}</Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Map location</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input aria-label="Latitude" inputMode="decimal" value={form.lat} onChange={set('lat')} aria-invalid={!coordsOk} />
            <Input aria-label="Longitude" inputMode="decimal" value={form.lng} onChange={set('lng')} aria-invalid={!coordsOk} />
            <Btn variant="secondary" onClick={locate} loading={locating}>
              <LocateFixed className="h-4 w-4" /> I’m at the store
            </Btn>
          </div>
          <div className="mt-3 h-44 overflow-hidden rounded-xl ring-1 ring-line">
            <MapView
              listings={[{ store: preview, distance: 0, start: 0, end: 0 }]}
              location={{ label: store.name, lat: preview.lat, lng: preview.lng, radiusKm: 1 }}
              interactive={false}
              zoom={16}
              className="h-full w-full"
            />
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name">{(id) => <Input id={id} value={form.contactName} onChange={set('contactName')} />}</Field>
          <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.contactPhone} onChange={set('contactPhone')} />}</Field>
        </div>
        {extra}
        <div className="flex items-center justify-end gap-2 border-t border-line pt-5">
          {dirty && (
            <Btn variant="ghost" onClick={() => setForm(initial)} disabled={busy}>
              Discard changes
            </Btn>
          )}
          <Btn type="submit" loading={busy} disabled={!dirty || !coordsOk || !form.name || !form.address}>
            Save changes
          </Btn>
        </div>
      </form>
    </Panel>
  )
}

export function PartnerStore() {
  const { data, error, loading, reload, setData } = useResource<PartnerOverview>('partner/overview')
  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />
  return (
    <>
      <PageTitle
        title="Store profile"
        subtitle={
          <span className="inline-flex items-center gap-2">
            How your store appears in the app <StatusBadge status={data.store.status} />
          </span>
        }
      />
      <StoreProfileForm
        store={data.store}
        save={(body) => api<{ store: ManagedStore }>('partner/store', { method: 'PATCH', json: body }).then((r) => r.store)}
        onSaved={(store) => setData({ ...data, store })}
        extra={
          <p className="text-sm text-muted">
            Login email: <span className="font-medium text-ink">{data.store.contactEmail}</span>. To change it, contact the Ngopu team.
          </p>
        }
      />
    </>
  )
}
