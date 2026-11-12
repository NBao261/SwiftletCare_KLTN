import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { ADMIN_ONLY, ALERT_ROLES, DEVICE_LIST_ROLES, DEVICE_SETUP_ROLES } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

/**
 * Nghiệp vụ kỹ thuật — các màn hình trong pages/technician/ phục vụ:
 *   - FARM_TECHNICIAN: thợ nhà yến (xem thiết bị/cảnh báo nhà được giao, RESTART)
 *   - ADMIN (G-20): Console thiết bị — xem mọi farm, RESTART/PUSH_CONFIG/OTA
 *   - FARM_OWNER: quản lý thiết bị farm của mình
 *   - DOMAIN_EXPERT: xem cấu trúc/thiết bị (chỉ đọc)
 *
 * Phân quyền API (G-20, backend f9d9522):
 *   - Cài đặt/dời/gỡ/thay thiết bị, quản lý file loa: FARM_OWNER only (403 cho ADMIN & FARM_TECHNICIAN)
 *   - RESTART: ADMIN, FARM_OWNER, FARM_TECHNICIAN (nhà được giao)
 *   - PUSH_CONFIG, OTA: ADMIN only
 */
const TechnicianDevicesPage = lazy(() => import('@/pages/technician/TechnicianDevicesPage'))
// Farm Owner mở /devices qua trang bọc của mình (thêm khung lọc Nhà + Zone), role khác mở thẳng trang Technician
const FarmOwnerDevicesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDevicesPage'))
const TechnicianAlertsPage = lazy(() => import('@/pages/technician/TechnicianAlertsPage'))
const TechnicianOnboardingPage = lazy(() => import('@/pages/technician/TechnicianOnboardingPage'))
const TechnicianOtaPage = lazy(() => import('@/pages/technician/TechnicianOtaPage'))

// /devices dùng chung URL: Farm Owner vào trang bọc; mọi role khác (ADMIN, FARM_TECHNICIAN, DOMAIN_EXPERT) vào TechnicianDevicesPage
function DevicesIndexRoute() {
  const isFarmOwner = usePermission('FARM_OWNER')
  return isFarmOwner ? <FarmOwnerDevicesPage /> : <TechnicianDevicesPage />
}

export const technicianRoutes = (
  <>
    <Route
      path="devices"
      element={
        // G-20: Admin vào /devices (console thiết bị mọi farm) cùng các role trang trại
        <RequireRole allow={DEVICE_LIST_ROLES}>
          <DevicesIndexRoute />
        </RequireRole>
      }
    />
    <Route
      path="alerts"
      element={
        // G-20: ADMIN xem cảnh báo thiết bị mọi farm; ALERT_ROLES = ADMIN | FARM_OWNER | FARM_TECHNICIAN
        <RequireRole allow={ALERT_ROLES}>
          <TechnicianAlertsPage />
        </RequireRole>
      }
    />
    <Route
      path="onboarding"
      element={
        // G-20: chỉ FARM_OWNER (ADMIN và FARM_TECHNICIAN gọi API → 403)
        <RequireRole allow={DEVICE_SETUP_ROLES}>
          <TechnicianOnboardingPage />
        </RequireRole>
      }
    />
    <Route
      path="ota"
      element={
        // G-20: OTA chỉ ADMIN (route /ota ở web là phần của Tuấn — todo-final-scope.md §3)
        <RequireRole allow={ADMIN_ONLY}>
          <TechnicianOtaPage />
        </RequireRole>
      }
    />
  </>
)
