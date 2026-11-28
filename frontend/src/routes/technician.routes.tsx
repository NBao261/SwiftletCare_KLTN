import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { ALERT_ROLES, DEVICE_LIST_ROLES } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

// /devices và /alerts dùng chung URL: Administrator một trang riêng, các role còn lại dùng trang của Farm Owner
const FarmOwnerDevicesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDevicesPage'))
const AdminDevicesPage = lazy(() => import('@/pages/admin/AdminDevicesPage'))
const FarmOwnerAlertsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerAlertsPage'))

function DevicesIndexRoute() {
  return usePermission('ADMIN') ? <AdminDevicesPage /> : <FarmOwnerDevicesPage />
}

export const technicianRoutes = (
  <>
    <Route
      path="devices"
      element={
        <RequireRole allow={DEVICE_LIST_ROLES}>
          <DevicesIndexRoute />
        </RequireRole>
      }
    />
    <Route
      path="alerts"
      element={
        <RequireRole allow={ALERT_ROLES}>
          <FarmOwnerAlertsPage />
        </RequireRole>
      }
    />
  </>
)
