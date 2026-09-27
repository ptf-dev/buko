import { Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDistance, formatRange, formatPrice } from '../lib/format'
import type { Listing } from '../lib/search'
import { BagArt, StoreLogo } from './BagArt'
import { FavouriteButton } from './FavouriteButton'

export function QuantityPill({ quantity, isNew }: { quantity: number; isNew?: boolean }) {
  if (quantity <= 0)
    return <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-muted">Sold out</span>
  if (isNew && quantity > 0)
    return <span className="rounded-full bg-sun px-2.5 py-1 text-xs font-semibold text-ink">New</span>
  return (
    <span className="rounded-full bg-sun px-2.5 py-1 text-xs font-semibold text-ink">
      {quantity > 5 ? '5+' : quantity} left
    </span>
  )
}

/** Card used in the horizontal Discover carousels and the Browse list. */
export function BagCard({ listing, now, wide = false }: { listing: Listing; now: number; wide?: boolean }) {
  const { store, distance, start, end } = listing
  const { bag } = store
  const soldOut = bag.quantity <= 0
  return (
    <Link
      to={`/store/${store.id}`}
      className={`block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line transition active:scale-[0.98] ${
        wide ? 'w-full' : 'w-[280px] shrink-0 snap-start'
      }`}
    >
      <div className="relative h-32">
        <BagArt store={store} className="h-full w-full" />
        <div className="absolute top-2.5 left-2.5">
          <QuantityPill quantity={bag.quantity} isNew={bag.isNew} />
        </div>
        <FavouriteButton storeId={store.id} className="absolute top-2 right-2" />
        <div className="absolute right-3 bottom-2.5 left-3 flex items-center gap-2">
          <StoreLogo store={store} size={36} />
          <p className="truncate font-semibold text-white drop-shadow">
            {store.name}
            {store.branch ? ` – ${store.branch}` : ''}
          </p>
        </div>
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <p className="truncate font-semibold">{bag.title}</p>
        <p className="mt-0.5 text-sm text-muted">
          {soldOut ? 'Sold out for now' : `Collect ${formatRange(start, end, now)}`}
        </p>
        <div className="mt-2 flex items-end justify-between">
          <p className="flex items-center gap-1 text-sm text-muted">
            <Star className="h-4 w-4 fill-brand text-brand" />
            <span className="font-medium text-ink">{store.rating.toFixed(1)}</span>
            <span className="mx-1">|</span>
            {formatDistance(distance)}
          </p>
          <div className="text-right leading-tight">
            <p className="text-xs text-muted line-through">{formatPrice(bag.originalPrice)}</p>
            <p className="text-lg font-bold text-brand">{formatPrice(bag.price)}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}
