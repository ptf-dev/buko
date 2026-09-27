import { ChevronRight, Receipt, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StoreLogo } from '../components/BagArt'
import { Button } from '../components/Button'
import { EmptyState, PageHeader } from '../components/PageHeader'
import { formatPrice, formatRange, isPickupNow } from '../lib/format'
import { useAppState, useNow } from '../state/store'
import type { Order } from '../types'

const STATUS_LABEL: Record<Order['status'], string> = {
  reserved: 'Reserved',
  collected: 'Collected',
  cancelled: 'Cancelled',
}

export function Orders() {
  const now = useNow()
  const navigate = useNavigate()
  const { orders, stores } = useAppState()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  // A reserved order whose window has ended is treated as missed, and moves to "past".
  const upcoming = orders.filter((o) => o.status === 'reserved' && o.pickupEnd >= now).sort((a, b) => a.pickupStart - b.pickupStart)
  const past = orders.filter((o) => !upcoming.includes(o))
  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div>
      <PageHeader title="Orders" />
      <div className="sticky top-14 z-20 grid grid-cols-2 border-b border-line bg-white text-sm font-semibold">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 py-3 ${tab === t ? 'border-brand text-brand' : 'border-transparent text-muted'}`}
          >
            {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-9 w-9" />}
          title={tab === 'upcoming' ? 'No upcoming orders' : 'No past orders yet'}
          text={
            tab === 'upcoming'
              ? 'Reserve a surprise bag and it will show up here with your pickup details.'
              : 'Orders you’ve collected or cancelled will show up here.'
          }
          action={<Button onClick={() => navigate('/')}>Find a bag</Button>}
        />
      ) : (
        <ul className="space-y-3 p-4">
          {list.map((o) => {
            const store = stores.find((s) => s.id === o.storeId)
            if (!store) return null
            const missed = o.status === 'reserved' && o.pickupEnd < now
            const live = o.status === 'reserved' && isPickupNow(o.pickupStart, o.pickupEnd, now)
            return (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
                  <StoreLogo store={store} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{store.name}</p>
                    <p className="truncate text-sm text-muted">
                      {o.quantity} × {store.bag.title} · {formatPrice(o.unitPrice * o.quantity)}
                    </p>
                    <p className="mt-0.5 text-sm">{formatRange(o.pickupStart, o.pickupEnd, now)}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          live
                            ? 'bg-sun text-ink'
                            : missed || o.status === 'cancelled'
                              ? 'bg-line text-muted'
                              : o.status === 'collected'
                                ? 'bg-brand-light text-brand'
                                : 'bg-brand text-white'
                        }`}
                      >
                        {live ? 'Ready to collect' : missed ? 'Missed' : STATUS_LABEL[o.status]}
                      </span>
                      {o.status === 'collected' && !o.rating && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-brand">
                          <Star className="h-3.5 w-3.5" /> Rate your bag
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
