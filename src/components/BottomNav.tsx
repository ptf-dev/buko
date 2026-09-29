import { Compass, Heart, Receipt, Search, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppState } from '../state/store'
import { t } from '../i18n'

const TABS = [
  { to: '/', label: 'Discover', icon: Compass, end: true },
  { to: '/browse', label: 'Browse', icon: Search },
  { to: '/orders', label: 'Orders', icon: Receipt },
  { to: '/favourites', label: 'Favourites', icon: Heart },
  { to: '/profile', label: 'Profile', icon: User },
]

export function BottomNav() {
  const { orders } = useAppState()
  const upcoming = orders.filter((o) => o.status === 'reserved').length
  return (
    <nav className="sticky bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  isActive ? 'text-brand' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-6 w-6 ${isActive ? 'stroke-[2.4]' : ''}`} />
                  {t(label)}
                  {to === '/orders' && upcoming > 0 && (
                    <span className="absolute top-1 left-1/2 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-sun px-1 text-[10px] font-bold text-ink">
                      {upcoming}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
