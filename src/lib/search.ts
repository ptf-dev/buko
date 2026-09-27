import type { Filters, Location, Store } from '../types'
import { resolveWindow } from './format'

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export interface Listing {
  store: Store
  distance: number
  start: number
  end: number
}

export function toListings(stores: Store[], location: Location, now: number): Listing[] {
  return stores.map((store) => {
    const { start, end } = resolveWindow(store.bag.pickup, now)
    return {
      store,
      distance: distanceKm(location.lat, location.lng, store.lat, store.lng),
      start,
      end,
    }
  })
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  day: 'any',
  categories: [],
  diets: [],
  hideSoldOut: false,
  sortBy: 'relevance',
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.day !== 'any' ? 1 : 0) +
    f.categories.length +
    f.diets.length +
    (f.hideSoldOut ? 1 : 0) +
    (f.sortBy !== 'relevance' ? 1 : 0)
  )
}

function isOnDay(start: number, day: 'today' | 'tomorrow', now: number): boolean {
  const d = new Date(now)
  if (day === 'tomorrow') d.setDate(d.getDate() + 1)
  const s = new Date(start)
  return s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth() && s.getDate() === d.getDate()
}

/** Relevance: available first, then a blend of rating and proximity. */
function relevance(l: Listing): number {
  const available = l.store.bag.quantity > 0 ? 100 : 0
  return available + l.store.rating * 4 - l.distance * 2
}

export function applyFilters(
  listings: Listing[],
  filters: Filters,
  radiusKm: number,
  now: number,
): Listing[] {
  const q = filters.query.trim().toLowerCase()
  const result = listings.filter(({ store, distance, start }) => {
    if (distance > radiusKm) return false
    if (q && !`${store.name} ${store.branch ?? ''} ${store.bag.title} ${store.category}`.toLowerCase().includes(q))
      return false
    if (filters.day !== 'any' && !isOnDay(start, filters.day, now)) return false
    if (filters.categories.length && !filters.categories.includes(store.category)) return false
    if (filters.diets.length) {
      const diet = store.bag.diet
      // A vegan bag also satisfies a vegetarian filter.
      const ok = filters.diets.every((d) => diet === d || (d === 'vegetarian' && diet === 'vegan'))
      if (!ok) return false
    }
    if (filters.hideSoldOut && store.bag.quantity <= 0) return false
    return true
  })

  const sorters: Record<Filters['sortBy'], (a: Listing, b: Listing) => number> = {
    relevance: (a, b) => relevance(b) - relevance(a),
    distance: (a, b) => a.distance - b.distance,
    price: (a, b) => a.store.bag.price - b.store.bag.price,
    rating: (a, b) => b.store.rating - a.store.rating,
  }
  return result.sort(sorters[filters.sortBy])
}
