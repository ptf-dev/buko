import { ArrowLeft, Briefcase, Home, Loader2, MapPin, Navigation, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_LOCATION, GEOCODER_URL, RADIUS_OPTIONS_KM } from '../config'
import { currentPosition } from '../lib/native'
import { distanceKm, toListings } from '../lib/search'
import type { SavedPlace } from '../state/reducer'
import { useAppState, useDispatch, useNow } from '../state/store'
import type { Location } from '../types'
import { Button, Chip } from './Button'
import { MapView } from './LazyMap'
import { Sheet } from './Sheet'
import { placeLabel, t, tn } from '../i18n'

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

const same = (a: Location, b: Location) => distanceKm(a.lat, a.lng, b.lat, b.lng) < 0.03

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; street?: string; housenumber?: string; district?: string; city?: string; county?: string; country?: string }
}

/** Address search, biased to Tirana. */
async function searchAddress(q: string, signal: AbortSignal): Promise<Location[]> {
  const url = `${GEOCODER_URL}?q=${encodeURIComponent(q)}&lat=${DEFAULT_LOCATION.lat}&lon=${DEFAULT_LOCATION.lng}&limit=6&lang=en`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Search failed')
  const data = (await res.json()) as { features: PhotonFeature[] }
  return data.features.map((f) => {
    const p = f.properties
    const main = p.name ?? [p.street, p.housenumber].filter(Boolean).join(' ')
    const area = p.district ?? p.city ?? p.county ?? p.country
    return { label: [main, area].filter(Boolean).join(', ') || 'Selected place', lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], radiusKm: 5 }
  })
}

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mount fresh on every open so the sheet starts from the saved location.
  return open ? <LocationSheetBody onClose={onClose} /> : null
}

type Mode = { kind: 'list' } | { kind: 'map'; purpose: 'use' | SavedPlace }

function LocationSheetBody({ onClose }: { onClose: () => void }) {
  const { location, places } = useAppState()
  const dispatch = useDispatch()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [radius, setRadius] = useState(location.radiusKm)
  const geo = useGeolocation()

  const use = (l: Location) => {
    dispatch({ type: 'setLocation', location: { ...l, radiusKm: radius } })
    onClose()
  }

  if (mode.kind === 'map')
    return (
      <MapPicker
        start={mode.purpose === 'use' ? location : (places?.[mode.purpose] ?? location)}
        radius={radius}
        purpose={mode.purpose}
        onBack={() => setMode({ kind: 'list' })}
        onClose={onClose}
        onDone={(l) => {
          if (mode.purpose === 'use') return use(l)
          const label = mode.purpose === 'home' ? 'Home' : 'Work'
          dispatch({ type: 'savePlace', place: mode.purpose, location: { ...l, label: `${label}, ${l.label}` } })
          use({ ...l, label: `${label}, ${l.label}` })
        }}
      />
    )

  const isCurrent = location.label === 'Current location'
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('Location')}
      footer={
        <button type="button" onClick={onClose} className="w-full py-2 text-center text-[17px] font-semibold text-brand">
          {t('Close')}
        </button>
      }
    >
      <AddressSearch onPick={use} />

      <ul className="mt-2 divide-y divide-line">
        <Row
          icon={<Navigation className="h-5 w-5" />}
          label={t('Current location')}
          sub={geo.status === 'error' ? t('Couldn’t get your location. Check location permissions.') : geo.status === 'loading' ? t('Finding you…') : undefined}
          selected={isCurrent}
          onClick={() => geo.locate((lat, lng) => use({ label: 'Current location', lat, lng, radiusKm: radius }))}
          trailing={geo.status === 'loading' ? <Loader2 className="h-5 w-5 animate-spin text-muted" /> : undefined}
        />
        {(['home', 'work'] as const).map((p) => {
          const saved = places?.[p]
          return (
            <Row
              key={p}
              icon={p === 'home' ? <Home className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
              label={p === 'home' ? t('Home') : t('Work')}
              sub={saved ? saved.label.replace(/^(Home|Work), /, '') : undefined}
              selected={!!saved && same(saved, location)}
              onClick={() => (saved ? use(saved) : setMode({ kind: 'map', purpose: p }))}
              trailing={
                <LinkButton onClick={() => setMode({ kind: 'map', purpose: p })}>{saved ? t('Edit') : t('Add')}</LinkButton>
              }
            />
          )
        })}
        <Row
          icon={<MapPin className="h-5 w-5" />}
          label={t('Other location')}
          sub={!isCurrent && !Object.values(places ?? {}).some((p) => p && same(p, location)) ? placeLabel(location.label) : undefined}
          selected={false}
          onClick={() => setMode({ kind: 'map', purpose: 'use' })}
          trailing={<LinkButton onClick={() => setMode({ kind: 'map', purpose: 'use' })}>{t('Choose on map')}</LinkButton>}
        />
      </ul>

      <h3 className="mt-5 mb-2 font-semibold">{t('Popular areas')}</h3>
      <div className="flex flex-wrap gap-2">
        {PLACES.map((p) => (
          <Chip key={p.label} active={same(p, location)} onClick={() => use(p)}>
            {p.label.replace('Tirana, ', '')}
          </Chip>
        ))}
      </div>

      <h3 className="mt-5 mb-2 font-semibold">{t('Distance')}</h3>
      <div className="flex flex-wrap gap-2">
        {RADIUS_OPTIONS_KM.map((km) => (
          <Chip
            key={km}
            active={radius === km}
            onClick={() => {
              setRadius(km)
              dispatch({ type: 'setLocation', location: { ...location, radiusKm: km } })
            }}
          >
            {km} km
          </Chip>
        ))}
      </div>
    </Sheet>
  )
}

