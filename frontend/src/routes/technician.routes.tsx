import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { ALERT_ROLES, DEVICE_LIST_ROLES } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

// /devices và /alerts dùng chung URL, mỗi role một trang: Farm Owner và Domain Expert (chỉ xem) trang Farm Owner, Admin mọi thiết bị, Farm Technician nhà được giao
const TechnicianDevicesPage = lazy(() => import('@/pages/technician/TechnicianDevicesPage'))
const FarmOwnerDevicesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDevicesPage'))
const AdminDevicesPage = lazy(() => import('@/pages/admin/AdminDevicesPage'))
const FarmOwnerAlertsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerAlertsPage'))

function DevicesIndexRoute() {
  const isFarmSide = usePermission('FARM_OWNER', 'DOMAIN_EXPERT')
  const isAdmin = usePermission('ADMIN')
  if (isFarmSide) return <FarmOwnerDevicesPage />
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
