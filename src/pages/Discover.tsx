import { ChevronRight, Leaf, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { BagCard } from '../components/BagCard'
import { LocationButton } from '../components/LocationButton'
import { OutOfAreaNotice } from '../components/OutOfAreaNotice'
import { EmptyState } from '../components/PageHeader'
import { Button } from '../components/Button'
import { CATEGORIES, CATEGORY_ORDER } from '../data/categories'
import { formatPrice, isCollectSoon } from '../lib/format'
import type { Listing } from '../lib/search'
import { computeImpact } from '../state/reducer'
import { useAppState, useDispatch, useNow } from '../state/store'
import { useListings } from '../state/useListings'
import type { Category } from '../types'
import { DEFAULT_FILTERS } from '../lib/search'

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
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between px-4">
        <h2 className="text-lg font-bold">{title}</h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="flex items-center text-sm font-semibold text-brand">
            See all <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {listings.map((l) => (
          <BagCard key={l.store.id} listing={l} now={now} />
        ))}
      </div>
    </section>
  )
}

export function Discover() {
  const now = useNow()
  const { profile, favourites, orders } = useAppState()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { all, nearby } = useListings(now)
  const available = nearby.filter((l) => l.store.bag.quantity > 0)
  const impact = computeImpact(orders)

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
      <header className="bg-white px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <LocationButton />
          <Link
            to="/profile"
            aria-label="Your impact"
            className="flex shrink-0 items-center gap-1 rounded-full bg-brand-light px-3 py-1.5 text-sm font-semibold text-brand"
          >
            <Leaf className="h-4 w-4" /> {impact.bagsSaved}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => navigate('/browse?focus=1')}
          className="mt-3 flex h-11 w-full items-center gap-2 rounded-full bg-cream px-4 text-left text-muted"
        >
          <Search className="h-5 w-5" /> Search stores and food
        </button>
      </header>

      <OutOfAreaNotice listings={all} className="mx-4 mb-4" />
      <div className="bg-white px-4 pb-4">
        <div className="relative overflow-hidden rounded-2xl bg-brand p-4 text-white">
          <p className="text-sm text-mint">{profile.name ? `Hi ${profile.name}!` : 'Hi there!'}</p>
          <p className="mt-1 text-xl leading-tight font-bold">
            {available.length} surprise bags waiting to be rescued near you
          </p>
          <p className="mt-1 text-sm text-mint">
            {impact.moneySaved > 0
              ? `You’ve saved ${formatPrice(impact.moneySaved)} so far.`
              : 'Great food, a third of the price. Good for the planet.'}
          </p>
          <Leaf className="absolute -right-4 -bottom-6 h-28 w-28 text-white/10" />
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4">
        {CATEGORY_ORDER.map((c) => {
          const Icon = CATEGORIES[c].icon
          return (
            <button
              key={c}
              type="button"
              onClick={() => browseWith({ categories: [c] })}
              className="flex w-20 shrink-0 flex-col items-center gap-1.5"
            >
              <span className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${CATEGORIES[c].gradient}`}>
                <Icon className="h-6 w-6 text-ink" />
              </span>
              <span className="text-center text-xs leading-tight font-medium">{CATEGORIES[c].label}</span>
            </button>
          )
        })}
      </div>

      {nearby.length === 0 ? (
        <EmptyState
          icon={<Search className="h-9 w-9" />}
          title="Nothing nearby yet"
          text="Try increasing the distance or choosing another location."
        />
      ) : (
        <>
          <Carousel title="Your favourites" listings={favs} now={now} onSeeAll={() => navigate('/favourites')} />
          <Carousel title="Collect now" listings={collectNow} now={now} onSeeAll={() => browseWith({ day: 'today', sortBy: 'distance' })} />
          <Carousel title="Recommended for you" listings={byRating.slice(0, 8)} now={now} onSeeAll={() => browseWith({ sortBy: 'rating' })} />
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
              title="Everything’s been rescued!"
              text="All bags near you are sold out. Check back later or favourite stores to see them first."
              action={<Button onClick={() => navigate('/browse')}>Browse all stores</Button>}
            />
          )}
        </>
      )}
    </div>
  )
}
