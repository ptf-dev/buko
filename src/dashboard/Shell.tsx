import { Banknote, ClipboardList, ExternalLink, LayoutGrid, LogOut, Package, Store, Users, Wallet, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './data'

interface NavItem {
  to: string
  label: string
  /** Label under the icon in the phone tab bar. */
  short: string
  icon: LucideIcon
  end?: boolean
  badge?: number
}

export const PARTNER_NAV: NavItem[] = [
  { to: '/partner', label: 'Today', short: 'Today', icon: LayoutGrid, end: true },
  { to: '/partner/listing', label: 'Surprise Bag', short: 'Bag', icon: Package },
  { to: '/partner/orders', label: 'Orders', short: 'Orders', icon: ClipboardList },
  { to: '/partner/earnings', label: 'Earnings', short: 'Earnings', icon: Wallet },
  { to: '/partner/store', label: 'Store profile', short: 'Store', icon: Store },
]

export function adminNav(pending: number, financeTodo = 0): NavItem[] {
  return [
    { to: '/admin', label: 'Overview', short: 'Overview', icon: LayoutGrid, end: true },
    { to: '/admin/partners', label: 'Partners', short: 'Partners', icon: Store, badge: pending },
    { to: '/admin/orders', label: 'Orders', short: 'Orders', icon: ClipboardList },
    { to: '/admin/finance', label: 'Finance', short: 'Finance', icon: Banknote, badge: financeTodo },
    { to: '/admin/team', label: 'Team & settings', short: 'Team', icon: Users },
  ]
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-xl font-black tracking-tight text-brand">
      <img src="/favicon.svg" alt="" className="h-7 w-7" />
      <span>
        ngopu<span className="text-sun">.</span>
      </span>
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden>
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

export function Shell({ nav, context, children }: { nav: NavItem[]; context: string; children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line/70 bg-white px-4 py-6 lg:flex">
        <div className="px-2">
          <Wordmark />
          <p className="mt-1 text-xs font-medium text-muted">{context}</p>
        </div>
        <nav aria-label="Main" className="mt-8 flex-1">
          <ul className="space-y-1">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors duration-150 ${
                      isActive ? 'bg-brand-light text-brand-dark' : 'text-ink/75 hover:bg-cream hover:text-ink'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {!!item.badge && (
                    <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-ink tabular-nums" aria-label={`${item.badge} waiting`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <a href="/app" className="mb-3 flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted hover:bg-cream hover:text-ink">
          <ExternalLink className="h-4 w-4" aria-hidden /> Open customer app
        </a>
        {user && (
          <div className="flex items-center gap-3 rounded-2xl bg-cream p-3">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <button type="button" onClick={signOut} aria-label="Log out" className="rounded-lg p-2 text-muted hover:bg-white hover:text-ink">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-white/90 px-4 backdrop-blur-md lg:hidden">
        <Wordmark />
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs font-medium text-muted">{context}</span>
          <button type="button" onClick={signOut} aria-label="Log out" className="rounded-lg p-2 text-muted hover:bg-cream">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-muted'}`
                }
              >
                <item.icon className="h-6 w-6" aria-hidden />
                {item.short}
                {!!item.badge && (
                  <span className="absolute top-1 left-1/2 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-sun px-1 text-[10px] font-bold text-ink">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-16 items-center justify-between px-5 sm:px-8">
        <a href="/" aria-label="Ngopu home">
          <Wordmark />
        </a>
        <a href="/app" className="text-sm font-medium text-muted hover:text-ink">
          Customer app
        </a>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>{children}</div>
      </main>
    </div>
  )
}

