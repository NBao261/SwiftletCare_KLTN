import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { OPS_ROLES } from '@/constants/roles'

/**
 * Nghiệp vụ kỹ thuật — Technician là role sở hữu các màn hình này (/devices là
 * trang nhà của họ sau đăng nhập), nhưng Farm Owner + Admin cũng vào được:
 * `allow={OPS_ROLES}` mới là danh sách quyền thật.
 */
const TechnicianDevicesPage = lazy(() => import('@/pages/technician/TechnicianDevicesPage'))
const TechnicianAlertsPage = lazy(() => import('@/pages/technician/TechnicianAlertsPage'))
const TechnicianTicketsPage = lazy(() => import('@/pages/technician/TechnicianTicketsPage'))
const TechnicianTicketDetailPage = lazy(() => import('@/pages/technician/TechnicianTicketDetailPage'))
const TechnicianOnboardingPage = lazy(() => import('@/pages/technician/TechnicianOnboardingPage'))
const TechnicianOtaPage = lazy(() => import('@/pages/technician/TechnicianOtaPage'))

export const technicianRoutes = (
  <>
    <Route
      path="devices"
      element={
        <RequireRole allow={OPS_ROLES}>
          <TechnicianDevicesPage />
        </RequireRole>
      }
    />
    <Route
      path="alerts"
      element={
        <RequireRole allow={OPS_ROLES}>
          <TechnicianAlertsPage />
        </RequireRole>
      }
    />
    <Route
      path="tickets"
      element={
        <RequireRole allow={OPS_ROLES}>
          <TechnicianTicketsPage />
        </RequireRole>
      }
    />
    <Route
      path="tickets/:id"
      element={
        <RequireRole allow={OPS_ROLES}>
          <TechnicianTicketDetailPage />
        </RequireRole>
      }
    />
    <Route
      path="onboarding"
      element={
        <RequireRole allow={OPS_ROLES}>
          <TechnicianOnboardingPage />
        </RequireRole>
      }
    />
    <Route
      path="ota"
      element={
        <RequireRole allow={OPS_ROLES}>
          <TechnicianOtaPage />
        </RequireRole>
      }
    />
  </>
)
