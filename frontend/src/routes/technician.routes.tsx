import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { OPS_ROLES } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

/**
 * Nghiệp vụ kỹ thuật — Technician là role sở hữu các màn hình này (/devices là
 * trang nhà của họ sau đăng nhập), nhưng Farm Owner + Admin cũng vào được:
 * `allow={OPS_ROLES}` mới là danh sách quyền thật.
 */
const TechnicianDevicesPage = lazy(() => import('@/pages/technician/TechnicianDevicesPage'))
// Farm Owner mở /devices qua trang bọc của mình (thêm khung lọc Nhà + Zone), trang Technician giữ nguyên
const FarmOwnerDevicesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDevicesPage'))
const TechnicianAlertsPage = lazy(() => import('@/pages/technician/TechnicianAlertsPage'))
const TechnicianTicketsPage = lazy(() => import('@/pages/technician/TechnicianTicketsPage'))
const TechnicianTicketDetailPage = lazy(() => import('@/pages/technician/TechnicianTicketDetailPage'))
const TechnicianOnboardingPage = lazy(() => import('@/pages/technician/TechnicianOnboardingPage'))
const TechnicianOtaPage = lazy(() => import('@/pages/technician/TechnicianOtaPage'))
const TechnicianMaintenancePage = lazy(() => import('@/pages/technician/TechnicianMaintenancePage'))

// /devices dùng chung URL: Farm Owner đi qua trang bọc, role khác mở thẳng trang Technician
function DevicesIndexRoute() {
  const isFarmOwner = usePermission('FARM_OWNER')
  return isFarmOwner ? <FarmOwnerDevicesPage /> : <TechnicianDevicesPage />
}

export const technicianRoutes = (
  <>
    <Route
      path="devices"
      element={
        <RequireRole allow={OPS_ROLES}>
          <DevicesIndexRoute />
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
    <Route
      path="maintenance"
      element={
        <RequireRole allow={OPS_ROLES}>
          <TechnicianMaintenancePage />
        </RequireRole>
      }
    />
  </>
)
