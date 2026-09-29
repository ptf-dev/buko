import { Banknote, CreditCard, Loader2, Minus, Plus, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm } from '../components/AuthForm'
import { Button } from '../components/Button'
import { Sheet } from '../components/Sheet'
import { CardPayment } from '../components/CardPayment'
import { customerApi, type CashEligibility, type PaymentConfig, type PaymentInfo } from '../lib/api'
import { formatPrice, formatRange } from '../lib/format'
import type { Listing } from '../lib/search'
import { MAX_PER_ORDER } from '../state/reducer'
import { useAccount, useAppState, useNow, useOrderActions, useSync } from '../state/store'
import type { PaymentMethod } from '../types'
import { t, translateServer } from '../i18n'
import { track } from '../lib/telemetry'

/** With POK connected the app takes cards through POK's own form (and cash for trusted customers). */
export const POK_METHODS: PaymentMethod[] = ['card', 'cash']

export const PAYMENT_METHODS: {
  value: PaymentMethod
  label: string
  detail: string
}[] = [
  { value: 'card', label: 'Card', detail: 'Visa •••• 4242' },
  { value: 'apple-pay', label: 'Apple Pay', detail: 'Pay with Face ID' },
  {
    value: 'google-pay',
    label: 'Google Pay',
    detail: 'Pay with your Google account',
  },
  { value: 'paypal', label: 'PayPal', detail: 'Log in to PayPal' },
  { value: 'cash', label: 'Cash at pickup', detail: 'Pay the store when you collect' },
]

export function CheckoutSheet({ open, onClose, listing }: { open: boolean; onClose: () => void; listing: Listing }) {
  const { live } = useSync()
  const { account } = useAccount()
  const storeId = listing.store.id
  useEffect(() => {
    if (open) track('checkout_open', { store: storeId })
  }, [open, storeId])
  if (!open) return null
  // Live reservations belong to an account; once signed in the sheet continues to checkout.
  if (live && !account)
    return (
      <Sheet open onClose={onClose} title={t('Log in to reserve')}>
        <p className="mb-4 text-sm text-muted">
          {t('Your order and pickup code are saved to your account, so you can collect even if you change phone.')}
        </p>
        <AuthForm />
      </Sheet>
    )
  return <CheckoutBody onClose={onClose} listing={listing} />
}

