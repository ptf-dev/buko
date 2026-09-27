import { CheckCircle2, Minus, Plus, ShoppingBag, TrendingUp, XCircle } from 'lucide-react'
import { useState } from 'react'
import { StoreLogo } from '../components/BagArt'
import { Button } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { formatPrice, formatRange } from '../lib/format'
import { useAppState, useDispatch, useNow } from '../state/store'

/**
 * Lightweight "Buko for Business" dashboard: a store can set today's bag
 * count, see reservations and validate pickup codes at the counter.
 */
export function Partner() {
  const now = useNow()
  const { stores, orders } = useAppState()
  const dispatch = useDispatch()
  const [storeId, setStoreId] = useState(stores[0]!.id)
  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const store = stores.find((s) => s.id === storeId)!
  const storeOrders = orders.filter((o) => o.storeId === storeId)
  const reserved = storeOrders.filter((o) => o.status === 'reserved')
  const collected = storeOrders.filter((o) => o.status === 'collected')
  const revenue = [...reserved, ...collected].reduce((n, o) => n + o.unitPrice * o.quantity, 0)

  const validate = () => {
    const order = reserved.find((o) => o.pickupCode === code.trim().toUpperCase())
    if (!order) {
      setResult({ ok: false, text: 'No active order with that code for this store.' })
      return
    }
    dispatch({ type: 'collectOrder', orderId: order.id, now: Date.now() })
    setResult({ ok: true, text: `Order #${order.id.toUpperCase()} collected — ${order.quantity} bag(s). Hand them over!` })
    setCode('')
  }

  return (
    <div className="bg-cream pb-10">
      <PageHeader title="Buko for Business" back />
      <section className="bg-white px-4 py-4">
        <label className="block text-sm font-semibold">
          Your store
          <select
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value)
              setResult(null)
            }}
            className="mt-1 h-11 w-full rounded-xl bg-cream px-3 font-normal"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.branch ? ` – ${s.branch}` : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex items-center gap-3">
          <StoreLogo store={store} size={48} />
          <div>
            <p className="font-bold">{store.bag.title}</p>
            <p className="text-sm text-muted">
              {formatPrice(store.bag.price)} · worth {formatPrice(store.bag.originalPrice)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-2 grid grid-cols-3 gap-2 bg-white px-4 py-4">
        <Kpi icon={<ShoppingBag className="h-5 w-5" />} value={String(reserved.reduce((n, o) => n + o.quantity, 0))} label="To collect" />
        <Kpi icon={<CheckCircle2 className="h-5 w-5" />} value={String(collected.reduce((n, o) => n + o.quantity, 0))} label="Collected" />
        <Kpi icon={<TrendingUp className="h-5 w-5" />} value={formatPrice(revenue)} label="Revenue" />
      </section>

      <section className="mt-2 bg-white px-4 py-4">
        <h2 className="font-bold">Bags available today</h2>
        <p className="text-sm text-muted">Adjust as you see what’s left at the end of the day.</p>
        <div className="mt-3 flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Remove a bag"
            onClick={() => dispatch({ type: 'setBagQuantity', storeId, quantity: store.bag.quantity - 1 })}
            disabled={store.bag.quantity <= 0}
            className="flex h-12 w-12 items-center justify-center rounded-full text-brand ring-2 ring-brand disabled:text-line disabled:ring-line"
          >
            <Minus className="h-6 w-6" />
          </button>
          <span className="w-12 text-center text-4xl font-bold">{store.bag.quantity}</span>
          <button
            type="button"
            aria-label="Add a bag"
            onClick={() => dispatch({ type: 'setBagQuantity', storeId, quantity: store.bag.quantity + 1 })}
            className="flex h-12 w-12 items-center justify-center rounded-full text-brand ring-2 ring-brand"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </section>

      <section className="mt-2 bg-white px-4 py-4">
        <h2 className="font-bold">Validate a pickup</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Pickup code"
            maxLength={6}
            aria-label="Pickup code"
            className="h-12 min-w-0 flex-1 rounded-xl bg-cream px-4 font-mono text-lg tracking-widest uppercase"
          />
          <Button onClick={validate} disabled={code.trim().length < 6}>
            Check
          </Button>
        </div>
        {result && (
          <p className={`mt-3 flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${result.ok ? 'bg-brand-light text-brand' : 'bg-red-50 text-red-700'}`}>
            {result.ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {result.text}
          </p>
        )}
      </section>

      <section className="mt-2 bg-white px-4 py-4">
        <h2 className="font-bold">Reservations</h2>
        {storeOrders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No reservations yet. Reserve a bag from the customer app to see it here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {storeOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-mono font-semibold tracking-wider">{o.pickupCode}</p>
                  <p className="text-muted">
                    {o.quantity} bag(s) · {formatRange(o.pickupStart, o.pickupEnd, now)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    o.status === 'reserved' ? 'bg-brand text-white' : o.status === 'collected' ? 'bg-brand-light text-brand' : 'bg-line text-muted'
                  }`}
                >
                  {o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Kpi({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-brand-light p-3 text-brand">
      {icon}
      <p className="mt-2 truncate text-lg font-bold text-brand-dark">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  )
}
