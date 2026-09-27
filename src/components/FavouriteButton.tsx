import { Heart } from 'lucide-react'
import { useAppState, useDispatch } from '../state/store'

/** Heart toggle. `plain` is the bare icon used inside cards; the default is a round button for photos. */
export function FavouriteButton({ storeId, className = '', plain = false }: { storeId: string; className?: string; plain?: boolean }) {
  const { favourites } = useAppState()
  const dispatch = useDispatch()
  const active = favourites.includes(storeId)
  return (
    <button
      type="button"
      aria-label={active ? 'Remove from favourites' : 'Add to favourites'}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        dispatch({ type: 'toggleFavourite', storeId })
      }}
      className={`flex shrink-0 items-center justify-center rounded-full transition active:scale-90 ${
        plain ? '-m-1.5 h-10 w-10' : 'h-9 w-9 bg-white/95 shadow'
      } ${className}`}
    >
      <Heart className={`${plain ? 'h-6 w-6' : 'h-5 w-5'} ${active ? 'fill-brand text-brand' : plain ? 'text-brand' : 'text-ink'}`} strokeWidth={plain ? 1.8 : 2} />
    </button>
  )
}
