import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { ALERT_ROLES, DEVICE_SETUP_ROLES, FARM_STRUCTURE_ROLES, TECHNICIAN_ONLY } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

/**
 * Nghiệp vụ kỹ thuật — Technician là role sở hữu các màn hình này (/devices là
 * trang nhà của họ sau đăng nhập); `allow` mới là danh sách quyền thật (Report 3 §2.4).
 * Admin không vào: thiết bị toàn hệ thống Admin xem ở /system/devices.
 */
const TechnicianDevicesPage = lazy(() => import('@/pages/technician/TechnicianDevicesPage'))
// Farm Owner mở /devices qua trang bọc của mình (thêm khung lọc Nhà + Zone), trang Technician giữ nguyên
const FarmOwnerDevicesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDevicesPage'))
const TechnicianAlertsPage = lazy(() => import('@/pages/technician/TechnicianAlertsPage'))
const TechnicianOnboardingPage = lazy(() => import('@/pages/technician/TechnicianOnboardingPage'))
const TechnicianOtaPage = lazy(() => import('@/pages/technician/TechnicianOtaPage'))

// /devices dùng chung URL: Technician mở trang làm việc của mình, Farm Owner và Domain Expert (chỉ đọc) đi qua trang bọc
function DevicesIndexRoute() {
  const isTechnician = usePermission('TECHNICIAN')
  return isTechnician ? <TechnicianDevicesPage /> : <FarmOwnerDevicesPage />
}

export const technicianRoutes = (
  <>
    <Route
      path="devices"
      element={
        <RequireRole allow={FARM_STRUCTURE_ROLES}>
          <DevicesIndexRoute />
        </RequireRole>
      }
    />
    <Route
      path="alerts"
      element={
        <RequireRole allow={ALERT_ROLES}>
          <TechnicianAlertsPage />
        </RequireRole>
      }
    />
    <Route
      path="onboarding"
      element={
        <RequireRole allow={DEVICE_SETUP_ROLES}>
          <TechnicianOnboardingPage />
        </RequireRole>
      }
    />
    <Route
      path="ota"
      element={
        <RequireRole allow={TECHNICIAN_ONLY}>
          <TechnicianOtaPage />
        </RequireRole>
      }
    />
  </>
)
