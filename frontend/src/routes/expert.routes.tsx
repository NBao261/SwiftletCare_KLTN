import { lazy } from 'react'
import { Route, Navigate } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { EXPERT_ROLES } from '@/constants/roles'
import ExpertPageShell from '@/components/features/expert/ExpertPageShell'

/**
 * Tuyến đường chuyên môn cho Chuyên gia nuôi yến (DOMAIN_EXPERT) — SRS v2.1.4:
 * Bảng điều khiển, Kiểm chứng cảnh báo suy luận, Tinh chỉnh & Hiệu chuẩn, Phân tích dự báo, Báo cáo sức khỏe.
 * Guard bảo vệ bằng RequireRole với EXPERT_ROLES = ['DOMAIN_EXPERT'].
 * Tích hợp khung ExpertPageShell mang theo thanh banner đen SCADA Chuyên gia và bộ chọn Zone 3 cấp.
 */
const ExpertDashboardPage = lazy(() => import('@/pages/expert/ExpertDashboardPage'))
const ExpertAuditLogsPage = lazy(() => import('@/pages/expert/ExpertAuditLogsPage'))
const ExpertZoneTuningPage = lazy(() => import('@/pages/expert/ExpertZoneTuningPage'))
const ExpertAnalyticsPage = lazy(() => import('@/pages/expert/ExpertAnalyticsPage'))
const ExpertReportsPage = lazy(() => import('@/pages/expert/ExpertReportsPage'))

export const expertRoutes = (
  <Route
    path="expert"
    element={
      <RequireRole allow={EXPERT_ROLES}>
        <ExpertPageShell />
      </RequireRole>
    }
  >
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<ExpertDashboardPage />} />
    <Route path="audit-logs" element={<ExpertAuditLogsPage />} />
    <Route path="alerts" element={<Navigate to="/expert/audit-logs" replace />} />
    <Route path="tuning" element={<ExpertZoneTuningPage />} />
    <Route path="zone-tuning" element={<Navigate to="/expert/tuning" replace />} />
    <Route path="analytics" element={<ExpertAnalyticsPage />} />
    <Route path="reports" element={<ExpertReportsPage />} />
  </Route>
)
