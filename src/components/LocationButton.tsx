import { ChevronDown, Navigation } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../state/store'
import { LocationSheet } from './LocationSheet'
import { placeLabel, t } from '../i18n'

/** "◁ Current location · Tirana ⌄" header: opens the location sheet. */
export function LocationButton({ compact = false }: { compact?: boolean }) {
  const { location } = useAppState()
  const [open, setOpen] = useState(false)
  const [title, area] = splitLabel(placeLabel(location.label))
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 items-center gap-2.5 text-left" aria-label={t('Location: {place}, within {km} km. Change', { place: placeLabel(location.label), km: location.radiusKm })}>
        <span className={`flex shrink-0 items-center justify-center rounded-full bg-brand-light text-brand ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
          <Navigation className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
        </span>
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 text-[17px] font-bold text-ink">{title}</span>
          <span className="truncate text-[15px] text-muted">{area ? `${area} · ` : ''}{location.radiusKm} km</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-ink" aria-hidden />
      </button>
      <LocationSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** "Tirana, Qendër" → ["Tirana", "Qendër"]; "Current location" → ["Current location", ""]. */
function splitLabel(label: string): [string, string] {
  const i = label.indexOf(', ')
  return i > 0 ? [label.slice(0, i), label.slice(i + 2)] : [label, '']
}
