import { ChevronDown, List, MapPin, Navigation, Search, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BagCard } from '../components/BagCard'
import { Button } from '../components/Button'
import { FiltersSheet } from '../components/FiltersSheet'
import { MapView } from '../components/LazyMap'
import { LocationSheet } from '../components/LocationSheet'
import { OutOfAreaNotice } from '../components/OutOfAreaNotice'
import { EmptyState } from '../components/PageHeader'
import { CATEGORIES } from '../data/categories'
import { activeFilterCount, DEFAULT_FILTERS } from '../lib/search'
import { useAppState, useDispatch, useNow } from '../state/store'
import { useFilteredListings, useListings } from '../state/useListings'
import { placeLabel, t, tn } from '../i18n'

/** Height of the floating search + filter chips over the map. */
const OVERLAY = 132
/** Visible part of the list sheet when collapsed to its header. */
const PEEK = 92

type Snap = 'full' | 'half' | 'peek'

/**
 * Browse, like the original app: a full-screen map with a floating search bar and filter chips, clustered
 * store pins, and a list in a bottom sheet you can drag up. Tapping a pin shows that store's card.
 */
export function Browse() {
  const now = useNow()
  const { filters, location } = useAppState()
  const dispatch = useDispatch()
  const results = useFilteredListings(now)
  const { all } = useListings(now)
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snap, setSnap] = useState<Snap>(() =>
    params.get('focus') || params.get('view') === 'list' ? 'full' : params.get('view') === 'map' ? 'peek' : 'half',
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const mapApi = useRef<{ recenter: (lat: number, lng: number) => void } | null>(null)
  const filterCount = activeFilterCount(filters)
  const selected = results.find((l) => l.store.id === selectedId)
  // Zoom to the stores in the results (not the whole radius), so nearby pins aren't all merged into one cluster.
  const fitPoints = useMemo(
    () => (results.length ? [[location.lat, location.lng] as [number, number], ...results.map((l) => [l.store.lat, l.store.lng] as [number, number])] : undefined),
    [results, location.lat, location.lng],
  )
  const setFilters = (f: Partial<typeof filters>) => dispatch({ type: 'setFilters', filters: f })

  useEffect(() => {
    if (params.get('focus')) {
      inputRef.current?.focus()
      params.delete('focus')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const select = (id: string | null) => {
    setSelectedId(id)
    if (id) setSnap('peek')
  }
  const onReady = useCallback((api: { recenter: (lat: number, lng: number) => void }) => {
    mapApi.current = api
  }, [])

  const categoryLabel =
    filters.categories.length === 1 ? t(CATEGORIES[filters.categories[0]!].label) : filters.categories.length > 1 ? t('{n} categories', { n: filters.categories.length }) : t('Category')
  const dayLabel = filters.day === 'today' ? t('Today') : filters.day === 'tomorrow' ? t('Tomorrow') : t('Pickup day')

  return (
    <div className="relative h-full overflow-hidden bg-[#e9eeed]">
      <MapView
        listings={results}
        location={location}
        selectedId={selectedId}
        onSelect={select}
        onBackgroundClick={() => setSelectedId(null)}
        onReady={onReady}
        cluster
        showRadius={false}
        fitPoints={fitPoints}
        className="absolute inset-0 z-0"
      />

      {/* Floating search and filters */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="pointer-events-auto flex gap-2.5">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.14)]">
            <Search className="h-5 w-5 shrink-0 text-ink" aria-hidden />
            <input
              ref={inputRef}
              value={filters.query}
              onChange={(e) => setFilters({ query: e.target.value })}
              onFocus={() => setSnap('full')}
              placeholder={t('Search')}
              aria-label={t('Search stores and food')}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            />
            {filters.query && (
              <button type="button" aria-label={t('Clear search')} onClick={() => setFilters({ query: '' })}>
                <X className="h-4 w-4 text-muted" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            aria-label={t('Location: {place}. Change', { place: placeLabel(location.label) })}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.14)]"
          >
            <MapPin className="h-5 w-5 text-ink" />
          </button>
        </div>
        <div className="no-scrollbar pointer-events-auto -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={filterCount ? t('Filters, {n} on', { n: filterCount }) : t('Filters')}
            className="relative flex h-10 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {filterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                {filterCount}
              </span>
            )}
          </button>
          <ChipButton active={filters.categories.length > 0} onClick={() => setFiltersOpen(true)}>
            {categoryLabel} <ChevronDown className="h-4 w-4" aria-hidden />
          </ChipButton>
          <ChipButton active={filters.day !== 'any'} onClick={() => setFiltersOpen(true)}>
            {dayLabel} <ChevronDown className="h-4 w-4" aria-hidden />
          </ChipButton>
          <ChipButton active={!!filters.availableNow} pressed={!!filters.availableNow} onClick={() => setFilters({ availableNow: !filters.availableNow })}>
            {t('Available now')}
          </ChipButton>
          <ChipButton active={filters.hideSoldOut} pressed={filters.hideSoldOut} onClick={() => setFilters({ hideSoldOut: !filters.hideSoldOut })}>
            {t('Hide sold-out')}
          </ChipButton>
        </div>
      </div>

      {/* Recenter on the chosen location */}
      {!selected && snap !== 'full' && (
        <button
          type="button"
          aria-label={t('Back to my location')}
          onClick={() => mapApi.current?.recenter(location.lat, location.lng)}
          className="absolute right-4 z-[600] flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.16)] transition-[bottom] duration-300"
          style={{ bottom: snap === 'half' ? 'calc(44% + 12px)' : `${PEEK + 12}px` }}
        >
          <Navigation className="h-5 w-5 text-ink" />
        </button>
      )}

      {/* Selected store card */}
      {selected ? (
        <div className="animate-sheet-up absolute inset-x-0 bottom-0 z-[650] px-3 pb-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null)
                setSnap('full')
              }}
              className="flex h-11 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-white shadow-[0_4px_14px_rgba(0,97,95,0.35)]"
            >
              <List className="h-5 w-5" aria-hidden /> {t('List')}
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              aria-label={t('Close preview')}
              onClick={() => setSelectedId(null)}
              className="absolute -top-2 -left-1 z-10 rounded-full bg-white p-1.5 shadow"
            >
              <X className="h-4 w-4" />
            </button>
            <BagCard listing={selected} now={now} wide />
          </div>
        </div>
      ) : (
        <ListSheet snap={snap} onSnap={setSnap} count={results.length}>
          <OutOfAreaNotice listings={all} className="mb-3" />
          {results.length === 0 ? (
            <EmptyState
              icon={<Search className="h-9 w-9" />}
              title={t('No results')}
              text={t('Try another search, fewer filters or a larger distance.')}
              action={
                <Button variant="secondary" onClick={() => dispatch({ type: 'setFilters', filters: { ...DEFAULT_FILTERS, sortBy: filters.sortBy } })}>
                  {t('Clear filters')}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 pb-6">
              {results.map((l) => (
                <BagCard key={l.store.id} listing={l} now={now} wide />
              ))}
            </div>
          )}
        </ListSheet>
      )}

      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} resultCount={results.length} />
      <LocationSheet open={locationOpen} onClose={() => setLocationOpen(false)} />
    </div>
  )
}

