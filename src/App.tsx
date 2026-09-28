import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { BottomNav } from './components/BottomNav'
import { Browse } from './pages/Browse'
import { Discover } from './pages/Discover'
import { Favourites } from './pages/Favourites'
import { Onboarding } from './pages/Onboarding'
import { OrderDetail } from './pages/OrderDetail'
import { Orders } from './pages/Orders'
import { Profile } from './pages/Profile'
import { StoreDetail } from './pages/StoreDetail'
import { DASHBOARD_URL, DEMO_MODE } from './config'
import { ROUTER_BASENAME } from './lib/native'
import { AppProvider, useAppState, useSync } from './state/store'

/** Old in-app partner page: the partner dashboard is now a separate site section. */
function ToDashboard() {
  useEffect(() => {
    window.location.href = DASHBOARD_URL
  }, [])
  return null
}

/** Routes that show the bottom tab bar. */
const TAB_ROUTES = ['/', '/browse', '/orders', '/favourites', '/profile']

function Shell() {
  const { onboarded } = useAppState()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const showNav = onboarded && TAB_ROUTES.includes(pathname)

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  if (!onboarded && pathname !== '/welcome') return <Navigate to="/welcome" replace />

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-white shadow-xl">
      <OfflineBanner />
      <main ref={mainRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/store/:id" element={<StoreDetail />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/favourites" element={<Favourites />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/partner" element={<ToDashboard />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showNav && <BottomNav />}
    </div>
  )
}

/** Shown in production when the server can't be reached: results are the last ones saved, and reserving waits. */
function OfflineBanner() {
  const { live, checked, refresh } = useSync()
  const [busy, setBusy] = useState(false)
  if (DEMO_MODE || live || !checked) return null
  return (
    <div role="status" className="flex items-center gap-3 bg-ink px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2 text-sm text-white">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">You’re offline. Showing saved results; reserving needs a connection.</p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await refresh()
          setBusy(false)
        }}
        className="shrink-0 font-semibold text-sun underline underline-offset-2"
      >
        {busy ? 'Trying…' : 'Retry'}
      </button>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <Shell />
      </BrowserRouter>
    </AppProvider>
  )
}
