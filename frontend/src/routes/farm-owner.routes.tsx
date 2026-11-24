import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { DEVICE_SETUP_ROLES, FARM_SIDE_ROLES, FARM_WORK_ROLES, FARM_STRUCTURE_ROLES, HARVEST_ROLES, RELAY_CONTROL_ROLES } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

// allow quyết định ai vào; Technician chỉ Trang trại
const FarmOwnerDashboardPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDashboardPage'))
const FarmOwnerScadaPage = lazy(() => import('@/pages/farm-owner/FarmOwnerScadaPage'))
const FarmOwnerDeviceDetailPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDeviceDetailPage'))
const FarmOwnerDeviceSetupPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDeviceSetupPage'))
const FarmOwnerAnalyticsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerAnalyticsPage'))
const FarmOwnerVisionPage = lazy(() => import('@/pages/farm-owner/FarmOwnerVisionPage'))
const FarmOwnerFarmsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmsPage'))
const FarmOwnerFarmZonesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmZonesPage'))
const FarmOwnerFarmZoneDetailPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmZoneDetailPage'))
const FarmOwnerHarvestPage = lazy(() => import('@/pages/farm-owner/FarmOwnerHarvestPage'))
const FarmOwnerMaintenancePage = lazy(() => import('@/pages/farm-owner/FarmOwnerMaintenancePage'))
const FarmOwnerRecommendationsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerRecommendationsPage'))
const FarmOwnerHealthPage = lazy(() => import('@/pages/farm-owner/FarmOwnerHealthPage'))
const FarmOwnerHealthReportPage = lazy(() => import('@/pages/farm-owner/FarmOwnerHealthReportPage'))
const FarmOwnerWorkOrdersPage = lazy(() => import('@/pages/farm-owner/FarmOwnerWorkOrdersPage'))
const FarmOwnerOverviewPage = lazy(() => import('@/pages/farm-owner/FarmOwnerOverviewPage'))
const TechnicianFarmsPage = lazy(() => import('@/pages/technician/TechnicianFarmsPage'))

// /farms dùng chung URL nhưng Farm Technician có trang riêng (chỉ cấu trúc + thiết bị nhà được giao)
function FarmsIndexRoute() {
  const isFarmTechnician = usePermission('FARM_TECHNICIAN')
  return isFarmTechnician ? <TechnicianFarmsPage /> : <FarmOwnerFarmsPage />
}

export const farmOwnerRoutes = (
  <>
    <Route
      path="dashboard"
      element={
        <RequireRole allow={FARM_WORK_ROLES}>
          <FarmOwnerDashboardPage />
        </RequireRole>
      }
    />
    <Route
      path="dashboard/scada"
      element={
        <RequireRole allow={RELAY_CONTROL_ROLES}>
          <FarmOwnerScadaPage />
        </RequireRole>
      }
    />
    <Route
      path="devices/detail"
      element={
        <RequireRole allow={FARM_SIDE_ROLES}>
          <FarmOwnerDeviceDetailPage />
        </RequireRole>
      }
    />
    {/* Chỉ Farm Owner; nằm dưới /devices để header hiện mục Thiết bị */}
    <Route
      path="devices/onboarding"
      element={
        <RequireRole allow={DEVICE_SETUP_ROLES}>
          <FarmOwnerDeviceSetupPage />
        </RequireRole>
      }
    />
    <Route
      path="overview"
      element={
        <RequireRole allow={FARM_SIDE_ROLES}>
          <FarmOwnerOverviewPage />
        </RequireRole>
      }
    />
    <Route
      path="analytics"
      element={
        <RequireRole allow={FARM_WORK_ROLES}>
          <FarmOwnerAnalyticsPage />
        </RequireRole>
      }
    />
    <Route
      path="vision"
      element={
        <RequireRole allow={FARM_WORK_ROLES}>
          <FarmOwnerVisionPage />
        </RequireRole>
      }
    />
    <Route
      path="farms"
      element={
        <RequireRole allow={FARM_STRUCTURE_ROLES}>
          <FarmsIndexRoute />
        </RequireRole>
      }
    />
    <Route
      path="farms/:farmId/houses/:houseId"
      element={
        <RequireRole allow={FARM_STRUCTURE_ROLES}>
          <FarmOwnerFarmZonesPage />
        </RequireRole>
      }
    />
    <Route
      path="farms/:farmId/houses/:houseId/zones/:zoneId"
      element={
        <RequireRole allow={FARM_STRUCTURE_ROLES}>
          <FarmOwnerFarmZoneDetailPage />
        </RequireRole>
      }
    />
    <Route
      path="harvests"
      element={
        <RequireRole allow={HARVEST_ROLES}>
          <FarmOwnerHarvestPage />
        </RequireRole>
      }
    />
    {/* kế hoạch bảo trì phòng ngừa: Farm Owner tạo, sửa, xoá; Domain Expert xem và góp ý */}
    <Route
      path="maintenance"
      element={
        <RequireRole allow={FARM_WORK_ROLES}>
          <FarmOwnerMaintenancePage />
        </RequireRole>
      }
    />
    {/* khuyến nghị: Farm Owner chấp nhận hoặc từ chối, Domain Expert xem */}
    <Route
      path="recommendations"
      element={
        <RequireRole allow={FARM_WORK_ROLES}>
          <FarmOwnerRecommendationsPage />
        </RequireRole>
      }
    />
    {/* trạng thái ngày và đánh giá ngày: Farm Owner, Kỹ thuật viên (nhà được giao) đánh giá, Domain Expert chỉ xem */}
    <Route
      path="health"
      element={
        <RequireRole allow={FARM_WORK_ROLES}>
          <FarmOwnerHealthPage />
        </RequireRole>
      }
    />
    <Route
      path="health/report"
      element={
        <RequireRole allow={FARM_WORK_ROLES}>
          <FarmOwnerHealthReportPage />
        </RequireRole>
      }
    />
    {/* Work Order sửa chữa: Farm Owner mở, duyệt, mở lại, huỷ, giao lại; Domain Expert chỉ đọc */}
    <Route
      path="work-orders"
      element={
        <RequireRole allow={FARM_WORK_ROLES}>
          <FarmOwnerWorkOrdersPage />
        </RequireRole>
      }
    />
  </>
)
