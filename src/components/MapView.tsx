import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { MAP_TILES } from '../config'
import { logoColor } from '../data/categories'
import { assetUrl } from '../lib/api'
import { initials } from '../lib/format'
import { formatPrice } from '../lib/format'
import type { Listing } from '../lib/search'
import type { Location } from '../types'

function pinIcon(label: string, variant: '' | 'sold-out' | 'active') {
  return L.divIcon({
    className: '',
    html: `<span class="price-pin ${variant}">${label}</span>`,
    iconSize: [0, 0],
  })
}

const dotIcons = {
  on: L.divIcon({ className: '', html: '<span class="store-dot"></span>', iconSize: [0, 0] }),
  off: L.divIcon({ className: '', html: '<span class="store-dot off"></span>', iconSize: [0, 0] }),
}

function logoIcon(l: Listing, active: boolean) {
  const s = l.store
  const photo = s.photoUrl ? `background-image:url('${assetUrl(s.photoUrl)}');` : ''
  return L.divIcon({
    className: '',
    html: `<span class="logo-pin ${s.bag.quantity > 0 ? '' : 'off'} ${active ? 'active' : ''}" style="background-color:${logoColor(s.id)};${photo}">${s.photoUrl ? '' : initials(s.name)}</span>`,
    iconSize: [0, 0],
  })
}

function clusterIcon(n: number) {
  return L.divIcon({ className: '', html: `<span class="cluster-pin">${n}</span>`, iconSize: [0, 0] })
}

/**
 * Groups stores that would overlap at the current zoom into a numbered circle (tap to zoom in),
 * and shows the rest as round store-logo pins.
 */
function Clusters({ listings, selectedId, onSelect }: { listings: Listing[]; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const map = useMap()
  const [view, setView] = useState(0)
  useMapEvents({ zoomend: () => setView((v) => v + 1), moveend: () => setView((v) => v + 1) })
  const groups = useMemo(() => {
    void view
    const zoom = map.getZoom()
    const RADIUS = 52
    const out: { items: Listing[]; x: number; y: number }[] = []
    for (const l of listings) {
      const p = map.project([l.store.lat, l.store.lng], zoom)
      const g = out.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < RADIUS && !c.items.some((i) => i.store.id === selectedId) && l.store.id !== selectedId)
      if (g) {
        g.items.push(l)
        g.x = (g.x * (g.items.length - 1) + p.x) / g.items.length
        g.y = (g.y * (g.items.length - 1) + p.y) / g.items.length
      } else out.push({ items: [l], x: p.x, y: p.y })
    }
    return out.map((g) => ({ ...g, pos: map.unproject([g.x, g.y], zoom) }))
  }, [listings, map, view, selectedId])
  return (
    <>
      {groups.map((g) =>
        g.items.length === 1 ? (
          <Marker
            key={g.items[0]!.store.id}
            position={[g.items[0]!.store.lat, g.items[0]!.store.lng]}
            icon={logoIcon(g.items[0]!, g.items[0]!.store.id === selectedId)}
            zIndexOffset={g.items[0]!.store.id === selectedId ? 1000 : 0}
            eventHandlers={onSelect ? { click: () => onSelect(g.items[0]!.store.id) } : undefined}
          />
        ) : (
          <Marker
            key={g.items.map((i) => i.store.id).join('|')}
            position={g.pos}
            icon={clusterIcon(g.items.length)}
            eventHandlers={{
              click: () => map.fitBounds(L.latLngBounds(g.items.map((i) => [i.store.lat, i.store.lng] as [number, number])), { padding: [70, 70], maxZoom: 18 }),
            }}
          />
        ),
      )}
    </>
  )
}

/** Tapping the map background (not a pin) clears the selection. */
function OnMapClick({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick })
  return null
}

/** Exposes a "recenter on me" control through a callback ref. */
function Controller({ onReady }: { onReady: (api: { recenter: (lat: number, lng: number) => void }) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady({ recenter: (lat, lng) => map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 }) })
  }, [map, onReady])
  return null
}

const meIcon = L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [0, 0] })

/** Moves the map when the target changes, but not for the tiny differences a user's own drag produces. */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    if (map.getCenter().distanceTo([lat, lng]) > 25) map.setView([lat, lng])
  }, [map, lat, lng])
  return null
}

/** Zooms so the whole distance circle is visible whenever the radius changes. */
function FitRadius({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const map = useMap()
  const pos = useRef({ lat, lng })
  pos.current = { lat, lng }
  useEffect(() => {
    map.fitBounds(L.latLng(pos.current.lat, pos.current.lng).toBounds(radiusKm * 2000), { padding: [12, 12] })
  }, [map, radiusKm])
  return null
}

/** Fits all given points (e.g. the store and you) in view. */
function FitPoints({ points, maxZoom }: { points: [number, number][]; maxZoom: number }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    const pts = JSON.parse(key) as [number, number][]
    if (pts.length === 1) map.setView(pts[0], maxZoom)
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom })
  }, [map, key, maxZoom])
  return null
}

