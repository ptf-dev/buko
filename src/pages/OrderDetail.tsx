import { CalendarPlus, Check, Clock, Leaf, Lock, MapPin, MessageSquareWarning, Navigation, PartyPopper, Receipt, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { StoreLogo } from '../components/BagArt'
import { Button, Chip } from '../components/Button'
import { EmptyState, PageHeader } from '../components/PageHeader'
import { Sheet } from '../components/Sheet'
import { SwipeToConfirm } from '../components/SwipeToConfirm'
import { RATING_TAGS } from '../data/categories'
import { co2eKg, formatPrice, formatRange, isPickupNow, timeUntil } from '../lib/format'
import { isNative } from '../lib/native'
import { useAccount, useAppState, useNow, useOrderActions, useSync } from '../state/store'
import { PAYMENT_METHODS } from './CheckoutSheet'

/** Swipe to collect unlocks this long before the pickup window opens (matches the server). */
const EARLY_COLLECT_MS = 15 * 60_000

const formatTime = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** Customers can cancel for a full refund until this long before pickup starts. */
const CANCEL_CUTOFF_MS = 2 * 60 * 60_000

function toIcsDate(ms: number) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function OrderDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const now = useNow(10_000)
  const { orders, stores } = useAppState()
  const actions = useOrderActions()
  const { refresh } = useSync()
  // Pick up changes made at the store (e.g. the partner validated the pickup code).
  useEffect(() => {
    refresh()
  }, [refresh])
  const [actionError, setActionError] = useState('')
  const run = (fn: () => Promise<unknown>) =>
    fn().then(
      () => setActionError(''),
      (err: unknown) => setActionError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'),
    )
  const order = orders.find((o) => o.id === id)
  const store = order && stores.find((s) => s.id === order.storeId)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const justReserved = params.get('new') === '1'

  if (!order || !store) {
    return (
      <>
        <PageHeader title="Order" back />
        <EmptyState icon={<Receipt className="h-9 w-9" />} title="Order not found" text="We couldn’t find this order." />
      </>
    )
  }

  const live = isPickupNow(order.pickupStart, order.pickupEnd, now)
  const missed = order.status === 'reserved' && now > order.pickupEnd
  const canCancel = order.status === 'reserved' && order.pickupStart - now > CANCEL_CUTOFF_MS
  const total = order.unitPrice * order.quantity
  const saved = (order.unitOriginalPrice - order.unitPrice) * order.quantity
  const payment = PAYMENT_METHODS.find((m) => m.value === order.paymentMethod)
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`

  const calendarHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `UID:${order.id}@ngopu`,
      `DTSTART:${toIcsDate(order.pickupStart)}`,
      `DTEND:${toIcsDate(order.pickupEnd)}`,
      `SUMMARY:Pick up Ngopu bag at ${store.name}`,
      `LOCATION:${store.address}`,
      `DESCRIPTION:Pickup code ${order.pickupCode}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'),
  )}`

  return (
    <div className="min-h-full bg-cream pb-10">
      <PageHeader title="Your order" back />
      {actionError && (
        <p role="alert" className="bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {actionError}
        </p>
      )}

      {justReserved && order.status === 'reserved' && (
        <div className="animate-fade-in bg-brand px-4 py-6 text-center text-white">
          <div className="animate-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand">
            <PartyPopper className="h-8 w-8" />
          </div>
          <h2 className="mt-3 text-xl font-bold">Hooray! Your bag is reserved</h2>
          <p className="mt-1 text-sm text-mint">
            You’re about to save food from going to waste. Your pickup code and receipt are saved below and in Orders.
          </p>
          <button
            type="button"
            onClick={() => {
              params.delete('new')
              setParams(params, { replace: true })
            }}
            className="mt-3 text-sm font-semibold underline"
          >
            Got it
          </button>
        </div>
      )}

      <section className="bg-white px-4 py-4">
        <Link to={`/store/${store.id}`} className="flex items-center gap-3">
          <StoreLogo store={store} size={48} />
          <div className="min-w-0">
            <p className="truncate font-bold">{store.name}</p>
            <p className="text-sm text-muted">
              {order.quantity} × {store.bag.title}
            </p>
          </div>
        </Link>

        {order.status === 'reserved' && !missed && (
          <div className="mt-4 rounded-2xl bg-brand-light p-4 text-center">
            <p className="text-sm font-medium text-brand">Show this at the store</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.25em] text-brand-dark" aria-label="Pickup code">
              {order.pickupCode}
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm">
              <Clock className="h-4 w-4" />
              {formatRange(order.pickupStart, order.pickupEnd, now)}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {live ? 'Pickup window is open — head over now!' : `Pickup opens in ${timeUntil(order.pickupStart, now)}`}
            </p>
            {order.paymentMethod === 'cash' && (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink">
                Pay {formatPrice(total)} in cash when you collect
              </p>
            )}
          </div>
        )}

        {order.status === 'collected' && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand p-4 text-white">
            <Check className="h-8 w-8 shrink-0 rounded-full bg-white p-1.5 text-brand" />
            <div>
              <p className="font-bold">Collected — enjoy!</p>
              <p className="text-sm text-mint">
                You saved {formatPrice(saved)} and {co2eKg(order.quantity)} kg CO₂e.
              </p>
            </div>
          </div>
        )}
        {order.status === 'cancelled' && order.paymentMethod === 'cash' && (
          <p className="mt-4 rounded-2xl bg-line p-4 text-sm font-medium">
            {order.cancelledBy === 'store'
              ? `${store.name} had to cancel this order${order.cancelReason ? `: “${order.cancelReason}”` : ''}. We’re sorry.`
              : 'This order was cancelled.'}{' '}
            You weren’t charged.
          </p>
        )}
        {order.status === 'cancelled' && order.paymentMethod !== 'cash' && (
          <p className="mt-4 rounded-2xl bg-line p-4 text-sm font-medium">
            {order.cancelledBy === 'store'
              ? `${store.name} had to cancel this order${order.cancelReason ? `: “${order.cancelReason}”` : ''}. We’re sorry. `
              : 'This order was cancelled and '}
            {order.cancelledBy === 'store' ? `${formatPrice(total)} is refunded` : `${formatPrice(total)} has been refunded`} to your{' '}
            {payment?.label ?? 'payment method'}.
          </p>
        )}
        {missed && (
          <p className="mt-4 rounded-2xl bg-line p-4 text-sm font-medium">
            The pickup window for this order has ended. Contact support if you couldn’t collect it.
          </p>
        )}
      </section>

      {order.status === 'reserved' && !missed && (
        <section className="mt-2 bg-white px-4 py-4">
          {now >= order.pickupStart - EARLY_COLLECT_MS ? (
            <>
              <SwipeToConfirm label="Swipe to collect" onConfirm={() => run(() => actions.collect(order.id))} />
              <p className="mt-2 text-center text-xs text-muted">Only swipe when you’re at the store and staff are handing you your bag.</p>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-full bg-cream px-2 py-2" role="status">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-muted shadow-sm">
                <Lock className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm">
                <span className="block font-semibold text-ink">Swipe to collect unlocks at {formatTime(order.pickupStart - EARLY_COLLECT_MS)}</span>
                <span className="block text-muted">Come to the store during the pickup window.</span>
              </p>
            </div>
          )}
        </section>
      )}

      {order.status === 'collected' && (
        <section className="mt-2 bg-white px-4 py-4">
          {order.rating ? (
            <div>
              <h3 className="font-bold">Thanks for your rating!</h3>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={`h-6 w-6 ${i < order.rating! ? 'fill-brand text-brand' : 'text-line'}`} />
                ))}
              </div>
              {!!order.ratingTags?.length && <p className="mt-2 text-sm text-muted">{order.ratingTags.join(' · ')}</p>}
            </div>
          ) : (
            <div>
              <h3 className="font-bold">How was your bag?</h3>
              <div className="mt-3 flex justify-center gap-2" role="radiogroup" aria-label="Rating">
                {Array.from({ length: 5 }, (_, i) => (
                  <button key={i} type="button" role="radio" aria-checked={rating === i + 1} aria-label={`${i + 1} stars`} onClick={() => setRating(i + 1)}>
                    <Star className={`h-10 w-10 transition ${i < rating ? 'fill-sun text-sun' : 'text-line'}`} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <>
                  <p className="mt-4 text-sm font-semibold">What did you like?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {RATING_TAGS.map((t) => (
                      <Chip key={t} active={tags.includes(t)} onClick={() => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))}>
                        {t}
                      </Chip>
                    ))}
                  </div>
                  <Button className="mt-4 w-full" onClick={() => run(() => actions.rate(order.id, rating, tags))}>
                    Submit rating
                  </Button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {order.status === 'collected' && <ProblemReport order={order} storeName={store.name} />}

      <section className="mt-2 space-y-3 bg-white px-4 py-4 text-sm">
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3">
          <MapPin className="h-5 w-5 shrink-0 text-brand" />
          <span className="flex-1">{store.address}</span>
          <Navigation className="h-5 w-5 text-brand" />
        </a>
        {order.status === 'reserved' && !missed && !isNative && (
          <a href={calendarHref} download={`ngopu-${order.pickupCode}.ics`} className="flex items-center gap-3 font-medium text-brand">
            <CalendarPlus className="h-5 w-5" /> Add pickup to calendar
          </a>
        )}
      </section>

      <section className="mt-2 bg-white px-4 py-4 text-sm">
        <h3 className="mb-2 font-bold">Receipt</h3>
        <div className="space-y-1.5">
          <Row label="Order number" value={`#${order.id.toUpperCase()}`} />
          <Row label="Reserved" value={new Date(order.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} />
          <Row label="Payment" value={order.paymentMethod === 'cash' ? (order.status === 'collected' ? 'Paid in cash' : 'Cash at pickup') : (payment?.label ?? order.paymentMethod)} />
          <Row label={`${order.quantity} × ${formatPrice(order.unitPrice)}`} value={formatPrice(total)} />
          <Row label="You save" value={formatPrice(saved)} highlight />
        </div>
        <p className="mt-3 flex items-center gap-2 text-brand">
          <Leaf className="h-4 w-4" /> {co2eKg(order.quantity)} kg CO₂e avoided
        </p>
      </section>

      {order.status === 'reserved' && !missed && (
        <div className="px-4 pt-4">
          {canCancel ? (
            <Button variant="danger" className="w-full" onClick={() => setConfirmCancel(true)}>
              Cancel order
            </Button>
          ) : (
            <p className="text-center text-xs text-muted">
              Orders can be cancelled up to 2 hours before pickup starts.
            </p>
          )}
        </div>
      )}

      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this order?"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmCancel(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                setConfirmCancel(false)
                run(() => actions.cancel(order.id).then(() => navigate('/orders')))
              }}
            >
              Yes, cancel
            </Button>
          </div>
        }
      >
        <p className="text-muted">
          You’ll get a full refund of {formatPrice(total)} and the bag will be released for someone else to rescue.
        </p>
      </Sheet>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={highlight ? 'font-semibold text-brand' : 'font-medium'}>{value}</span>
    </div>
  )
}

