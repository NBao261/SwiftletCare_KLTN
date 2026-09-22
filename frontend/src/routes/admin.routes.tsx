import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { ADMIN_ONLY } from '@/constants/roles'

/**
 * Route chỉ Admin: quản lý tài khoản toàn hệ thống (AUTH-FR-011), hàng đợi xoá
 * tài khoản + đề xuất Sales Staff (AUTH-FR-012, AUTH-FR-005d) và Module SYSTEM
 * (mục 5.11). /system/health gộp luôn OPS-NFR-004 (trạng thái node).
 */
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminAccountRequestsPage = lazy(() => import('@/pages/admin/AdminAccountRequestsPage'))
const AdminSystemHealthPage = lazy(() => import('@/pages/admin/AdminSystemHealthPage'))
const AdminSystemSettingsPage = lazy(() => import('@/pages/admin/AdminSystemSettingsPage'))
const AdminAuditLogPage = lazy(() => import('@/pages/admin/AdminAuditLogPage'))

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
    {/* Trang trạng thái node cũ đã gộp vào /system/health — giữ redirect cho bookmark/link cũ */}
    <Route path="system-status" element={<Navigate to="/system/health" replace />} />
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
