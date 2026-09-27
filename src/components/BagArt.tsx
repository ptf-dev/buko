import { CATEGORIES, logoColor } from '../data/categories'
import { assetUrl } from '../lib/api'
import { initials } from '../lib/format'
import type { Store } from '../types'

/**
 * Cover image for a store's surprise bag: the store's own photo, or a 3D illustration of its category on a
 * soft background. `shade` darkens the bottom for text laid over the image.
 */
export function BagArt({ store, className = '', shade = false }: { store: Store; className?: string; shade?: boolean }) {
  const meta = CATEGORIES[store.category]
  const soldOut = store.bag.quantity <= 0
  return (
    <div className={`relative overflow-hidden ${soldOut ? 'grayscale-[70%]' : ''} ${className}`} style={{ background: meta.tint }}>
      {store.photoUrl ? (
        <img src={assetUrl(store.photoUrl)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <span className="absolute -top-10 -left-8 h-40 w-40 rounded-full bg-white/45" aria-hidden />
          <span className="absolute -right-6 -bottom-12 h-44 w-44 rounded-full bg-white/35" aria-hidden />
          <img src={meta.image} alt="" loading="lazy" decoding="async" className="absolute top-1/2 left-1/2 h-[72%] max-h-40 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_10px_14px_rgba(0,0,0,0.18)]" />
        </>
      )}
      {shade && <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/10" />}
    </div>
  )
}

export function StoreLogo({ store, size = 40 }: { store: Store; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-white font-bold text-white shadow"
      style={{ width: size, height: size, background: logoColor(store.id), fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(store.name)}
    </div>
  )
}
