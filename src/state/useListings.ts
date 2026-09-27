import { useMemo } from 'react'
import { applyFilters, toListings, type Listing } from '../lib/search'
import { useAppState } from './store'

/** All store listings with distance + resolved pickup window, relative to the chosen location. */
export function useListings(now: number): { all: Listing[]; nearby: Listing[] } {
  const { stores, location } = useAppState()
  return useMemo(() => {
    const all = toListings(stores, location, now)
    const nearby = all.filter((l) => l.distance <= location.radiusKm)
    return { all, nearby }
  }, [stores, location, now])
}

export function useFilteredListings(now: number): Listing[] {
  const { filters, location } = useAppState()
  const { all } = useListings(now)
  return useMemo(() => applyFilters(all, filters, location.radiusKm, now), [all, filters, location.radiusKm, now])
}
