import {
  ArrowLeft,
  CircleAlert,
  Clock,
  Leaf,
  MapPin,
  Maximize2,
  Navigation,
  Share2,
  ShoppingBag,
  Star,
  ThumbsUp,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BagArt, StoreLogo } from '../components/BagArt'
import { QuantityPill } from '../components/BagCard'
import { Button } from '../components/Button'
import { FavouriteButton } from '../components/FavouriteButton'
import { Sheet } from '../components/Sheet'
import { MapView } from '../components/LazyMap'
import { EmptyState } from '../components/PageHeader'
import { CATEGORIES, DIET_LABELS } from '../data/categories'
import { discountPercent, formatDistance, formatPrice, formatRange, isPickupNow, timeUntil } from '../lib/format'
import { publicUrl, shareContent } from '../lib/native'
import { useAppState, useNow } from '../state/store'
import { useListings } from '../state/useListings'
import { CheckoutSheet } from './CheckoutSheet'

export function StoreDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const now = useNow()
  const { location, orders } = useAppState()
  const { all } = useListings(now)
  const listing = all.find((l) => l.store.id === id)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [shared, setShared] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)

  if (!listing) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-9 w-9" />}
        title="Store not found"
        text="This store may no longer be on Ngopu."
        action={<Button onClick={() => navigate('/')}>Back to Discover</Button>}
      />
    )
  }

  const { store, distance, start, end } = listing
  const { bag } = store
  const soldOut = bag.quantity <= 0
  const activeOrder = orders.find((o) => o.storeId === store.id && o.status === 'reserved')
  const meta = CATEGORIES[store.category]
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`
  // Show you and the store together when you're in the same area; otherwise just the store.
  const meNearby = distance <= 15
  const mapPoints: [number, number][] = meNearby
    ? [
        [store.lat, store.lng],
        [location.lat, location.lng],
      ]
    : [[store.lat, store.lng]]

  const share = async () => {
    const result = await shareContent({
      title: store.name,
      text: `${bag.title} at ${store.name} on Ngopu`,
      url: publicUrl(`/store/${store.id}`),
    })
    if (result === 'copied') {
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    }
  }

  return (
    <div className="relative min-h-full bg-cream pb-28">
      <div className="relative h-56">
        <BagArt store={store} className="h-full w-full" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <button
            type="button"
            aria-label="Back"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Share"
              onClick={share}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <FavouriteButton storeId={store.id} />
          </div>
        </div>
        {shared && (
          <p className="animate-fade-in absolute top-14 right-3 rounded-full bg-ink px-3 py-1 text-xs text-white">Link copied</p>
        )}
        <div className="absolute bottom-3 left-4 flex items-center gap-3">
          <StoreLogo store={store} size={52} />
          <div className="text-white drop-shadow">
            <h1 className="text-xl leading-tight font-bold">{store.name}</h1>
            {store.branch && <p className="text-sm">{store.branch}</p>}
          </div>
        </div>
        <div className="absolute right-4 bottom-4">
          <QuantityPill quantity={bag.quantity} isNew={bag.isNew} />
        </div>
      </div>

      <section className="bg-white px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <meta.icon className="h-4 w-4" /> {meta.label}
              {bag.diet && <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand">{DIET_LABELS[bag.diet]}</span>}
            </p>
            <h2 className="mt-1 text-lg font-bold">{bag.title}</h2>
            <p className="mt-1 flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-brand text-brand" />
              <span className="font-semibold">{store.rating.toFixed(1)}</span>
              <span className="text-muted">({store.ratingCount.toLocaleString('en-US')})</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="rounded-md bg-sun px-1.5 py-0.5 text-xs font-bold">-{discountPercent(bag.price, bag.originalPrice)}%</span>
            <p className="mt-1 text-sm text-muted line-through">{formatPrice(bag.originalPrice)}</p>
            <p className="text-2xl font-bold text-brand">{formatPrice(bag.price)}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-cream p-3">
          <Clock className="h-5 w-5 shrink-0 text-brand" />
          <div className="text-sm">
            <p className="font-semibold">Pick up: {formatRange(start, end, now)}</p>
            <p className="text-muted">
              {isPickupNow(start, end, now) ? 'Pickup window is open now' : `Opens in ${timeUntil(start, now)}`}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-2 bg-white px-4 py-4">
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3">
          <MapPin className="h-5 w-5 shrink-0 text-brand" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{store.address}</p>
            <p className="text-muted">{formatDistance(distance)} from {location.label}</p>
          </div>
          <Navigation className="h-5 w-5 text-brand" />
        </a>
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          aria-label={`Open map of ${store.name}`}
          className="relative mt-3 block h-44 w-full overflow-hidden rounded-xl ring-1 ring-line"
        >
          <MapView
            listings={[listing]}
            location={{ ...location, lat: store.lat, lng: store.lng }}
            interactive={false}
            showRadius={false}
            me={meNearby ? { lat: location.lat, lng: location.lng } : null}
            fitPoints={mapPoints}
            className="pointer-events-none h-full w-full"
          />
          <span className="absolute right-2.5 bottom-2.5 z-[500] flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand shadow">
            <Maximize2 className="h-3.5 w-3.5" /> Open map
          </span>
        </button>
      </section>

      <section className="mt-2 bg-white px-4 py-4">
        <h3 className="font-bold">What you could get</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink/80">{bag.description}</p>
        <p className="mt-2 text-sm text-muted">
          It’s a surprise! Stores can’t predict exactly what will be left at the end of the day, so the contents of
          your bag will vary.
        </p>
        <div className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-3 text-sm">
          <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <p>
            <span className="font-semibold">Ingredients & allergens. </span>
            {bag.allergensNote}
          </p>
        </div>
      </section>

      <section className="mt-2 bg-white px-4 py-4">
        <h3 className="font-bold">What other people are saying</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {store.highlights.map((h) => (
            <span key={h} className="flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1.5 text-sm font-medium text-brand">
              <ThumbsUp className="h-4 w-4" /> {h}
            </span>
          ))}
        </div>
        <ul className="mt-4 space-y-3">
          {store.reviews.map((r) => (
            <li key={r.author} className="rounded-xl bg-cream p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{r.author}</span>
                <span className="flex">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-brand text-brand' : 'text-line'}`} />
                  ))}
                </span>
              </div>
              <p className="mt-1 text-ink/80">“{r.text}”</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-2 flex items-center gap-3 bg-white px-4 py-4 text-sm">
        <Leaf className="h-8 w-8 shrink-0 text-brand" />
        <p>
          Every bag you rescue saves around <span className="font-semibold">2.7 kg of CO₂e</span> — the same as charging
          a smartphone 340 times.
        </p>
      </section>

      <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-line bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {activeOrder ? (
          <Link to={`/orders/${activeOrder.id}`} className="block">
            <Button variant="secondary" className="w-full">
              View your order
            </Button>
          </Link>
        ) : (
          <Button className="w-full" disabled={soldOut} onClick={() => setCheckoutOpen(true)}>
            {soldOut ? 'Sold out' : 'Reserve'}
          </Button>
        )}
      </div>

      <Sheet
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        title={store.name}
        footer={
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="block">
            <Button className="w-full">
              <Navigation className="h-5 w-5" /> Get directions · {formatDistance(distance)}
            </Button>
          </a>
        }
      >
        <p className="-mt-1 mb-3 text-sm text-muted">{store.address}</p>
        <div className="relative h-[60vh] overflow-hidden rounded-2xl ring-1 ring-line">
          {mapOpen && (
            <MapView
              listings={[listing]}
              location={{ ...location, lat: store.lat, lng: store.lng }}
              showRadius={false}
              me={meNearby ? { lat: location.lat, lng: location.lng } : null}
              fitPoints={mapPoints}
              zoomControls
              className="absolute inset-0 z-0"
            />
          )}
        </div>
        {meNearby && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-[#2f7cf6] shadow" aria-hidden /> {location.label}
          </p>
        )}
      </Sheet>

      <CheckoutSheet open={checkoutOpen} onClose={() => setCheckoutOpen(false)} listing={listing} />
    </div>
  )
}
