// Farm Owner vào được trừ Hàng đợi việc và Báo cáo & kết luận; Kỹ thuật viên vào vòng đếm và đọc tham số, lịch đếm, luật thời tiết (G-33)
import { lazy } from 'react';
import { Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import RequireRole from '@/components/auth/RequireRole';
import { EXPERT_DECISION_ROLES, EXPERT_ROLES, FARM_WORK_ROLES, scopeDepthOf } from '@/constants/roles';
import { usePermission } from '@/hooks/common/usePermission';
import ExpertReadOnlyBadge from '@/components/features/domain-expert/ExpertReadOnlyBadge';
import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';

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

// Hàng đợi việc chỉ của chuyên gia; Farm Owner vào /domain-expert thì mở trang thẩm định cảnh báo, Kỹ thuật viên thì vòng đếm
function DomainExpertIndexRedirect() {
  const isExpert = usePermission('DOMAIN_EXPERT');
  const isTechnician = usePermission('FARM_TECHNICIAN');
  return <Navigate to={isExpert ? 'queue' : isTechnician ? 'counting-ring' : 'alert-verdicts'} replace />;
}

// Trang quyết định của chuyên gia: Kỹ thuật viên không vào
function decision(page: JSX.Element): JSX.Element {
  return <RequireRole allow={EXPERT_DECISION_ROLES}>{page}</RequireRole>;
}

// Khung chung của /domain-expert/*
function DomainExpertShell() {
  const scope = useScopeFilter();
  const { pathname } = useLocation();
  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-5">
      <HeaderActions>
        <ScopeFilter scope={scope} depth={scopeDepthOf(pathname)} />
      </HeaderActions>
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
        <RequireRole allow={FARM_WORK_ROLES}>
          <DomainExpertShell />
        </RequireRole>
      }
    >
      {/* Trang chủ: Hàng đợi việc cần xử lý */}
      <Route index element={<DomainExpertIndexRedirect />} />
      <Route path="queue" element={<RequireRole allow={EXPERT_ROLES}><DomainExpertQueuePage /></RequireRole>} />

      {/* Thẩm định cảnh báo AI */}
      <Route path="alert-verdicts" element={decision(<DomainExpertAlertVerdictsPage />)} />

      {/* Ngưỡng & Hệ số mờ + Tham số phát hiện */}
      <Route path="tuning" element={<DomainExpertZoneTuningPage />} />

      {/* Duyệt tham số & Đề xuất hệ số mờ */}
      <Route path="reviews" element={decision(<DomainExpertReviewsPage />)} />

      {/* Lịch đếm chim của nhà */}
      <Route path="counting-schedule" element={<DomainExpertCountingSchedulePage />} />

      {/* Vòng đếm chim trên khung live */}
      <Route path="counting-ring" element={<DomainExpertCountingRingPage />} />

      {/* Luật bù phun sương theo thời tiết */}
      <Route path="weather-rules" element={<DomainExpertWeatherRulesPage />} />

      {/* Báo cáo sức khỏe & Kết luận + Xem ngày đánh giá lệch */}
      <Route path="reports" element={<RequireRole allow={EXPERT_ROLES}><DomainExpertReportsPage /></RequireRole>} />

      {/* Hồ sơ cấu hình */}
      <Route path="profiles" element={decision(<DomainExpertProfilesPage />)} />

      {/* Luật khuyến nghị & hiệu quả */}
      <Route path="recommendation-rules" element={decision(<DomainExpertRecommendationRulesPage />)} />

      {/* Lịch sử quyết định của chuyên gia */}
      <Route path="history" element={decision(<DomainExpertHistoryPage />)} />
    </Route>
  </>
);
