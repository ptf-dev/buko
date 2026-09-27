import { CreditCard, Loader2, Minus, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Sheet } from '../components/Sheet'
import { formatPrice, formatRange } from '../lib/format'
import type { Listing } from '../lib/search'
import { MAX_PER_ORDER, randomId, randomPickupCode } from '../state/reducer'
import { useAppState, useDispatch, useNow } from '../state/store'
import type { PaymentMethod } from '../types'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; detail: string }[] = [
  { value: 'card', label: 'Card', detail: 'Visa •••• 4242' },
  { value: 'apple-pay', label: 'Apple Pay', detail: 'Pay with Face ID' },
  { value: 'google-pay', label: 'Google Pay', detail: 'Pay with your Google account' },
  { value: 'paypal', label: 'PayPal', detail: 'Log in to PayPal' },
]

export function CheckoutSheet({ open, onClose, listing }: { open: boolean; onClose: () => void; listing: Listing }) {
  return open ? <CheckoutBody onClose={onClose} listing={listing} /> : null
}

function CheckoutBody({ onClose, listing }: { onClose: () => void; listing: Listing }) {
  const { store, start, end } = listing
  const { paymentMethod: savedMethod } = useAppState()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const now = useNow()
  const [quantity, setQuantity] = useState(1)
  const [method, setMethod] = useState<PaymentMethod>(savedMethod)
  const [agreed, setAgreed] = useState(false)
  const [paying, setPaying] = useState(false)
  const max = Math.min(store.bag.quantity, MAX_PER_ORDER)
  const total = store.bag.price * quantity

  const pay = () => {
    setPaying(true)
    // Simulated payment round-trip.
    setTimeout(() => {
      const orderId = randomId()
      dispatch({
        type: 'reserve',
        storeId: store.id,
        quantity,
        paymentMethod: method,
        now: Date.now(),
        orderId,
        pickupCode: randomPickupCode(),
      })
      navigate(`/orders/${orderId}?new=1`, { replace: false })
    }, 1200)
  }

  return (
    <Sheet
      open
      onClose={paying ? () => {} : onClose}
      title="Reserve your bag"
      footer={
        <Button className="w-full" disabled={!agreed || paying || max <= 0} onClick={pay}>
          {paying ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Processing…
            </>
          ) : (
            `Pay ${formatPrice(total)}`
          )}
        </Button>
      }
    >
      <div className="rounded-xl bg-cream p-3 text-sm">
        <p className="font-semibold">
          {store.name} · {store.bag.title}
        </p>
        <p className="text-muted">Pick up {formatRange(start, end, now)}</p>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="font-semibold">Quantity</p>
          <p className="text-xs text-muted">Max {max} per order</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Decrease quantity"
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
            aria-label="Increase quantity"
            disabled={quantity >= max}
            onClick={() => setQuantity((q) => q + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-brand text-brand disabled:ring-line disabled:text-line"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <h3 className="mt-6 mb-2 font-semibold">Payment method</h3>
      <div className="space-y-2">
        {PAYMENT_METHODS.map((m) => (
          <label
            key={m.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ${
              method === m.value ? 'bg-brand-light ring-brand' : 'ring-line'
            }`}
          >
            <input
              type="radio"
              name="payment"
              value={m.value}
              checked={method === m.value}
              onChange={() => setMethod(m.value)}
              className="accent-[#00615f]"
            />
            {m.value === 'card' ? <CreditCard className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
            <span className="flex-1">
              <span className="block text-sm font-semibold">{m.label}</span>
              <span className="block text-xs text-muted">{m.detail}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-6 space-y-1 text-sm">
        <div className="flex justify-between text-muted">
          <span>Original value</span>
          <span className="line-through">{formatPrice(store.bag.originalPrice * quantity)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <label className="mt-5 flex gap-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#00615f]"
        />
        <span className="text-muted">
          I understand the contents are a surprise and may contain allergens, and that I must collect my order in the
          pickup window. You can cancel up to 2 hours before pickup for a full refund.
        </span>
      </label>
    </Sheet>
  )
}
