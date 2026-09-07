import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import MainLayout from '@/components/layout/MainLayout'
import LoginPage from '@/pages/Auth/LoginPage'
import RegisterPage from '@/pages/Auth/RegisterPage'
import DashboardPage from '@/pages/Dashboard/DashboardPage'
import FarmsPage from '@/pages/Farms/FarmsPage'
import DevicesPage from '@/pages/Devices/DevicesPage'
import AlertsPage from '@/pages/Alerts/AlertsPage'
import AnalyticsPage from '@/pages/Analytics/AnalyticsPage'
import LiveStreamPage from '@/pages/LiveStream/LiveStreamPage'
import SettingsPage from '@/pages/Settings/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected – wrapped in sidebar layout */}
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index             element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<DashboardPage />} />
        <Route path="farms"      element={<FarmsPage />} />
        <Route path="devices"    element={<DevicesPage />} />
        <Route path="alerts"     element={<AlertsPage />} />
        <Route path="analytics"  element={<AnalyticsPage />} />
        <Route path="stream/:id" element={<LiveStreamPage />} />
        <Route path="settings"   element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
