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
import { CardPayment } from '../components/CardPayment'
import type { PaymentInfo } from '../lib/api'
import { locale, t } from '../i18n'

/** Swipe to collect unlocks this long before the pickup window opens (matches the server). */
const EARLY_COLLECT_MS = 15 * 60_000

const formatTime = (ms: number) => new Date(ms).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })

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
      (err: unknown) => setActionError(err instanceof Error ? err.message : t('Something went wrong. Please try again.')),
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
        <PageHeader title={t('Order')} back />
        <EmptyState icon={<Receipt className="h-9 w-9" />} title={t('Order not found')} text={t('We couldn’t find this order.')} />
      </>
    )
  }

  const live = isPickupNow(order.pickupStart, order.pickupEnd, now)
  // A card order whose payment isn't finished: no pickup code until POK confirms.
  const unpaid = order.status === 'reserved' && order.paymentStatus === 'pending'
  const missed = order.status === 'reserved' && !unpaid && now > order.pickupEnd
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
      `SUMMARY:${t('Pick up Ngopu bag at {store}', { store: store.name })}`,
      `LOCATION:${store.address}`,
      `DESCRIPTION:${t('Pickup code {code}', { code: order.pickupCode })}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'),
  )}`

  return (
    <div className="min-h-full bg-cream pb-10">
      <PageHeader title={t('Your order')} back />
      {order.isDemo && (
        <p className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900">TEST ORDER · no money was charged</p>
      )}
      {actionError && (
        <p role="alert" className="bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {actionError}
        </p>
      )}

      {justReserved && order.status === 'reserved' && !unpaid && (
        <div className="animate-fade-in bg-brand px-4 py-6 text-center text-white">
          <div className="animate-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand">
            <PartyPopper className="h-8 w-8" />
          </div>
          <h2 className="mt-3 text-xl font-bold">{t('Hooray! Your bag is reserved')}</h2>
          <p className="mt-1 text-sm text-mint">
            {t('You’re about to save food from going to waste. Your pickup code and receipt are saved below and in Orders.')}
          </p>
          <button
            type="button"
            onClick={() => {
              params.delete('new')
              setParams(params, { replace: true })
            }}
            className="mt-3 text-sm font-semibold underline"
          >
            {t('Got it')}
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

        {unpaid && <FinishPayment orderId={order.id} total={total} />}

        {order.status === 'reserved' && !missed && !unpaid && (
          <div className="mt-4 rounded-2xl bg-brand-light p-4 text-center">
            <p className="text-sm font-medium text-brand">{t('Show this at the store')}</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.25em] text-brand-dark" aria-label={t('Pickup code')}>
              {order.pickupCode}
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm">
              <Clock className="h-4 w-4" />
              {formatRange(order.pickupStart, order.pickupEnd, now)}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {live ? t('Pickup window is open — head over now!') : t('Pickup opens in {time}', { time: timeUntil(order.pickupStart, now) })}
            </p>
            {order.paymentMethod === 'cash' && (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink">
                {t('Pay {amount} in cash when you collect', { amount: formatPrice(total) })}
              </p>
            )}
          </div>
        )}

        {order.status === 'collected' && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand p-4 text-white">
            <Check className="h-8 w-8 shrink-0 rounded-full bg-white p-1.5 text-brand" />
            <div>
              <p className="font-bold">{t('Collected — enjoy!')}</p>
              <p className="text-sm text-mint">
                {t('You saved {amount} and {kg} kg CO₂e.', { amount: formatPrice(saved), kg: co2eKg(order.quantity) })}
              </p>
            </div>
          </div>
        )}
        {order.status === 'cancelled' && order.paymentMethod === 'cash' && (
          <p className="mt-4 rounded-2xl bg-line p-4 text-sm font-medium">
            {order.cancelledBy === 'store'
              ? t('{store} had to cancel this order{reason}. We’re sorry.', { store: store.name, reason: order.cancelReason ? `: “${order.cancelReason}”` : '' })
              : t('This order was cancelled.')}{' '}
            {t('You weren’t charged.')}
          </p>
        )}
        {order.status === 'cancelled' && order.paymentStatus === 'failed' && (
          <p className="mt-4 rounded-2xl bg-line p-4 text-sm font-medium">{t('The payment wasn’t completed, so the bag went back on sale. You weren’t charged.')}</p>
        )}
        {order.status === 'cancelled' && order.paymentMethod !== 'cash' && order.paymentStatus !== 'failed' && (
          <p className="mt-4 rounded-2xl bg-line p-4 text-sm font-medium">
            {order.cancelledBy === 'store'
              ? t('{store} had to cancel this order{reason}. We’re sorry. {amount} is refunded to your card.', {
                  store: store.name,
                  reason: order.cancelReason ? `: “${order.cancelReason}”` : '',
                  amount: formatPrice(total),
                })
              : t('This order was cancelled and {amount} has been refunded to your card.', { amount: formatPrice(total) })}
          </p>
        )}
        {missed && (
          <p className="mt-4 rounded-2xl bg-line p-4 text-sm font-medium">
            {t('The pickup window for this order has ended. Contact support if you couldn’t collect it.')}
          </p>
        )}
      </section>

      {order.status === 'reserved' && !missed && !unpaid && (
        <section className="mt-2 bg-white px-4 py-4">
          {now >= order.pickupStart - EARLY_COLLECT_MS ? (
            <>
              <SwipeToConfirm label={t('Swipe to collect')} onConfirm={() => run(() => actions.collect(order.id))} />
              <p className="mt-2 text-center text-xs text-muted">{t('Only swipe when you’re at the store and staff are handing you your bag.')}</p>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-full bg-cream px-2 py-2" role="status">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-muted shadow-sm">
                <Lock className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm">
                <span className="block font-semibold text-ink">{t('Swipe to collect unlocks at {time}', { time: formatTime(order.pickupStart - EARLY_COLLECT_MS) })}</span>
                <span className="block text-muted">{t('Come to the store during the pickup window.')}</span>
              </p>
            </div>
          )}
        </section>
      )}

      {order.status === 'collected' && (
        <section className="mt-2 bg-white px-4 py-4">
          {order.rating ? (
            <div>
              <h3 className="font-bold">{t('Thanks for your rating!')}</h3>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={`h-6 w-6 ${i < order.rating! ? 'fill-brand text-brand' : 'text-line'}`} />
                ))}
              </div>
              {!!order.ratingTags?.length && <p className="mt-2 text-sm text-muted">{order.ratingTags.map((x) => t(x)).join(' · ')}</p>}
            </div>
          ) : (
            <div>
              <h3 className="font-bold">{t('How was your bag?')}</h3>
              <div className="mt-3 flex justify-center gap-2" role="radiogroup" aria-label={t('Rating')}>
                {Array.from({ length: 5 }, (_, i) => (
                  <button key={i} type="button" role="radio" aria-checked={rating === i + 1} aria-label={t('{n} stars', { n: i + 1 })} onClick={() => setRating(i + 1)}>
                    <Star className={`h-10 w-10 transition ${i < rating ? 'fill-sun text-sun' : 'text-line'}`} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <>
                  <p className="mt-4 text-sm font-semibold">{t('What did you like?')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {RATING_TAGS.map((tag) => (
                      <Chip key={tag} active={tags.includes(tag)} onClick={() => setTags((ts) => (ts.includes(tag) ? ts.filter((x) => x !== tag) : [...ts, tag]))}>
                        {t(tag)}
                      </Chip>
                    ))}
                  </div>
                  <Button className="mt-4 w-full" onClick={() => run(() => actions.rate(order.id, rating, tags))}>
                    {t('Submit rating')}
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
            <CalendarPlus className="h-5 w-5" /> {t('Add pickup to calendar')}
          </a>
        )}
      </section>

      <section className="mt-2 bg-white px-4 py-4 text-sm">
        <h3 className="mb-2 font-bold">{t('Receipt')}</h3>
        <div className="space-y-1.5">
          <Row label={t('Order number')} value={`#${order.id.toUpperCase()}`} />
          <Row label={t('Reserved')} value={new Date(order.createdAt).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })} />
          <Row
            label={t('Payment')}
            value={
              order.paymentMethod === 'cash'
                ? order.status === 'collected'
                  ? t('Paid in cash')
                  : t('Cash at pickup')
                : order.paymentStatus === 'pending'
                  ? t('Waiting for payment')
                  : order.paymentStatus === 'failed'
                    ? t('Not paid')
                    : t(payment?.label ?? order.paymentMethod)
            }
          />
          <Row label={`${order.quantity} × ${formatPrice(order.unitPrice)}`} value={formatPrice(total)} />
          <Row label={t('You save')} value={formatPrice(saved)} highlight />
        </div>
        <p className="mt-3 flex items-center gap-2 text-brand">
          <Leaf className="h-4 w-4" /> {t('{kg} kg CO₂e avoided', { kg: co2eKg(order.quantity) })}
        </p>
      </section>

      {order.status === 'reserved' && !missed && !unpaid && (
        <div className="px-4 pt-4">
          {canCancel ? (
            <Button variant="danger" className="w-full" onClick={() => setConfirmCancel(true)}>
              {t('Cancel order')}
            </Button>
          ) : (
            <p className="text-center text-xs text-muted">
              {t('Orders can be cancelled up to 2 hours before pickup starts.')}
            </p>
          )}
        </div>
      )}

      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t('Cancel this order?')}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmCancel(false)}>
              {t('Keep it')}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                setConfirmCancel(false)
                run(() => actions.cancel(order.id).then(() => navigate('/orders')))
              }}
            >
              {t('Yes, cancel')}
            </Button>
          </div>
        }
      >
        <p className="text-muted">
          {order.paymentMethod === 'cash'
            ? t('The bag will be released for someone else to rescue.')
            : t('You’ll get a full refund of {amount} and the bag will be released for someone else to rescue.', { amount: formatPrice(total) })}
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
          {k.status === 'open' && t('Thanks for telling us. Our team is looking into it and will get back to you within a working day.')}
          {k.status === 'refunded' && t('We’ve refunded {amount} to your payment method. Sorry about this bag.', { amount: formatPrice((k.refundAmount ?? 0) / 100) })}
          {k.status === 'rejected' && t('We looked into your report and couldn’t offer a refund this time. Contact support if you have questions.')}
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
      setError(err instanceof Error ? err.message : t('Something went wrong. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-2 bg-white px-4 py-3">
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 py-1 text-left text-sm font-medium">
        <MessageSquareWarning className="h-5 w-5 text-muted" aria-hidden />
        <span className="flex-1">{t('Something wrong with your bag?')}</span>
        <span className="text-brand">{t('Report a problem')}</span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('Report a problem')}
        footer={
          <>
            {error && (
              <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            <Button className="w-full" disabled={!reason || busy} onClick={submit}>
              {busy ? t('Sending…') : t('Send to Ngopu')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t('Tell us what went wrong with your bag from {store}. You can report a problem up to 24 hours after pickup.', { store: storeName })}</p>
        <div className="mt-4 space-y-2" role="radiogroup" aria-label={t('What went wrong?')}>
          {PROBLEMS.map((p) => (
            <label key={p.value} className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ${reason === p.value ? 'bg-brand-light ring-brand' : 'ring-line'}`}>
              <input type="radio" name="problem" value={p.value} checked={reason === p.value} onChange={() => setReason(p.value)} className="accent-[#00615f]" />
              <span className="text-sm font-medium">{t(p.label)}</span>
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm font-semibold">
          {t('Details')} <span className="font-normal text-muted">{t('(optional)')}</span>
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

/** Resume an unfinished card payment: the server checks POK first, then the form is shown again if needed. */
function FinishPayment({ orderId, total }: { orderId: string; total: number }) {
  const actions = useOrderActions()
  const [open, setOpen] = useState(false)
  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const start = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await actions.verifyPayment(orderId)
      if (!r.paid && r.payment?.sdkOrderId) {
        setPayment(r.payment)
        setOpen(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong. Please try again.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">{t('Payment not finished')}</p>
      <p className="mt-1">{t('Your bag is held for a few minutes. Finish paying to get your pickup code.')}</p>
      {error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button onClick={start} disabled={busy}>
          {busy ? t('Checking…') : t('Pay {amount}', { amount: formatPrice(total) })}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => actions.cancel(orderId).catch(() => {})}>
          {t('Cancel order')}
        </Button>
      </div>
      {open && payment && (
        <Sheet open onClose={() => setOpen(false)} title={t('Pay {amount}', { amount: formatPrice(total) })}>
          <CardPayment orderId={orderId} payment={payment} onPaid={() => setOpen(false)} />
        </Sheet>
      )}
    </div>
  )
}
