import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LocalNotifications } from '@capacitor/local-notifications'
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
import { isNative, ROUTER_BASENAME } from './lib/native'
import { syncLocalReminders } from './lib/push'
import { track } from './lib/telemetry'
import { ResetPassword, VerifyEmail } from './pages/AccountLink'
import { AppProvider, useAppState, useSync } from './state/store'
import { t, useLang } from './i18n'

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
  const { onboarded, orders, stores } = useAppState()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)
  const showNav = onboarded && TAB_ROUTES.includes(pathname)

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
    track('page_view')
  }, [pathname])

  // Phone apps: keep the local pickup reminders in step with the orders.
  useEffect(() => {
    syncLocalReminders(orders, (id) => stores.find((s) => s.id === id)?.name).catch(() => {})
  }, [orders, stores])

  // Phone apps: tapping a reminder opens its order.
  useEffect(() => {
    if (!isNative) return
    const sub = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const url = e.notification.extra?.url
      if (typeof url === 'string') navigate(url)
    })
    return () => {
      sub.then((h) => h.remove()).catch(() => {})
    }
  }, [navigate])

  // Email links (confirm email, reset password) work before onboarding too.
  if (!onboarded && !['/welcome', '/verify', '/reset'].includes(pathname)) return <Navigate to="/welcome" replace />

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
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/reset" element={<ResetPassword />} />
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
      <p className="min-w-0 flex-1">{t('You’re offline. Showing saved results; reserving needs a connection.')}</p>
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
        {busy ? t('Trying…') : t('Retry')}
      </button>
    </div>
  )
}

export default function App() {
  // Changing the language re-renders the whole app with the new strings.
  const lang = useLang()
  return (
    <AppProvider>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <Shell key={lang} />
      </BrowserRouter>
    </AppProvider>
  )
}
