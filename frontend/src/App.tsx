import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import MainLayout from '@/components/layout/MainLayout'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
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
      <Routes>
        {/* Public */}
        <Route path="/login"            element={<LoginPage />} />
        <Route path="/register"         element={<RegisterPage />} />
        <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
        <Route path="/invitations/:token" element={<InvitationPage />} />
        <Route path="/marketplace"     element={<MarketplacePage />} />
        <Route path="/marketplace/:id" element={<ListingDetailPage />} />

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
          <Route path="harvests"   element={<HarvestPage />} />
          <Route path="settings"   element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
