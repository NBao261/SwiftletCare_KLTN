/**
 * technician.routes.tsx — Routes kỹ thuật viên (TECHNICIAN)
 *
 * FE_Design §12.0 c dòng 5/5b — Chốt 27/10/2026:
 *   - /ota:         CHỈ Technician (không phải Farm Owner hay Admin)
 *   - /onboarding:  SETUP_ROLES = Farm Owner + Technician (bỏ Admin)
 *   - /devices:     OPS_ROLES (giữ nguyên — Farm Owner + Technician + Admin)
 *   - /alerts:      OPS_ROLES (giữ nguyên) — nút xác nhận Farm Owner thấy, ẩn qua usePermission
 *
 * Không đổi tên thư mục pages/technician/ (đã đúng kebab-case, file cũ có sẵn).
 * Bucket: routes/ — §12.2.
 */
import { lazy } from 'react';
import { Route } from 'react-router-dom';
import RequireRole from '@/components/auth/RequireRole';
import { OPS_ROLES } from '@/constants/roles';
import type { Role } from '@/types';
import { usePermission } from '@/hooks/common/usePermission';

// ── Nhóm quyền mới ──────────────────────────────────────────────────────────────
// SETUP_ROLES: Farm Owner + Technician (thiết lập thiết bị bằng QR - MF-10)
// Tạm thời định nghĩa tại đây; sau khi Nhi merge PR ma trận quyền (G-15)
// sẽ chuyển về import từ @/constants/roles.ts
const SETUP_ROLES: Role[] = ['FARM_OWNER', 'TECHNICIAN'];

// TECH_ONLY: Chỉ Technician (OTA — cập nhật firmware nguy hiểm, không để Farm Owner bấm)
const TECH_ONLY: Role[] = ['TECHNICIAN'];

const TechnicianDevicesPage = lazy(() => import('@/pages/technician/TechnicianDevicesPage'));
// Farm Owner mở /devices qua trang bọc riêng
const FarmOwnerDevicesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDevicesPage'));
const TechnicianAlertsPage = lazy(() => import('@/pages/technician/TechnicianAlertsPage'));
const TechnicianOnboardingPage = lazy(() => import('@/pages/technician/TechnicianOnboardingPage'));
const TechnicianOtaPage = lazy(() => import('@/pages/technician/TechnicianOtaPage'));

// /devices dùng chung URL: Farm Owner đi qua trang bọc, role khác mở thẳng trang Technician
function DevicesIndexRoute() {
  const isFarmOwner = usePermission('FARM_OWNER');
  return isFarmOwner ? <FarmOwnerDevicesPage /> : <TechnicianDevicesPage />;
}

export const technicianRoutes = (
  <>
    {/* Thiết bị — Farm Owner + Technician + Admin */}
    <Route
      path="devices"
      element={
        <RequireRole allow={OPS_ROLES}>
          <DevicesIndexRoute />
        </RequireRole>
      }
    />

    {/* Cảnh báo thiết bị — Farm Owner + Technician + Admin
        Nút "Xác nhận" chỉ Farm Owner thấy (usePermission trong TechnicianAlertsPage) */}
    <Route
      path="alerts"
      element={
        <RequireRole allow={OPS_ROLES}>
          <TechnicianAlertsPage />
        </RequireRole>
      }
    />

    {/* Lắp đặt & Kích hoạt thiết bị (MF-10) — Farm Owner + Technician
        Bắt buộc có quét QR; Admin không vào (không phải kỹ thuật hiện trường) */}
    <Route
      path="onboarding"
      element={
        <RequireRole allow={SETUP_ROLES}>
          <TechnicianOnboardingPage />
        </RequireRole>
      }
    />

    {/* Cập nhật Firmware (OTA) — CHỈ TECHNICIAN
        Thao tác nguy hiểm, nếu Farm Owner bấm có thể làm treo/hỏng thiết bị IoT */}
    <Route
      path="ota"
      element={
        <RequireRole allow={TECH_ONLY}>
          <TechnicianOtaPage />
        </RequireRole>
      }
    />
  </>
);
