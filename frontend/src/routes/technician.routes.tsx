import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { ALERT_ROLES, DEVICE_LIST_ROLES } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

/**
 * Hai URL dùng chung của 4 role, mỗi role một trang:
 *   - /devices: Farm Owner trang bọc của mình (lọc Nhà + Zone); Admin danh sách mọi thiết bị kèm farm, nhà, khu vực và
 *     lệnh từ xa (FARM-FR-009, 013); Farm Technician (nhà được giao, RESTART) và Domain Expert (chỉ đọc) trang Technician
 *   - /alerts: một trang cho Farm Owner, Farm Technician (xác nhận) và Admin (cảnh báo thiết bị, chỉ xem)
 * Lắp đặt (/devices/onboarding) ở farm-owner.routes, OTA (/ota) ở admin.routes.
 */
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
