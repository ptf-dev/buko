import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, ToastProvider, useAuth, useResource } from './data'
import { AdminOrders, AdminOverviewPage, AdminPartnerDetail, AdminPartners, AdminTeam } from './pages/Admin'
import { Apply, Login, NoDatabase, Pending, Setup } from './pages/Auth'
import { PartnerEarnings } from './pages/Earnings'
import { AdminBilling, AdminComplaints, AdminFinance, AdminFinanceSettings, AdminPayouts } from './pages/Finance'
import { PartnerListing, PartnerOrders, PartnerStore, PartnerToday } from './pages/Partner'
import { adminNav, PARTNER_NAV, Shell } from './Shell'
import type { AdminOverview } from './types'
import { Skeleton } from './ui'

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-10 rounded-2xl" />
    </div>
  )
}

function Home() {
  const { user, health } = useAuth()
  if (health && typeof health === 'object' && health.needsSetup) return <Navigate to="/setup" replace />
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to={user.storeStatus === 'active' ? '/partner' : '/pending'} replace />
}

function PartnerArea() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'partner') return <Navigate to="/" replace />
  if (user.storeStatus !== 'active') return <Navigate to="/pending" replace />
  return (
    <Shell nav={PARTNER_NAV} context="Partner dashboard">
      <Outlet />
    </Shell>
  )
}

function AdminArea() {
  const { user } = useAuth()
  // Pending application count for the sidebar badge.
  const overview = useResource<AdminOverview>(user?.role === 'admin' ? 'admin/overview?days=7' : null, 60_000)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return (
    <Shell nav={adminNav(overview.data?.counts.pending ?? 0, (overview.data?.counts.open_complaints ?? 0) + (overview.data?.counts.pending_bank ?? 0))} context="Ngopu admin">
      <Outlet />
    </Shell>
  )
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, health } = useAuth()
  if (health && typeof health === 'object' && health.needsSetup) return <Navigate to="/setup" replace />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function Routed() {
  const { health, user } = useAuth()
  if (health === null) return <Splash />
  if (health === 'no-database' || health === 'offline') return <NoDatabase offline={health === 'offline'} />

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setup" element={health.needsSetup ? <Setup /> : <Navigate to="/" replace />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/apply" element={<GuestOnly><Apply /></GuestOnly>} />
      <Route path="/pending" element={user?.role === 'partner' && user.storeStatus !== 'active' ? <Pending /> : <Navigate to="/" replace />} />
      <Route path="/partner" element={<PartnerArea />}>
        <Route index element={<PartnerToday />} />
        <Route path="listing" element={<PartnerListing />} />
        <Route path="orders" element={<PartnerOrders />} />
        <Route path="earnings" element={<PartnerEarnings />} />
        <Route path="store" element={<PartnerStore />} />
      </Route>
      <Route path="/admin" element={<AdminArea />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="partners" element={<AdminPartners />} />
        <Route path="partners/:id" element={<AdminPartnerDetail />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="finance" element={<AdminFinance />} />
        <Route path="finance/payouts" element={<AdminPayouts />} />
        <Route path="finance/complaints" element={<AdminComplaints />} />
        <Route path="finance/stores" element={<AdminBilling />} />
        <Route path="finance/settings" element={<AdminFinanceSettings />} />
        <Route path="team" element={<AdminTeam />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function Dashboard() {
  return (
    <BrowserRouter basename="/dashboard">
      <AuthProvider>
        <ToastProvider>
          <Routed />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
