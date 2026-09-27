import { CATEGORIES, logoColor } from '../data/categories'
import { initials } from '../lib/format'
import type { Store } from '../types'

/** Illustrated cover for a store's surprise bag (stands in for store photos). */
export function BagArt({ store, className = '' }: { store: Store; className?: string }) {
  const meta = CATEGORIES[store.category]
  const Icon = meta.icon
  const soldOut = store.bag.quantity <= 0
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${meta.gradient} ${soldOut ? 'grayscale-[60%]' : ''} ${className}`}
    >
      <Icon className="absolute -right-4 -bottom-6 h-32 w-32 text-white/50" strokeWidth={1.25} />
      <Icon className="absolute top-3 left-1/3 h-10 w-10 text-white/35 rotate-12" strokeWidth={1.5} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
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