/** Hours after pickup during which a problem can be reported (matches the server). */
const COMPLAINT_WINDOW_MS = 24 * 60 * 60_000

const PROBLEMS: { value: string; label: string }[] = [
  { value: 'quality', label: 'The food wasn’t good' },
  { value: 'quantity', label: 'Too little food for the price' },
  { value: 'wrong_items', label: 'Not what the bag described' },
  { value: 'store_closed', label: 'The store was closed or had no bag' },
  { value: 'staff', label: 'Problem with staff or pickup' },
  { value: 'other', label: 'Something else' },
]

function ProblemReport({ order, storeName }: { order: import('../types').Order; storeName: string }) {
  const { live } = useSync()
  const { account } = useAccount()
  const actions = useOrderActions()
  const now = useNow(60_000)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (order.complaint) {
    const k = order.complaint
    return (
      <section className="mt-2 flex gap-3 bg-white px-4 py-4 text-sm">
        <MessageSquareWarning className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <p>
          {k.status === 'open' && 'Thanks for telling us. Our team is looking into it and will get back to you within a working day.'}
          {k.status === 'refunded' && `We’ve refunded ${formatPrice((k.refundAmount ?? 0) / 100)} to your payment method. Sorry about this bag.`}
          {k.status === 'rejected' && 'We looked into your report and couldn’t offer a refund this time. Contact support if you have questions.'}
        </p>
      </section>
    )
  }
  const collectedAt = order.collectedAt ?? order.pickupEnd
  if (!live || !account || now - collectedAt > COMPLAINT_WINDOW_MS) return null

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await actions.complain(order.id, reason, details)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-2 bg-white px-4 py-3">
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 py-1 text-left text-sm font-medium">
        <MessageSquareWarning className="h-5 w-5 text-muted" aria-hidden />
        <span className="flex-1">Something wrong with your bag?</span>
        <span className="text-brand">Report a problem</span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Report a problem"
        footer={
          <>
            {error && (
              <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            <Button className="w-full" disabled={!reason || busy} onClick={submit}>
              {busy ? 'Sending…' : 'Send to Ngopu'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Tell us what went wrong with your bag from {storeName}. You can report a problem up to 24 hours after pickup.</p>
        <div className="mt-4 space-y-2" role="radiogroup" aria-label="What went wrong?">
          {PROBLEMS.map((p) => (
            <label key={p.value} className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ${reason === p.value ? 'bg-brand-light ring-brand' : 'ring-line'}`}>
              <input type="radio" name="problem" value={p.value} checked={reason === p.value} onChange={() => setReason(p.value)} className="accent-[#00615f]" />
              <span className="text-sm font-medium">{p.label}</span>
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm font-semibold">
          Details <span className="font-normal text-muted">(optional)</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1.5 w-full rounded-xl bg-cream px-3 py-2.5 text-base font-normal outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </Sheet>
    </section>
  )
}
