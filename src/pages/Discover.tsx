import { Leaf, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BagCard } from '../components/BagCard'
import { LocationButton } from '../components/LocationButton'
import { OutOfAreaNotice } from '../components/OutOfAreaNotice'
import { EmptyState } from '../components/PageHeader'
import { Button } from '../components/Button'
import { CATEGORIES, CATEGORY_ORDER } from '../data/categories'
import { isCollectSoon } from '../lib/format'
import type { Listing } from '../lib/search'
import { useAppState, useDispatch, useNow, useSync } from '../state/store'
import { useListings } from '../state/useListings'
import type { Category } from '../types'
import { DEFAULT_FILTERS } from '../lib/search'
import { t } from '../i18n'

function Carousel({
  title,
  listings,
  now,
  onSeeAll,
}: {
  title: string
  listings: Listing[]
  now: number
  onSeeAll?: () => void
}) {
  if (!listings.length) return null
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-4">
        <h2 className="truncate text-[22px] leading-tight font-bold tracking-tight text-ink">{t(title)}</h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="shrink-0 text-[15px] font-medium text-brand underline underline-offset-4">
            {t('See all')}
          </button>
        )}
      </div>
      <div className="no-scrollbar flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2">
        {listings.map((l) => (
          <BagCard key={l.store.id} listing={l} now={now} />
        ))}
      </div>
    </section>
  )
}

/** Category tiles, with "Collect now" in the middle like the original app. */
const TILES: { key: Category | 'now'; label: string; image: string }[] = [
  ...CATEGORY_ORDER.slice(0, 3).map((c) => ({ key: c, label: CATEGORIES[c].label, image: CATEGORIES[c].image })),
  { key: 'now', label: 'Collect now', image: '/img/3d/now.png' },
  ...CATEGORY_ORDER.slice(3).map((c) => ({ key: c, label: CATEGORIES[c].label, image: CATEGORIES[c].image })),
]

export function Discover() {
  const now = useNow()
  const { favourites } = useAppState()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { all, nearby } = useListings(now)
  const { checked } = useSync()
  const available = nearby.filter((l) => l.store.bag.quantity > 0)

  const browseWith = (filters: Partial<typeof DEFAULT_FILTERS>) => {
    dispatch({ type: 'setFilters', filters: { ...DEFAULT_FILTERS, ...filters } })
    navigate('/browse')
  }

  const byRating = [...available].sort((a, b) => b.store.rating - a.store.rating)
  const collectNow = available
    .filter((l) => isCollectSoon(l.start, l.end, now))
    .sort((a, b) => a.start - b.start)
  const lastChance = available.filter((l) => l.store.bag.quantity <= 2).sort((a, b) => a.store.bag.quantity - b.store.bag.quantity)
  const nearest = [...available].sort((a, b) => a.distance - b.distance)
  const favs = nearby.filter((l) => favourites.includes(l.store.id))
  const newOnes = available.filter((l) => l.store.bag.isNew)
  const vegetarian = available.filter((l) => l.store.bag.diet)
  const byCategory = (c: Category) => available.filter((l) => l.store.category === c)

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-white/95 px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1">
            <LocationButton />
          </div>
          <span className="flex shrink-0 items-center gap-1.5" aria-label="Ngopu">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="hidden text-lg font-black tracking-tight text-brand min-[360px]:inline" aria-hidden>
              ngopu<span className="text-sun">.</span>
            </span>
          </span>
        </div>
      </header>

      <OutOfAreaNotice listings={all} className="mx-4 mt-4" />

      <nav aria-label={t('Categories')} className="no-scrollbar mt-4 flex gap-1 overflow-x-auto px-2">
        {TILES.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => (tile.key === 'now' ? browseWith({ availableNow: true, sortBy: 'distance' }) : browseWith({ categories: [tile.key] }))}
            className="flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 pt-1 pb-2 transition active:scale-95"
          >
            <img src={tile.image} alt="" className="h-[72px] w-[72px] object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.12)]" />
            <span className="text-center text-[14px] leading-tight font-medium text-ink">{t(tile.label)}</span>
          </button>
        ))}
      </nav>

      {all.length === 0 && !checked ? (
        // First launch: the store list is still on its way from the server.
        <p role="status" className="px-4 py-16 text-center text-sm text-muted">
          {t('Loading stores…')}
        </p>
      ) : nearby.length === 0 ? (
        <EmptyState
          icon={<Search className="h-9 w-9" />}
          title={t('Nothing nearby yet')}
          text={t('Try increasing the distance or choosing another location.')}
        />
      ) : (
        <>
          <Carousel title="Your favourites" listings={favs} now={now} onSeeAll={() => navigate('/favourites')} />
          <Carousel title="Popular near you" listings={byRating.slice(0, 8)} now={now} onSeeAll={() => browseWith({ sortBy: 'rating' })} />
          <Carousel title="Collect now" listings={collectNow} now={now} onSeeAll={() => browseWith({ availableNow: true, sortBy: 'distance' })} />
          <Carousel title="Save before it’s too late" listings={lastChance} now={now} />
          <Carousel title="New on Ngopu" listings={newOnes} now={now} />
          <Carousel title="Nearby" listings={nearest} now={now} onSeeAll={() => browseWith({ sortBy: 'distance' })} />
          <Carousel title="Meals" listings={byCategory('meals')} now={now} onSeeAll={() => browseWith({ categories: ['meals'] })} />
          <Carousel title="Bread & pastries" listings={byCategory('bakery')} now={now} onSeeAll={() => browseWith({ categories: ['bakery'] })} />
          <Carousel title="Groceries" listings={byCategory('groceries')} now={now} onSeeAll={() => browseWith({ categories: ['groceries'] })} />
          <Carousel title="Vegetarian & vegan" listings={vegetarian} now={now} onSeeAll={() => browseWith({ diets: ['vegetarian'] })} />
          {available.length === 0 && (
            <EmptyState
              icon={<Leaf className="h-9 w-9" />}
              title={t('Everything’s been rescued!')}
              text={t('All bags near you are sold out. Check back later or favourite stores to see them first.')}
              action={<Button onClick={() => navigate('/browse')}>{t('Browse all stores')}</Button>}
            />
          )}
        </>
      )}
    </div>
  )
}
