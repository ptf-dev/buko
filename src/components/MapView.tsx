import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
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

const meIcon = L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [0, 0] })

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng])
  }, [map, lat, lng])
  return null
}

export function MapView({
  listings,
  location,
  selectedId,
  onSelect,
  className = '',
  interactive = true,
  zoom = 14,
}: {
  listings: Listing[]
  location: Location
  selectedId?: string | null
  onSelect?: (storeId: string) => void
  className?: string
  interactive?: boolean
  zoom?: number
}) {
  const markers = useMemo(
    () =>
      listings.map((l) => ({
        id: l.store.id,
        position: [l.store.lat, l.store.lng] as [number, number],
        icon: pinIcon(
          l.store.bag.quantity > 0 ? formatPrice(l.store.bag.price) : 'Sold out',
          l.store.id === selectedId ? 'active' : l.store.bag.quantity > 0 ? '' : 'sold-out',
        ),
      })),
    [listings, selectedId],
  )

  return (
    <MapContainer
      center={[location.lat, location.lng]}
      zoom={zoom}
      className={className}
      zoomControl={false}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={location.lat} lng={location.lng} />
      {interactive && (
        <Circle
          center={[location.lat, location.lng]}
          radius={location.radiusKm * 1000}
          pathOptions={{ color: '#00615f', weight: 1, fillOpacity: 0.04 }}
        />
      )}
      {interactive && <Marker position={[location.lat, location.lng]} icon={meIcon} interactive={false} />}
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
