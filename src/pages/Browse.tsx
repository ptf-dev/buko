import { List, Map as MapIcon, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BagCard } from '../components/BagCard'
import { Button } from '../components/Button'
import { FiltersSheet } from '../components/FiltersSheet'
import { LocationButton } from '../components/LocationButton'
import { MapView } from '../components/LazyMap'
import { EmptyState } from '../components/PageHeader'
import { activeFilterCount, DEFAULT_FILTERS } from '../lib/search'
import { useAppState, useDispatch, useNow } from '../state/store'
import { useFilteredListings } from '../state/useListings'

export function Browse() {
  const now = useNow()
  const { filters, location } = useAppState()
  const dispatch = useDispatch()
  const results = useFilteredListings(now)
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'map' ? 'map' : 'list'
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const filterCount = activeFilterCount(filters)
  const selected = results.find((l) => l.store.id === selectedId)

  useEffect(() => {
    if (params.get('focus')) {
      inputRef.current?.focus()
      params.delete('focus')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const setView = (v: 'list' | 'map') => {
    setSelectedId(null)
    setParams(v === 'map' ? { view: 'map' } : {}, { replace: true })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="z-30 space-y-3 border-b border-line bg-white px-4 pt-4 pb-3">
        <LocationButton />
        <div className="flex gap-2">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-cream px-4">
            <Search className="h-5 w-5 text-muted" />
            <input
              ref={inputRef}
              value={filters.query}
              onChange={(e) => dispatch({ type: 'setFilters', filters: { query: e.target.value } })}
              placeholder="Search stores and food"
              aria-label="Search"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
            />
            {filters.query && (
              <button type="button" aria-label="Clear search" onClick={() => dispatch({ type: 'setFilters', filters: { query: '' } })}>
                <X className="h-4 w-4 text-muted" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filters"
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-cream"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {filterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                {filterCount}
              </span>
            )}
          </button>
        </div>
        <div className="grid grid-cols-2 rounded-full bg-cream p-1 text-sm font-semibold">
          {(['list', 'map'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`flex h-9 items-center justify-center gap-1.5 rounded-full transition ${
                view === v ? 'bg-white text-brand shadow-sm' : 'text-muted'
              }`}
            >
              {v === 'list' ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
              {v === 'list' ? 'List' : 'Map'}
            </button>
          ))}
        </div>
      </header>

      {view === 'list' ? (
        <div className="flex-1 overflow-y-auto">
          <p className="px-4 pt-3 text-sm text-muted">
            {results.length} {results.length === 1 ? 'store' : 'stores'} within {location.radiusKm} km
          </p>
          {results.length === 0 ? (
            <EmptyState
              icon={<Search className="h-9 w-9" />}
              title="No results"
              text="Try another search, fewer filters or a larger distance."
              action={
                <Button variant="secondary" onClick={() => dispatch({ type: 'setFilters', filters: { ...DEFAULT_FILTERS, sortBy: filters.sortBy } })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 p-4">
              {results.map((l) => (
                <BagCard key={l.store.id} listing={l} now={now} wide />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative min-h-[300px] flex-1">
          <MapView
            listings={results}
            location={location}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className="absolute inset-0 z-0"
          />
          {selected && (
            <div className="animate-sheet-up absolute right-3 bottom-3 left-3 z-[500]">
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setSelectedId(null)}
                className="absolute -top-3 -right-1 z-10 rounded-full bg-white p-1 shadow"
              >
                <X className="h-4 w-4" />
              </button>
              <BagCard listing={selected} now={now} wide />
            </div>
          )}
          {!selected && (
            <p className="absolute top-3 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-sm font-medium shadow">
              {results.length} stores · tap a price to preview
            </p>
          )}
        </div>
      )}
      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} resultCount={results.length} />
    </div>
  )
}