function ChipButton({ active, pressed, onClick, children }: { active: boolean; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition ${
        active ? 'bg-brand text-white' : 'bg-white text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Bottom sheet with three resting heights. Drag the handle/header, or tap it to cycle. The list scrolls
 * only when the sheet is fully open.
 */
function ListSheet({ snap, onSnap, count, children }: { snap: Snap; onSnap: (s: Snap) => void; count: number; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(600)
  const [drag, setDrag] = useState<{ startY: number; startOffset: number; offset: number } | null>(null)

  useEffect(() => {
    const el = wrap.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([e]) => setHeight(e!.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sheetH = Math.max(PEEK, height - OVERLAY)
  const offsets: Record<Snap, number> = { full: 0, half: Math.max(0, sheetH - height * 0.44), peek: sheetH - PEEK }
  const offset = drag ? drag.offset : offsets[snap]

  const down = (e: ReactPointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDrag({ startY: e.clientY, startOffset: offsets[snap], offset: offsets[snap] })
  }
  const move = (e: ReactPointerEvent) => {
    if (!drag) return
    setDrag({ ...drag, offset: Math.min(offsets.peek, Math.max(0, drag.startOffset + e.clientY - drag.startY)) })
  }
  const up = (e: ReactPointerEvent) => {
    if (!drag) return
    const moved = Math.abs(e.clientY - drag.startY)
    if (moved < 6) {
      // A tap cycles: peek → half → full → half.
      onSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half')
    } else {
      const nearest = (Object.keys(offsets) as Snap[]).reduce((a, b) => (Math.abs(offsets[b] - drag.offset) < Math.abs(offsets[a] - drag.offset) ? b : a))
      onSnap(nearest)
    }
    setDrag(null)
  }

  return (
    <div
      ref={wrap}
      className={`absolute inset-x-0 bottom-0 z-[620] flex flex-col rounded-t-[28px] bg-white shadow-[0_-6px_24px_rgba(0,0,0,0.14)] ${drag ? '' : 'transition-transform duration-300 ease-out'}`}
      style={{ height: sheetH, transform: `translateY(${offset}px)` }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={snap === 'full' ? t('Show map') : t('Show list')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSnap(snap === 'full' ? 'peek' : 'full')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setDrag(null)}
        className="shrink-0 cursor-grab touch-none px-4 pt-3 pb-3 select-none active:cursor-grabbing"
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-line" />
        <h2 className="mt-3 text-center text-[22px] font-bold tracking-tight text-ink">
          {tn(count, '{n} Surprise Bag', '{n} Surprise Bags')}
        </h2>
      </div>
      <div className={`min-h-0 flex-1 px-4 ${snap === 'full' && !drag ? 'overflow-y-auto' : 'overflow-hidden'}`}>{children}</div>
    </div>
  )
}
