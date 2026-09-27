import { Heart } from 'lucide-react'
import { useAppState, useDispatch } from '../state/store'

export function FavouriteButton({ storeId, className = '' }: { storeId: string; className?: string }) {
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
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow transition active:scale-90 ${className}`}
    >
      <Heart className={`h-5 w-5 ${active ? 'fill-brand text-brand' : 'text-ink'}`} />
    </button>
  )
}
