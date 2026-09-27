import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef } from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { MAP_TILES } from '../config'
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
      {markers.map((m) => (
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
