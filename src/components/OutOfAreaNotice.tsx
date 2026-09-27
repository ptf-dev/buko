import { MapPinned } from 'lucide-react'
import { DEFAULT_LOCATION, SERVICE_AREA_KM } from '../config'
import type { Listing } from '../lib/search'
import { useAppState, useDispatch } from '../state/store'

/**
 * Shown when the chosen location is far from every partner store (e.g. a visitor abroad),
 * so an empty feed explains itself and offers a one-tap switch to Tirana.
 */
export function OutOfAreaNotice({ listings, className = '' }: { listings: Listing[]; className?: string }) {
  const { location } = useAppState()
  const dispatch = useDispatch()
  if (!listings.length) return null
  const nearest = Math.min(...listings.map((l) => l.distance))
  if (nearest <= SERVICE_AREA_KM) return null
  return (
    <div role="status" className={`flex items-start gap-3 rounded-2xl bg-sun/25 p-4 ring-1 ring-sun/60 ${className}`}>
      <MapPinned className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Ngopu is in Tirana for now</p>
        <p className="mt-0.5 text-sm text-ink/75">
          The nearest store is {Math.round(nearest).toLocaleString('en-US')} km from {location.label === 'Current location' ? 'you' : location.label}. Switch to Tirana to see what’s available.
        </p>
        <button
          type="button"
          onClick={() => dispatch({ type: 'setLocation', location: { ...DEFAULT_LOCATION, radiusKm: location.radiusKm } })}
          className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          Explore Tirana
        </button>
      </div>
    </div>
  )
}
