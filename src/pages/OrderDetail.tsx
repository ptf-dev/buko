import { CalendarPlus, Check, Clock, Leaf, MapPin, Navigation, PartyPopper, Receipt, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { StoreLogo } from '../components/BagArt'
import { Button, Chip } from '../components/Button'
import { EmptyState, PageHeader } from '../components/PageHeader'
import { Sheet } from '../components/Sheet'
import { SwipeToConfirm } from '../components/SwipeToConfirm'
import { RATING_TAGS } from '../data/categories'
import { co2eKg, formatPrice, formatRange, isPickupNow, timeUntil } from '../lib/format'
import { isNative } from '../lib/native'
import { useAppState, useDispatch, useNow } from '../state/store'
import { PAYMENT_METHODS } from './CheckoutSheet'

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
  const dispatch = useDispatch()
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
      `UID:${order.id}@buko`,
      `DTSTART:${toIcsDate(order.pickupStart)}`,
      `DTEND:${toIcsDate(order.pickupEnd)}`,
      `SUMMARY:Pick up Buko bag at ${store.name}`,
      `LOCATION:${store.address}`,
      `DESCRIPTION:Pickup code ${order.pickupCode}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'),
  )}`

  return (
    <div className="min-h-full bg-cream pb-10">
      <PageHeader title="Your order" back />

      {justReserved && order.status === 'reserved' && (
        <div className="animate-fade-in bg-brand px-4 py-6 text-center text-white">
          <div className="animate-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand">
            <PartyPopper className="h-8 w-8" />
          </div>
          <h2 className="mt-3 text-xl font-bold">Hooray! Your bag is reserved</h2>
          <p className="mt-1 text-sm text-mint">
            You’re about to save food from going to waste. We’ve sent a receipt to your email.
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
        {order.status === 'cancelled' && (
          <p className="mt-4 rounded-2xl bg-line p-4 text-sm font-medium">
            This order was cancelled and {formatPrice(total)} has been refunded to your {payment?.label ?? 'payment method'}.
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
          <SwipeToConfirm label="Swipe to collect" onConfirm={() => dispatch({ type: 'collectOrder', orderId: order.id, now: Date.now() })} />
          <p className="mt-2 text-center text-xs text-muted">
            Only swipe when you’re at the store and staff are handing you your bag.
          </p>
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
                  <Button className="mt-4 w-full" onClick={() => dispatch({ type: 'rateOrder', orderId: order.id, rating, tags })}>
                    Submit rating
                  </Button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <section className="mt-2 space-y-3 bg-white px-4 py-4 text-sm">
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3">
          <MapPin className="h-5 w-5 shrink-0 text-brand" />
          <span className="flex-1">{store.address}</span>
          <Navigation className="h-5 w-5 text-brand" />
        </a>
        {order.status === 'reserved' && !missed && !isNative && (
          <a href={calendarHref} download={`buko-${order.pickupCode}.ics`} className="flex items-center gap-3 font-medium text-brand">
            <CalendarPlus className="h-5 w-5" /> Add pickup to calendar
          </a>
        )}
      </section>

      <section className="mt-2 bg-white px-4 py-4 text-sm">
        <h3 className="mb-2 font-bold">Receipt</h3>
        <div className="space-y-1.5">
          <Row label="Order number" value={`#${order.id.toUpperCase()}`} />
          <Row label="Reserved" value={new Date(order.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} />
          <Row label="Payment" value={payment?.detail ?? order.paymentMethod} />
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
                dispatch({ type: 'cancelOrder', orderId: order.id })
                setConfirmCancel(false)
                navigate('/orders')
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
