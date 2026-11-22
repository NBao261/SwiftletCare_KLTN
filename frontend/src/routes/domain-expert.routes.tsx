// Farm Owner vào được trừ Hàng đợi việc và Báo cáo & kết luận
import { lazy } from 'react';
import { Route, Navigate, Outlet } from 'react-router-dom';
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

// Hàng đợi việc chỉ của chuyên gia; Farm Owner vào /domain-expert thì mở trang thẩm định cảnh báo
function DomainExpertIndexRedirect() {
  const isExpert = usePermission('DOMAIN_EXPERT');
  return <Navigate to={isExpert ? 'queue' : 'alert-verdicts'} replace />;
}

// Khung chung của /domain-expert/*
function DomainExpertShell() {
  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-5">
      {/* Thanh banner SCADA Chuyên gia với bộ chọn Farm/House/Zone */}
      <ExpertScadaBanner />
      {/* Farm Owner: quyết định thay khi farm chưa có chuyên gia, còn lại chỉ xem */}
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

      {/* Duyệt tham số & Đề xuất hệ số mờ */}
      <Route path="reviews" element={<DomainExpertReviewsPage />} />

      {/* Lịch đếm chim của nhà */}
      <Route path="counting-schedule" element={<DomainExpertCountingSchedulePage />} />

      {/* Vòng đếm chim trên khung live */}
      <Route path="counting-ring" element={<DomainExpertCountingRingPage />} />

      {/* Luật bù phun sương theo thời tiết */}
      <Route path="weather-rules" element={<DomainExpertWeatherRulesPage />} />

      {/* Báo cáo sức khỏe & Kết luận + Xem ngày đánh giá lệch */}
      <Route path="reports" element={<RequireRole allow={EXPERT_ROLES}><DomainExpertReportsPage /></RequireRole>} />

      {/* Hồ sơ cấu hình */}
      <Route path="profiles" element={<DomainExpertProfilesPage />} />

      {/* Luật khuyến nghị & hiệu quả */}
      <Route path="recommendation-rules" element={<DomainExpertRecommendationRulesPage />} />

      {/* Lịch sử quyết định của chuyên gia */}
      <Route path="history" element={<DomainExpertHistoryPage />} />
    </Route>
  </>
);
