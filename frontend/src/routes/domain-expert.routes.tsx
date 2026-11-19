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
import { Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import RequireRole from '@/components/auth/RequireRole';
import { EXPERT_DECISION_ROLES, EXPERT_ROLES } from '@/constants/roles';
import { usePermission } from '@/hooks/common/usePermission';
import ExpertDecisionNotice from '@/components/features/domain-expert/ExpertDecisionNotice';
import ExpertScadaBanner from '@/components/features/domain-expert/ExpertScadaBanner';

const DomainExpertQueuePage = lazy(() => import('@/pages/domain-expert/DomainExpertQueuePage'));
const DomainExpertAlertVerdictsPage = lazy(() => import('@/pages/domain-expert/DomainExpertAlertVerdictsPage'));
const DomainExpertZoneTuningPage = lazy(() => import('@/pages/domain-expert/DomainExpertZoneTuningPage'));
const DomainExpertReportsPage = lazy(() => import('@/pages/domain-expert/DomainExpertReportsPage'));
const DomainExpertHistoryPage = lazy(() => import('@/pages/domain-expert/DomainExpertHistoryPage'));
const DomainExpertReviewsPage = lazy(() => import('@/pages/domain-expert/DomainExpertReviewsPage'));
const DomainExpertWeatherRulesPage = lazy(() => import('@/pages/domain-expert/DomainExpertWeatherRulesPage'));
const DomainExpertProfilesPage = lazy(() => import('@/pages/domain-expert/DomainExpertProfilesPage'));
const DomainExpertRecommendationRulesPage = lazy(() => import('@/pages/domain-expert/DomainExpertRecommendationRulesPage'));
const DomainExpertCountingSchedulePage = lazy(() => import('@/pages/domain-expert/DomainExpertCountingSchedulePage'));
const DomainExpertCountingRingPage = lazy(() => import('@/pages/domain-expert/DomainExpertCountingRingPage'));

// ── Redirect helpers giữ nguyên query parameters (ví dụ: ?alertId=...) ─────────
function RedirectToVerdicts() {
  const location = useLocation();
  return <Navigate to={`/domain-expert/alert-verdicts${location.search}`} replace />;
}

function RedirectToReports() {
  const location = useLocation();
  return <Navigate to={`/domain-expert/reports${location.search}`} replace />;
}

function RedirectToTuning() {
  const location = useLocation();
  return <Navigate to={`/domain-expert/tuning${location.search}`} replace />;
}

function RedirectToReviews() {
  const location = useLocation();
  return <Navigate to={`/domain-expert/reviews${location.search}`} replace />;
}

function RedirectToDisagreements() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('tab', 'disagreements');
  return <Navigate to={`/domain-expert/reports?${params.toString()}`} replace />;
}

// Hàng đợi việc chỉ của chuyên gia; Farm Owner vào /domain-expert thì mở trang kết luận cảnh báo
function DomainExpertIndexRedirect() {
  const isExpert = usePermission('DOMAIN_EXPERT');
  return <Navigate to={isExpert ? 'queue' : 'alert-verdicts'} replace />;
}

/**
 * Shell bọc toàn bộ trang domain-expert — tương tự ExpertPageShell cũ nhưng
 * import component từ đúng bucket domain-expert/.
 */
function DomainExpertShell() {
  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-5">
      {/* Thanh banner SCADA Chuyên gia với bộ chọn Farm/House/Zone */}
      <ExpertScadaBanner />
      {/* Farm Owner: quyết định thay khi farm chưa có chuyên gia (BR-22), còn lại chỉ xem */}
      <ExpertDecisionNotice />
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
        <RequireRole allow={EXPERT_DECISION_ROLES}>
          <DomainExpertShell />
        </RequireRole>
      }
    >
      {/* Trang chủ: Hàng đợi việc cần xử lý */}
      <Route index element={<DomainExpertIndexRedirect />} />
      <Route path="queue" element={<RequireRole allow={EXPERT_ROLES}><DomainExpertQueuePage /></RequireRole>} />

      {/* Thẩm định cảnh báo AI */}
      <Route path="alert-verdicts" element={<DomainExpertAlertVerdictsPage />} />

      {/* Ngưỡng & Hệ số mờ + Tham số phát hiện */}
      <Route path="tuning" element={<DomainExpertZoneTuningPage />} />

      {/* Duyệt tham số & Đề xuất hệ số mờ (G-04) */}
      <Route path="reviews" element={<DomainExpertReviewsPage />} />

      {/* Lịch đếm chim của nhà (VISION-FR-019, G-12) */}
      <Route path="counting-schedule" element={<DomainExpertCountingSchedulePage />} />

      {/* Vòng đếm chim trên khung live (VISION-FR-018, G-12) */}
      <Route path="counting-ring" element={<DomainExpertCountingRingPage />} />

      {/* Luật bù phun sương theo thời tiết (ENV-FR-030, G-23) */}
      <Route path="weather-rules" element={<DomainExpertWeatherRulesPage />} />

      {/* Báo cáo sức khỏe & Kết luận + Xem ngày đánh giá lệch (EXPERT-FR-022) */}
      <Route path="reports" element={<DomainExpertReportsPage />} />
      <Route path="disagreements" element={<RedirectToDisagreements />} />

      {/* Hồ sơ cấu hình (EXPERT-FR-014, 015) */}
      <Route path="profiles" element={<DomainExpertProfilesPage />} />

      {/* Luật khuyến nghị & hiệu quả (EXPERT-FR-016…019) */}
      <Route path="recommendation-rules" element={<DomainExpertRecommendationRulesPage />} />

      {/* Lịch sử hoạt động */}
      <Route path="history" element={<DomainExpertHistoryPage />} />

      {/* Backward-compat: audit-logs / alerts cũ → alert-verdicts mới (giữ query params) */}
      <Route path="audit-logs" element={<RedirectToVerdicts />} />
      <Route path="alerts" element={<RedirectToVerdicts />} />
    </Route>

    {/* Backward-compat: /expert/* → /domain-expert/* (ánh xạ chính xác đích đến và giữ query params) */}
    <Route path="expert/audit-logs" element={<RedirectToVerdicts />} />
    <Route path="expert/alerts" element={<RedirectToVerdicts />} />
    <Route path="expert/reports" element={<RedirectToReports />} />
    <Route path="expert/disagreements" element={<RedirectToDisagreements />} />
    <Route path="expert/tuning" element={<RedirectToTuning />} />
    <Route path="expert/reviews" element={<RedirectToReviews />} />
    <Route path="expert/dashboard" element={<Navigate to="/domain-expert/queue" replace />} />
    <Route path="expert" element={<Navigate to="/domain-expert/queue" replace />} />
    <Route path="expert/*" element={<Navigate to="/domain-expert/queue" replace />} />
  </>
);
