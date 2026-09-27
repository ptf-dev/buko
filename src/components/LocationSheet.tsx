import { LocateFixed, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DEFAULT_LOCATION, RADIUS_OPTIONS_KM } from '../config'
import { currentPosition } from '../lib/native'
import { distanceKm, toListings } from '../lib/search'
import { useAppState, useDispatch, useNow } from '../state/store'
import type { Location } from '../types'
import { Button, Chip } from './Button'
import { MapView } from './LazyMap'
import { Sheet } from './Sheet'

/** Named neighbourhoods offered as quick picks. */
export const PLACES: Location[] = [
  DEFAULT_LOCATION,
  { label: 'Tirana, Blloku', lat: 41.3189, lng: 19.8147, radiusKm: 5 },
  { label: 'Tirana, Pazari i Ri', lat: 41.3302, lng: 19.8262, radiusKm: 5 },
  { label: 'Tirana, Kombinat', lat: 41.3196, lng: 19.7837, radiusKm: 5 },
]

export function useGeolocation() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const locate = (onSuccess: (lat: number, lng: number) => void) => {
    setStatus('loading')
    currentPosition()
      .then(({ lat, lng }) => {
        setStatus('idle')
        onSuccess(lat, lng)
      })
      .catch(() => setStatus('error'))
  }
  return { status, locate }
}

/** Label for a point picked on the map: the nearest named area if it's close, otherwise a generic label. */
function labelFor(lat: number, lng: number) {
  const nearest = PLACES.map((p) => ({ p, d: distanceKm(lat, lng, p.lat, p.lng) })).sort((a, b) => a.d - b.d)[0]
  return nearest && nearest.d < 1.2 ? `Near ${nearest.p.label.replace('Tirana, ', '')}` : 'Pinned on map'
}

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mount fresh on every open so the draft starts from the saved location.
  return open ? <LocationSheetBody onClose={onClose} /> : null
}

function LocationSheetBody({ onClose }: { onClose: () => void }) {
  const { location, stores } = useAppState()
  const dispatch = useDispatch()
  const now = useNow()
  const [draft, setDraft] = useState<Location>(location)
  const geo = useGeolocation()

  const listings = useMemo(() => toListings(stores, draft, now), [stores, draft, now])
  const inRange = listings.filter((l) => l.distance <= draft.radiusKm)
  const withBags = inRange.filter((l) => l.store.bag.quantity > 0).length

  const apply = () => {
    dispatch({ type: 'setLocation', location: draft })
    onClose()
  }

  // The map reports its centre after every pan; ignore reports that match the draft (our own re-centring).
  const onMapMoved = (lat: number, lng: number) => {
    if (distanceKm(lat, lng, draft.lat, draft.lng) < 0.03) return
    setDraft((d) => ({ ...d, lat, lng, label: labelFor(lat, lng) }))
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Choose a location"
      footer={
        <Button className="w-full" onClick={apply}>
          Show {withBags} {withBags === 1 ? 'store' : 'stores'} with bags
        </Button>
      }
    >
      <div className="relative h-60 overflow-hidden rounded-2xl ring-1 ring-line">
        <MapView
          listings={listings}
          location={draft}
          markerStyle="dot"
          me={null}
          showRadius
          fitRadius
          onMoveEnd={onMapMoved}
          className="absolute inset-0 z-0"
        />
        {/* Fixed centre pin: drag the map underneath to choose a spot. */}
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <MapPin className="-mt-8 h-9 w-9 fill-brand text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]" strokeWidth={1.8} aria-hidden />
        </div>
        <p className="pointer-events-none absolute top-2.5 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-xs font-medium whitespace-nowrap shadow">
          Drag the map to move the pin
        </p>
      </div>
      <p className="mt-2 px-1 text-sm text-muted" aria-live="polite">
        <span className="font-semibold text-ink">{draft.label}</span> · {inRange.length} {inRange.length === 1 ? 'store' : 'stores'} within {draft.radiusKm} km
      </p>

      <h3 className="mt-4 mb-2 font-semibold">Distance</h3>
      <div className="flex flex-wrap gap-2">
        {RADIUS_OPTIONS_KM.map((km) => (
          <Chip key={km} active={draft.radiusKm === km} onClick={() => setDraft({ ...draft, radiusKm: km })}>
            {km} km
          </Chip>
        ))}
      </div>

      <button
        type="button"
        onClick={() => geo.locate((lat, lng) => setDraft({ ...draft, label: 'Current location', lat, lng }))}
        className="mt-4 flex w-full items-center gap-3 rounded-xl p-3 text-left font-medium text-brand hover:bg-brand-light"
      >
        <LocateFixed className="h-5 w-5" />
        {geo.status === 'loading' ? 'Finding you…' : 'Use my current location'}
      </button>
      {geo.status === 'error' && <p className="px-3 text-sm text-red-600">Couldn’t get your location. Pick an area below instead.</p>}
      <ul>
        {PLACES.map((p) => (
          <li key={p.label}>
            <button
              type="button"
              onClick={() => setDraft({ ...p, radiusKm: draft.radiusKm })}
              className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${draft.label === p.label ? 'bg-brand-light font-semibold' : 'hover:bg-cream'}`}
            >
              <MapPin className="h-5 w-5 text-muted" />
              {p.label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
