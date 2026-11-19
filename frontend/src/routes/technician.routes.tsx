import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { ALERT_ROLES, DEVICE_LIST_ROLES } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

// /devices và /alerts dùng chung URL, mỗi role một trang (Farm Owner trang bọc, Admin console mọi thiết bị, Technician và Domain Expert trang Technician)
const TechnicianDevicesPage = lazy(() => import('@/pages/technician/TechnicianDevicesPage'))
const FarmOwnerDevicesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDevicesPage'))
const AdminDevicesPage = lazy(() => import('@/pages/admin/AdminDevicesPage'))
const FarmOwnerAlertsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerAlertsPage'))

function DevicesIndexRoute() {
  const isFarmOwner = usePermission('FARM_OWNER')
  const isAdmin = usePermission('ADMIN')
  if (isFarmOwner) return <FarmOwnerDevicesPage />
  return isAdmin ? <AdminDevicesPage /> : <TechnicianDevicesPage />
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
