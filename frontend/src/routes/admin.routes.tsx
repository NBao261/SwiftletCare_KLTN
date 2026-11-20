import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { ADMIN_ONLY } from '@/constants/roles'

// Route chỉ Admin: tài khoản (AUTH-FR-011, 012), kho thiết bị (FARM-FR-010), OTA (FARM-FR-013), SYSTEM-FR-001…003
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminAccountRequestsPage = lazy(() => import('@/pages/admin/AdminAccountRequestsPage'))
const AdminSystemHealthPage = lazy(() => import('@/pages/admin/AdminSystemHealthPage'))
const AdminSystemSettingsPage = lazy(() => import('@/pages/admin/AdminSystemSettingsPage'))
const AdminAuditLogPage = lazy(() => import('@/pages/admin/AdminAuditLogPage'))
// FARM-FR-013 — cập nhật firmware từ xa (danh sách thiết bị của Admin ở /devices, technician.routes)
const AdminOtaPage = lazy(() => import('@/pages/admin/AdminOtaPage'))
// FARM-FR-010 — kho thiết bị: thêm, in nhãn QR, cấp lại mã, thu hồi
const AdminDeviceStockPage = lazy(() => import('@/pages/admin/AdminDeviceStockPage'))

export const adminRoutes = (
  <>
    <Route
      path="users"
      element={
        <RequireRole allow={ADMIN_ONLY}>
          <AdminUsersPage />
        </RequireRole>
      }
    />
    <Route
      path="account-requests"
      element={
        <RequireRole allow={ADMIN_ONLY}>
          <AdminAccountRequestsPage />
        </RequireRole>
      }
    />
    <Route
      path="ota"
      element={
        <RequireRole allow={ADMIN_ONLY}>
          <AdminOtaPage />
        </RequireRole>
      }
    />
    <Route
      path="system/device-stock"
      element={
        <RequireRole allow={ADMIN_ONLY}>
          <AdminDeviceStockPage />
        </RequireRole>
      }
    />
    <Route
      path="system/health"
      element={
        <RequireRole allow={ADMIN_ONLY}>
          <AdminSystemHealthPage />
        </RequireRole>
      }
    />
    <Route
      path="system/settings"
      element={
        <RequireRole allow={ADMIN_ONLY}>
          <AdminSystemSettingsPage />
        </RequireRole>
      }
    />
    <Route
      path="system/audit-log"
      element={
        <RequireRole allow={ADMIN_ONLY}>
          <AdminAuditLogPage />
        </RequireRole>
      }
    />
  </>
)
