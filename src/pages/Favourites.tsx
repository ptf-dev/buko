import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BagCard } from '../components/BagCard'
import { Button } from '../components/Button'
import { EmptyState, PageHeader } from '../components/PageHeader'
import { useAppState, useNow } from '../state/store'
import { useListings } from '../state/useListings'
import { t } from '../i18n'

export function Favourites() {
  const now = useNow()
  const navigate = useNavigate()
  const { favourites } = useAppState()
  const { all } = useListings(now)
  // Favourites are shown regardless of the distance filter, available ones first.
  const favs = all
    .filter((l) => favourites.includes(l.store.id))
    .sort((a, b) => Number(b.store.bag.quantity > 0) - Number(a.store.bag.quantity > 0) || a.start - b.start)

  return (
    <div>
      <PageHeader title={t('Favourites')} />
      {favs.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-9 w-9" />}
          title={t('No favourites yet')}
          text={t('Tap the heart on a store to add it here, so you never miss their surprise bags.')}
          action={<Button onClick={() => navigate('/browse')}>{t('Find stores')}</Button>}
        />
      ) : (
        <div className="grid gap-3 p-4">
          {favs.map((l) => (
            <BagCard key={l.store.id} listing={l} now={now} wide />
          ))}
        </div>
      )}
    </div>
  )
}