function CheckoutBody({ onClose, listing }: { onClose: () => void; listing: Listing }) {
  const { store, start, end } = listing
  const { paymentMethod: savedMethod } = useAppState()
  const actions = useOrderActions()
  const navigate = useNavigate()
  const now = useNow()
  const [quantity, setQuantity] = useState(1)
  const { live } = useSync()
  // Cash is offered only when the store takes it; whether this customer may use it comes from the server.
  const [cash, setCash] = useState<CashEligibility | null>(null)
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  useEffect(() => {
    if (!live) return
    let alive = true
    customerApi
      .paymentConfig()
      .then((c) => alive && setConfig(c))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [live])
  const pok = config?.provider === 'pok'
  const methods = PAYMENT_METHODS.filter((m) => (pok ? POK_METHODS.includes(m.value) : true)).map((m) =>
    pok && m.value === 'card' ? { ...m, detail: config?.cardReady ? 'Visa, Mastercard · secured by POK' : 'Card payments are being set up' } : m,
  )
  // An order waiting for its card payment: the POK form replaces the sheet's contents.
  const [pending, setPending] = useState<{ orderId: string; payment: PaymentInfo } | null>(null)
  useEffect(() => {
    if (!live || !store.acceptsCash) return
    let alive = true
    customerApi
      .me()
      .then((u) => alive && setCash(u?.cash ?? null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [live, store.acceptsCash])
  const cashOffered = live && !!store.acceptsCash
  const cashAllowed = cashOffered && !!cash?.eligible
  const [method, setMethod] = useState<PaymentMethod>(savedMethod === 'cash' ? 'card' : savedMethod)
  const payingCash = method === 'cash' && cashAllowed
  const [paying, setPaying] = useState(false)
  // Testers (TESTER_EMAILS on the server): 5 quick taps on the total switch to a test payment, nothing charged.
  const { account } = useAccount()
  const [testMode, setTestMode] = useState(false)
  const taps = useRef<number[]>([])
  const tapTotal = () => {
    if (!account?.tester || !live) return
    const t = Date.now()
    taps.current = [...taps.current.filter((x) => t - x < 3000), t]
    if (taps.current.length >= 5) {
      taps.current = []
      setTestMode((m) => !m)
    }
  }
  const [error, setError] = useState('')
  const max = Math.min(store.bag.quantity, MAX_PER_ORDER)
  const total = store.bag.price * quantity

  const pay = async () => {
    setPaying(true)
    setError('')
    try {
      // Payment is simulated; the reservation itself is real when the server is connected.
      const [{ orderId, payment }] = await Promise.all([
        actions.reserve(store.id, quantity, payingCash || method !== 'cash' ? method : 'card', testMode && !payingCash),
        new Promise((r) => setTimeout(r, pok ? 0 : 900)),
      ])
      track('order_placed', { method: payingCash ? 'cash' : testMode ? 'test' : method, quantity })
      if (payment) {
        track('payment_started')
        setPending({ orderId, payment })
        setPaying(false)
        return
      }
      navigate(`/orders/${orderId}?new=1`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong. Please try again.'))
      setPaying(false)
    }
  }

  if (pending)
    return (
      <Sheet
        open
        onClose={() => {
          // Leaving the form gives the bag back straight away rather than after the hold.
          actions.cancel(pending.orderId).catch(() => {})
          onClose()
        }}
        title={t('Pay {amount}', { amount: formatPrice(total) })}
      >
        <div className="mb-4 rounded-xl bg-cream p-3 text-sm">
          <p className="font-semibold">
            {store.name} · {quantity} × {store.bag.title}
          </p>
          <p className="text-muted">{t('Your bag is held for {n} minutes while you pay.', { n: config?.holdMinutes ?? 10 })}</p>
        </div>
        <CardPayment orderId={pending.orderId} payment={pending.payment} onPaid={() => {
            track('payment_succeeded')
            navigate(`/orders/${pending.orderId}?new=1`)
          }} />
      </Sheet>
    )

  const cardUnavailable = pok && !config?.cardReady && !payingCash && !testMode
  return (
    <Sheet
      open
      onClose={paying ? () => {} : onClose}
      title={t('Reserve your bag')}
      footer={
        <>
          {error && (
            <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <Button className="w-full" disabled={paying || max <= 0 || cardUnavailable} onClick={pay}>
            {paying ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> {t('Processing…')}
              </>
            ) : payingCash ? (
              t('Reserve · pay {amount} at pickup', { amount: formatPrice(total) })
            ) : testMode ? (
              `TEST · ${formatPrice(total)} (no charge)`
            ) : pok ? (
              t('Continue to pay {amount}', { amount: formatPrice(total) })
            ) : (
              t('Pay {amount}', { amount: formatPrice(total) })
            )}
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-cream p-3 text-sm">
        <p className="font-semibold">
          {store.name} · {store.bag.title}
        </p>
        <p className="text-muted">{t('Pick up {when}', { when: formatRange(start, end, now) })}</p>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="font-semibold">{t('Quantity')}</p>
          <p className="text-xs text-muted">{t('Max {n} per order', { n: max })}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={t('Decrease quantity')}
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => q - 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-brand text-brand disabled:ring-line disabled:text-line"
          >
            <Minus className="h-5 w-5" />
          </button>
          <span className="w-6 text-center text-xl font-bold" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label={t('Increase quantity')}
            disabled={quantity >= max}
            onClick={() => setQuantity((q) => q + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-brand text-brand disabled:ring-line disabled:text-line"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <h3 className="mt-6 mb-2 font-semibold">{t('Payment method')}</h3>
      <div className="space-y-2">
        {methods.filter((m) => m.value !== 'cash' || cashOffered).map((m) => {
          const off = m.value === 'cash' && !cashAllowed
          return (
            <label
              key={m.value}
              className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${off ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
                method === m.value && !off ? 'bg-brand-light ring-brand' : 'ring-line'
              }`}
            >
              <input
                type="radio"
                name="payment"
                value={m.value}
                checked={method === m.value && !off}
                disabled={off}
                onChange={() => setMethod(m.value)}
                className="accent-[#00615f]"
              />
              {m.value === 'card' ? (
                <CreditCard className="h-5 w-5" />
              ) : m.value === 'cash' ? (
                <Banknote className="h-5 w-5" />
              ) : (
                <Wallet className="h-5 w-5" />
              )}
              <span className="flex-1">
                <span className="block text-sm font-semibold">{t(m.label)}</span>
                <span className="block text-xs text-muted">{off ? (cash?.reason ? translateServer(cash.reason) : t('Checking…')) : t(m.detail)}</span>
              </span>
            </label>
          )
        })}
      </div>

      <div className="mt-6 space-y-1 text-sm">
        <div className="flex justify-between text-muted">
          <span>{t('Original value')}</span>
          <span className="line-through">{formatPrice(store.bag.originalPrice * quantity)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold" onClick={tapTotal}>
          <span>{t('Total')}</span>
          <span>{formatPrice(total)}</span>
        </div>
        {testMode && (
          <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
            Test payment on: no card is charged and the order is marked as a test. Tap the total 5 times to turn it off.
          </p>
        )}
      </div>

    </Sheet>
  )
}
