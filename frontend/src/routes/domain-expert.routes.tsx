/**
 * domain-expert.routes.tsx — Routes chuyên gia nuôi yến (DOMAIN_EXPERT)
 *
 * FE_Design §12.0 c dòng 1 — Chốt 27/10/2026:
 *   Khu /domain-expert/* CHỈ chứa các màn QUYẾT ĐỊNH của chuyên gia.
 *   Màn vận hành (dashboard, analytics, vision, harvests) dùng chung với
 *   Farm Owner — không nhân bản, ẩn nút ghi bằng usePermission.
 *
 * Xoá bỏ hoàn toàn:
 *   - /expert/dashboard    → thay bằng /domain-expert/queue (hàng đợi việc)
 *   - /expert/analytics    → Chuyên gia dùng /analytics của Farm Owner (FARM_SIDE_ROLES)
 *
 * Redirect backward-compat: /expert/* → /domain-expert/* để không gây 404 nếu
 * còn link cũ trong code (xoá sau khi toàn bộ link cũ đã cập nhật).
 *
 * Bucket: routes/ — §12.2.
 */
import { lazy } from 'react';
import { Route, Navigate, Outlet } from 'react-router-dom';
import RequireRole from '@/components/auth/RequireRole';
import { EXPERT_ROLES } from '@/constants/roles';
import ExpertScadaBanner from '@/components/features/domain-expert/ExpertScadaBanner';

const DomainExpertQueuePage = lazy(() => import('@/pages/domain-expert/DomainExpertQueuePage'));
const DomainExpertAlertVerdictsPage = lazy(() => import('@/pages/domain-expert/DomainExpertAlertVerdictsPage'));
const DomainExpertZoneTuningPage = lazy(() => import('@/pages/domain-expert/DomainExpertZoneTuningPage'));
const DomainExpertReportsPage = lazy(() => import('@/pages/domain-expert/DomainExpertReportsPage'));
const DomainExpertHistoryPage = lazy(() => import('@/pages/domain-expert/DomainExpertHistoryPage'));

/**
 * Shell bọc toàn bộ trang domain-expert — tương tự ExpertPageShell cũ nhưng
 * import component từ đúng bucket domain-expert/.
 */
function DomainExpertShell() {
  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-5">
      {/* Thanh banner SCADA Chuyên gia với bộ chọn Farm/House/Zone */}
      <ExpertScadaBanner />
      <div className="flex w-full flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}

export const domainExpertRoutes = (
  <>
    {/* Khu vực riêng của Chuyên gia: /domain-expert/* */}
    <Route
      path="domain-expert"
      element={
        <RequireRole allow={EXPERT_ROLES}>
          <DomainExpertShell />
        </RequireRole>
      }
    >
      {/* Trang chủ: Hàng đợi việc cần xử lý */}
      <Route index element={<Navigate to="queue" replace />} />
      <Route path="queue" element={<DomainExpertQueuePage />} />

      {/* Thẩm định cảnh báo AI */}
      <Route path="alert-verdicts" element={<DomainExpertAlertVerdictsPage />} />

      {/* Ngưỡng & Hệ số mờ + Tham số phát hiện */}
      <Route path="tuning" element={<DomainExpertZoneTuningPage />} />

      {/* Báo cáo sức khỏe & Kết luận */}
      <Route path="reports" element={<DomainExpertReportsPage />} />

      {/* Lịch sử hoạt động */}
      <Route path="history" element={<DomainExpertHistoryPage />} />

      {/* Backward-compat: audit-logs cũ → alert-verdicts mới */}
      <Route path="audit-logs" element={<Navigate to="/domain-expert/alert-verdicts" replace />} />
    </Route>

    {/* Backward-compat: /expert/* → /domain-expert/* (xoá sau khi cleanup hoàn tất) */}
    <Route path="expert" element={<Navigate to="/domain-expert/queue" replace />} />
    <Route path="expert/*" element={<Navigate to="/domain-expert/queue" replace />} />
  </>
);
