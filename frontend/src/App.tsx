import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import MainLayout from '@/components/layout/MainLayout'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import RequireRole from '@/components/auth/RequireRole'
import { setNavigate } from '@/utils/navigation'

// Code-splitting theo route — tránh bundle chính kéo theo chart.js/date-fns
// (chỉ AnalyticsPage dùng) cho mọi user kể cả khi họ chưa từng vào /analytics.
const LoginPage = lazy(() => import('@/pages/Auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/Auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/Auth/ForgotPasswordPage'))
const InvitationPage = lazy(() => import('@/pages/Invitations/InvitationPage'))
const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'))
const FarmsPage = lazy(() => import('@/pages/Farms/FarmsPage'))
const DevicesPage = lazy(() => import('@/pages/Devices/DevicesPage'))
const AlertsPage = lazy(() => import('@/pages/Alerts/AlertsPage'))
const AnalyticsPage = lazy(() => import('@/pages/Analytics/AnalyticsPage'))
const LiveStreamPage = lazy(() => import('@/pages/LiveStream/LiveStreamPage'))
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'))
const TicketsPage = lazy(() => import('@/pages/Tickets/TicketsPage'))
const TicketDetailPage = lazy(() => import('@/pages/Tickets/TicketDetailPage'))
const HarvestPage = lazy(() => import('@/pages/Harvest/HarvestPage'))
const MarketplacePage = lazy(() => import('@/pages/Marketplace/MarketplacePage'))
const ListingDetailPage = lazy(() => import('@/pages/Marketplace/ListingDetailPage'))
const ForbiddenPage = lazy(() => import('@/pages/Forbidden/ForbiddenPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const hasHydrated = useAuthStore(s => s.hasHydrated)
  const location = useLocation()

  // Chờ zustand/persist đọc xong localStorage trước khi quyết định — tránh
  // flash redirect về /login khi F5 một trang đã đăng nhập.
  if (!hasHydrated) return <RouteFallback />

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
  }
  return <>{children}</>
}

/** Đăng ký navigate() của router vào bridge để client.ts (ngoài React tree) dùng được. */
function NavigationBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    setNavigate(navigate)
    return () => setNavigate(null)
  }, [navigate])
  return null
}

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center p-6">
      <LoadingSkeleton className="h-24 w-full max-w-md" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <NavigationBridge />
      <Routes>
        {/* Public */}
        <Route path="/login"            element={<LoginPage />} />
        <Route path="/register"         element={<RegisterPage />} />
        <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
        <Route path="/invitations/:token" element={<InvitationPage />} />
        <Route path="/marketplace"     element={<MarketplacePage />} />
        <Route path="/marketplace/:id" element={<ListingDetailPage />} />
        <Route path="/403"             element={<ForbiddenPage />} />

        {/* Protected – wrapped in sidebar layout */}
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index             element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="farms"      element={<FarmsPage />} />
          <Route path="devices"    element={<DevicesPage />} />
          <Route path="alerts"     element={<AlertsPage />} />
          <Route path="analytics"  element={<AnalyticsPage />} />
          <Route path="stream/:id" element={<LiveStreamPage />} />
          <Route path="tickets"    element={<TicketsPage />} />
          <Route path="tickets/:id" element={<TicketDetailPage />} />
          {/* Backend: toàn bộ router harvests chỉ requireRole(FARM_OWNER, ADMIN) */}
          <Route
            path="harvests"
            element={<RequireRole allow={['FARM_OWNER', 'ADMIN']}><HarvestPage /></RequireRole>}
          />
          <Route path="settings"   element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
