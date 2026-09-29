import { Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDistance, formatPrice, formatRange } from '../lib/format'
import type { Listing } from '../lib/search'
import type { Store } from '../types'
import { BagArt, StoreLogo } from './BagArt'
import { FavouriteButton } from './FavouriteButton'
import { t } from '../i18n'

/** Status pill on the photo: sold out, new, only a few left, or popular. */
export function QuantityPill({ quantity, isNew }: { quantity: number; isNew?: boolean }) {
  if (quantity <= 0) return <span className="rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-muted shadow-sm">{t('Sold out')}</span>
  if (isNew) return <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-ink shadow-sm">{t('New')}</span>
  return (
    <span className="rounded-full bg-[#fdf1c7] px-3 py-1 text-sm font-bold text-ink shadow-sm">{t('{n} left', { n: quantity > 5 ? '5+' : quantity })}</span>
  )
}

/** The badge shown on a card: urgency first (few left), then "Popular" for highly rated stores. */
function CardBadge({ store }: { store: Store }) {
  const { quantity, isNew } = store.bag
  if (quantity <= 0 || isNew || quantity <= 3) return <QuantityPill quantity={quantity} isNew={isNew} />
  if (store.rating >= 4.5 && store.ratingCount >= 50) return <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-ink shadow-sm">{t('Popular')}</span>
  return <QuantityPill quantity={quantity} />
}

export function RatingPill({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sm font-bold text-ink shadow-sm">
      <Star className="h-4 w-4 fill-brand text-brand" aria-hidden />
      {rating.toFixed(1)}
    </span>
  )
}

/** Bag card for the Discover carousels, Browse list and map preview. */
export function BagCard({ listing, now, wide = false }: { listing: Listing; now: number; wide?: boolean }) {
  const { store, distance, start, end } = listing
  const { bag } = store
  const soldOut = bag.quantity <= 0
  return (
    <Link
      to={`/store/${store.id}`}
      className={`block overflow-hidden rounded-[20px] bg-white p-1.5 shadow-[0_1px_2px_rgba(16,40,38,0.06),0_6px_18px_-10px_rgba(16,40,38,0.25)] ring-1 ring-line/60 transition active:scale-[0.985] ${
        wide ? 'w-full' : 'w-[300px] shrink-0 snap-start'
      }`}
    >
      <div className={`relative overflow-hidden rounded-2xl ${wide ? 'h-44' : 'h-40'}`}>
        <BagArt store={store} className="h-full w-full" />
        <div className="absolute top-2.5 left-2.5">
          <CardBadge store={store} />
        </div>
        {store.ratingCount > 0 && (
          <div className="absolute top-2.5 right-2.5">
            <RatingPill rating={store.rating} />
          </div>
        )}
        <div className="absolute bottom-2.5 left-2.5">
          <StoreLogo store={store} size={48} />
        </div>
      </div>
      <div className="px-2 pt-2.5 pb-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[17px] leading-snug font-bold text-ink">
            {store.name}
            {store.branch ? ` – ${store.branch}` : ''}
          </p>
          <FavouriteButton storeId={store.id} plain />
        </div>
        <p className="truncate text-[15px] text-ink/85">{bag.title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[15px] text-ink/85">
          <span className="truncate">{soldOut ? t('Sold out for now') : t('Collect {when}', { when: formatRange(start, end, now) })}</span>
          <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
          <span className="shrink-0">{formatDistance(distance)}</span>
        </p>
        <div className="mt-2.5 flex items-baseline justify-end gap-2 border-t border-dashed border-line pt-2">
          {bag.originalPrice > bag.price && <span className="text-[15px] text-muted line-through">{formatPrice(bag.originalPrice)}</span>}
          <span className="text-xl font-bold text-ink">{formatPrice(bag.price)}</span>
        </div>
      </div>
    </Link>
  )
}
