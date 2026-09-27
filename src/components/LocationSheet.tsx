import { LocateFixed, MapPin } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_LOCATION, RADIUS_OPTIONS_KM } from '../config'
import { useAppState, useDispatch } from '../state/store'
import type { Location } from '../types'
import { Button, Chip } from './Button'
import { Sheet } from './Sheet'

/** Named neighbourhoods offered as quick picks. */
const PLACES: Location[] = [
  DEFAULT_LOCATION,
  { label: 'Tirana, Blloku', lat: 41.3189, lng: 19.8147, radiusKm: 5 },
  { label: 'Tirana, Pazari i Ri', lat: 41.3302, lng: 19.8262, radiusKm: 5 },
  { label: 'Tirana, Kombinat', lat: 41.3196, lng: 19.7837, radiusKm: 5 },
]

export function useGeolocation() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const locate = (onSuccess: (lat: number, lng: number) => void) => {
    if (!('geolocation' in navigator)) {
      setStatus('error')
      return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus('idle')
        onSuccess(pos.coords.latitude, pos.coords.longitude)
      },
      () => setStatus('error'),
      { timeout: 10_000 },
    )
  }
  return { status, locate }
}

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mount fresh on every open so the draft starts from the saved location.
  return open ? <LocationSheetBody onClose={onClose} /> : null
}

function LocationSheetBody({ onClose }: { onClose: () => void }) {
  const { location } = useAppState()
  const dispatch = useDispatch()
  const [draft, setDraft] = useState<Location>(location)
  const geo = useGeolocation()

  const apply = () => {
    dispatch({ type: 'setLocation', location: draft })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Choose a location"
      footer={
        <Button className="w-full" onClick={apply}>
          Apply
        </Button>
      }
    >
      <button
        type="button"
        onClick={() => geo.locate((lat, lng) => setDraft({ ...draft, label: 'Current location', lat, lng }))}
        className="flex w-full items-center gap-3 rounded-xl p-3 text-left font-medium text-brand hover:bg-brand-light"
      >
        <LocateFixed className="h-5 w-5" />
        {geo.status === 'loading' ? 'Finding you…' : 'Use my current location'}
      </button>
      {geo.status === 'error' && (
        <p className="px-3 text-sm text-red-600">Couldn’t get your location. Pick an area below instead.</p>
      )}
      <ul className="mt-1">
        {PLACES.map((p) => (
          <li key={p.label}>
            <button
              type="button"
              onClick={() => setDraft({ ...p, radiusKm: draft.radiusKm })}
              className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${
                draft.label === p.label ? 'bg-brand-light font-semibold' : 'hover:bg-cream'
              }`}
            >
              <MapPin className="h-5 w-5 text-muted" />
              {p.label}
            </button>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 mb-2 font-semibold">Distance</h3>
      <div className="flex flex-wrap gap-2">
        {RADIUS_OPTIONS_KM.map((km) => (
          <Chip key={km} active={draft.radiusKm === km} onClick={() => setDraft({ ...draft, radiusKm: km })}>
            {km} km
          </Chip>
        ))}
      </div>
    </Sheet>
  )
}
