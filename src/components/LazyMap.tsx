import { lazy, Suspense, type ComponentProps } from 'react'

// Leaflet is the heaviest dependency, so it is only downloaded when a map is shown.
const MapViewImpl = lazy(() => import('./MapView').then((m) => ({ default: m.MapView })))

export function MapView(props: ComponentProps<typeof MapViewImpl>) {
  return (
    <Suspense fallback={<div className={`animate-pulse bg-brand-light ${props.className ?? ''}`} />}>
      <MapViewImpl {...props} />
    </Suspense>
  )
}
