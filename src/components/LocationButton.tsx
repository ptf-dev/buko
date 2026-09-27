import { ChevronDown, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../state/store'
import { LocationSheet } from './LocationSheet'

export function LocationButton() {
  const { location } = useAppState()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 items-center gap-1.5 text-left">
        <MapPin className="h-5 w-5 shrink-0 text-brand" />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{location.label}</span>
          <span className="block text-xs text-muted">within {location.radiusKm} km</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>
      <LocationSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