function OnMoveEnd({ onMoveEnd }: { onMoveEnd: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter()
      onMoveEnd(c.lat, c.lng)
    },
  })
  return null
}

/** Keeps tiles filling the box when the container resizes (sheets opening, lazy mounting). */
function AutoResize() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

function ZoomControls() {
  const map = useMap()
  return (
    <div className="absolute top-3 right-3 z-[500] flex flex-col overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5">
      <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()} className="flex h-10 w-10 items-center justify-center text-xl font-semibold hover:bg-cream">
        +
      </button>
      <span className="h-px bg-line" />
      <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()} className="flex h-10 w-10 items-center justify-center text-xl font-semibold hover:bg-cream">
        −
      </button>
    </div>
  )
}

export function MapView({
  listings,
  location,
  selectedId,
  onSelect,
  className = '',
  interactive = true,
  zoom = 14,
  showRadius = interactive,
  me = interactive ? { lat: location.lat, lng: location.lng } : null,
  fitPoints,
  fitRadius = false,
  onMoveEnd,
  zoomControls = false,
  follow = true,
  markerStyle = 'price',
  cluster = false,
  onBackgroundClick,
  onReady,
}: {
  listings: Listing[]
  /** Map centre and search radius. */
  location: Location
  selectedId?: string | null
  onSelect?: (storeId: string) => void
  className?: string
  interactive?: boolean
  zoom?: number
  showRadius?: boolean
  /** Where the customer is (blue dot). */
  me?: { lat: number; lng: number } | null
  /** Fit these points in view instead of centring on `location`. */
  fitPoints?: [number, number][]
  /** Zoom to the radius circle when the radius changes. */
  fitRadius?: boolean
  /** Called with the map centre after the user pans or zooms (location picker). */
  onMoveEnd?: (lat: number, lng: number) => void
  zoomControls?: boolean
  /** Re-centre when `location` changes. */
  follow?: boolean
  /** Price labels, or small dots where many stores are shown at low zoom (location picker). */
  markerStyle?: 'price' | 'dot'
  /** Store-logo pins grouped into numbered clusters where they overlap (Browse map). */
  cluster?: boolean
  onBackgroundClick?: () => void
  onReady?: (api: { recenter: (lat: number, lng: number) => void }) => void
}) {
  const markers = useMemo(
    () =>
      listings.map((l) => ({
        id: l.store.id,
        position: [l.store.lat, l.store.lng] as [number, number],
        icon:
          markerStyle === 'dot'
            ? dotIcons[l.store.bag.quantity > 0 ? 'on' : 'off']
            : pinIcon(
                l.store.bag.quantity > 0 ? formatPrice(l.store.bag.price) : 'Sold out',
                l.store.id === selectedId ? 'active' : l.store.bag.quantity > 0 ? '' : 'sold-out',
              ),
      })),
    [listings, selectedId, markerStyle],
  )

  return (
    <MapContainer
      center={[location.lat, location.lng]}
      zoom={zoom}
      zoomSnap={0.25}
      className={className}
      zoomControl={false}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
      attributionControl
    >
      <TileLayer attribution={MAP_TILES.attribution} url={MAP_TILES.url} maxZoom={19} />
      <AutoResize />
      {fitPoints ? <FitPoints points={fitPoints} maxZoom={16} /> : follow && <Recenter lat={location.lat} lng={location.lng} />}
      {fitRadius && <FitRadius lat={location.lat} lng={location.lng} radiusKm={location.radiusKm} />}
      {onMoveEnd && <OnMoveEnd onMoveEnd={onMoveEnd} />}
      {zoomControls && <ZoomControls />}
      {showRadius && (
        <Circle
          center={[location.lat, location.lng]}
          radius={location.radiusKm * 1000}
          pathOptions={{ color: '#00615f', weight: 1.5, fillOpacity: 0.06 }}
          interactive={false}
        />
      )}
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} />}
      {onBackgroundClick && <OnMapClick onClick={onBackgroundClick} />}
      {onReady && <Controller onReady={onReady} />}
      {cluster && <Clusters listings={listings} selectedId={selectedId} onSelect={onSelect} />}
      {!cluster && markers.map((m) => (
        <Marker
          key={m.id}
          position={m.position}
          icon={m.icon}
          zIndexOffset={m.id === selectedId ? 1000 : 0}
          eventHandlers={onSelect ? { click: () => onSelect(m.id) } : undefined}
        />
      ))}
    </MapContainer>
  )
}
