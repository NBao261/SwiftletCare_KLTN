// Màn quyết định của chuyên gia (FE_Design §12.0 c); Farm Owner vào được trừ Hàng đợi việc và Báo cáo & kết luận (xem ở /health)
import { lazy } from 'react';
import { Route, Navigate, Outlet } from 'react-router-dom';
import RequireRole from '@/components/auth/RequireRole';
import { EXPERT_DECISION_ROLES, EXPERT_ROLES } from '@/constants/roles';
import { usePermission } from '@/hooks/common/usePermission';
import ExpertReadOnlyBadge from '@/components/features/domain-expert/ExpertReadOnlyBadge';

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

// Hàng đợi việc chỉ của chuyên gia; Farm Owner vào /domain-expert thì mở trang thẩm định cảnh báo
function DomainExpertIndexRedirect() {
  const isExpert = usePermission('DOMAIN_EXPERT');
  return <Navigate to={isExpert ? 'queue' : 'alert-verdicts'} replace />;
}

// Khung chung /domain-expert/*: DE-01 bỏ banner SCADA (ScopeFilter trên header thay thế, C-05); DE-10 badge nhỏ thay dải nhắc quyền
function DomainExpertShell() {
  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-5">
      <ExpertReadOnlyBadge />
      <Outlet />
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
      <Route path="reports" element={<RequireRole allow={EXPERT_ROLES}><DomainExpertReportsPage /></RequireRole>} />

      {/* Hồ sơ cấu hình (EXPERT-FR-014, 015) */}
      <Route path="profiles" element={<DomainExpertProfilesPage />} />

      {/* Luật khuyến nghị & hiệu quả (EXPERT-FR-016…019) */}
      <Route path="recommendation-rules" element={<DomainExpertRecommendationRulesPage />} />

      {/* Lịch sử quyết định của chuyên gia (EXPERT-FR-009) */}
      <Route path="history" element={<DomainExpertHistoryPage />} />
    </Route>
  </>
);
