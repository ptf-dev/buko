import { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { Browse } from './pages/Browse'
import { Discover } from './pages/Discover'
import { Favourites } from './pages/Favourites'
import { Onboarding } from './pages/Onboarding'
import { OrderDetail } from './pages/OrderDetail'
import { Orders } from './pages/Orders'
import { Partner } from './pages/Partner'
import { Profile } from './pages/Profile'
import { StoreDetail } from './pages/StoreDetail'
import { ROUTER_BASENAME } from './lib/native'
import { AppProvider, useAppState } from './state/store'

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
      <main ref={mainRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/store/:id" element={<StoreDetail />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/favourites" element={<Favourites />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/partner" element={<Partner />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showNav && <BottomNav />}
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