function Row({ icon, label, sub, selected, onClick, trailing }: { icon: ReactNode; label: string; sub?: string; selected: boolean; onClick: () => void; trailing?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3.5">
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">{icon}</span>
        <span className="min-w-0">
          <span className="block text-[17px] text-ink">{label}</span>
          {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
        </span>
      </button>
      {trailing}
      {selected && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand" aria-label={t('Selected')}>
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
      )}
    </li>
  )
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 px-1 text-[15px] font-medium text-brand underline underline-offset-4">
      {children}
    </button>
  )
}

function AddressSearch({ onPick }: { onPick: (l: Location) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Location[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  useEffect(() => {
    const text = q.trim()
    if (text.length < 3) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setState('loading')
      searchAddress(text, ctrl.signal)
        .then((r) => {
          setResults(r)
          setState('idle')
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) {
            setState('error')
            console.warn(e)
          }
        })
    }, 350)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])
  const showing = q.trim().length >= 3
  return (
    <div>
      <label className="flex h-12 items-center gap-3 rounded-xl px-3.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand">
        <Search className="h-5 w-5 shrink-0 text-ink" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Search for a street or area')}
          aria-label={t('Search for a street or area')}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
        />
        {q && (
          <button type="button" aria-label={t('Clear')} onClick={() => { setQ(''); setResults(null) }}>
            <X className="h-4 w-4 text-muted" />
          </button>
        )}
      </label>
      {showing && (
        <ul className="mt-1 max-h-64 overflow-y-auto rounded-xl ring-1 ring-line" aria-live="polite">
          {state === 'loading' && <li className="px-4 py-3 text-sm text-muted">{t('Searching…')}</li>}
          {state === 'error' && <li className="px-4 py-3 text-sm text-red-700">{t('Search isn’t available right now. Choose on the map instead.')}</li>}
          {state === 'idle' && results?.length === 0 && <li className="px-4 py-3 text-sm text-muted">{t('No places found.')}</li>}
          {state === 'idle' &&
            results?.map((r, i) => (
              <li key={`${r.lat},${r.lng},${i}`} className="border-t border-line first:border-0">
                <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream">
                  <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate text-[15px]">{r.label}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function MapPicker({
  start,
  radius,
  purpose,
  onBack,
  onClose,
  onDone,
}: {
  start: Location
  radius: number
  purpose: 'use' | SavedPlace
  onBack: () => void
  onClose: () => void
  onDone: (l: Location) => void
}) {
  const { stores } = useAppState()
  const now = useNow()
  const [draft, setDraft] = useState<Location>({ ...start, radiusKm: radius })
  const listings = useMemo(() => toListings(stores, draft, now), [stores, draft, now])
  const inRange = listings.filter((l) => l.distance <= draft.radiusKm)
  const withBags = inRange.filter((l) => l.store.bag.quantity > 0).length
  // The map reports its centre after every pan; ignore reports that match the draft (our own re-centring).
  const onMapMoved = (lat: number, lng: number) => {
    if (distanceKm(lat, lng, draft.lat, draft.lng) < 0.03) return
    setDraft((d) => ({ ...d, lat, lng, label: labelFor(lat, lng) }))
  }
  const cta = purpose === 'home' ? t('Save as Home') : purpose === 'work' ? t('Save as Work') : tn(withBags, 'Show {n} store with bags', 'Show {n} stores with bags')
  return (
    <Sheet open onClose={onClose} title={purpose === 'use' ? t('Choose on map') : purpose === 'home' ? t('Set Home') : t('Set Work')} footer={<Button className="w-full" onClick={() => onDone(draft)}>{cta}</Button>}>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted">
        <ArrowLeft className="h-4 w-4" /> {t('Back')}
      </button>
      <div className="relative h-72 overflow-hidden rounded-2xl ring-1 ring-line">
        <MapView listings={listings} location={draft} markerStyle="dot" me={null} showRadius fitRadius onMoveEnd={onMapMoved} className="absolute inset-0 z-0" />
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <MapPin className="-mt-8 h-9 w-9 fill-brand text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]" strokeWidth={1.8} aria-hidden />
        </div>
        <p className="pointer-events-none absolute top-2.5 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-xs font-medium whitespace-nowrap shadow">
          {t('Drag the map to move the pin')}
        </p>
      </div>
      <p className="mt-2 px-1 text-sm text-muted" aria-live="polite">
        <span className="font-semibold text-ink">{placeLabel(draft.label)}</span> · {tn(inRange.length, '{n} store within {km} km', '{n} stores within {km} km', { km: draft.radiusKm })}
      </p>
    </Sheet>
  )
}
