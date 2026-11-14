import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { FARM_OWNER_ONLY, FARM_SIDE_ROLES, FARM_STRUCTURE_ROLES, HARVEST_ROLES } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

// Màn nuôi yến của Farm Owner; allow quyết định ai vào (Report 3 §2.4): Domain Expert đọc qua chính các trang này, Technician chỉ Trang trại
const FarmOwnerDashboardPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDashboardPage'))
const FarmOwnerScadaPage = lazy(() => import('@/pages/farm-owner/FarmOwnerScadaPage'))
const FarmOwnerDeviceDetailPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDeviceDetailPage'))
const FarmOwnerAnalyticsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerAnalyticsPage'))
const FarmOwnerVisionPage = lazy(() => import('@/pages/farm-owner/FarmOwnerVisionPage'))
const FarmOwnerFarmsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmsPage'))
const FarmOwnerFarmZonesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmZonesPage'))
const FarmOwnerFarmZoneDetailPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmZoneDetailPage'))
const FarmOwnerHarvestPage = lazy(() => import('@/pages/farm-owner/FarmOwnerHarvestPage'))
const FarmOwnerHealthPage = lazy(() => import('@/pages/farm-owner/FarmOwnerHealthPage'))
const FarmOwnerHealthReportPage = lazy(() => import('@/pages/farm-owner/FarmOwnerHealthReportPage'))
const FarmOwnerWorkOrdersPage = lazy(() => import('@/pages/farm-owner/FarmOwnerWorkOrdersPage'))
const TechnicianFarmsPage = lazy(() => import('@/pages/technician/TechnicianFarmsPage'))

/** /farms dùng chung URL nhưng Farm Technician có trang riêng (chỉ cấu trúc + thiết bị nhà được giao) */
function FarmsIndexRoute() {
  const isFarmTechnician = usePermission('FARM_TECHNICIAN')
  return isFarmTechnician ? <TechnicianFarmsPage /> : <FarmOwnerFarmsPage />
}

export const farmOwnerRoutes = (
  <>
    <Route
      path="dashboard"
      element={
        <RequireRole allow={FARM_SIDE_ROLES}>
          <FarmOwnerDashboardPage />
        </RequireRole>
      }
    />
    <Route
      path="dashboard/scada"
      element={
        <RequireRole allow={FARM_OWNER_ONLY}>
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
    <Route
      path="analytics"
      element={
        <RequireRole allow={FARM_SIDE_ROLES}>
          <FarmOwnerAnalyticsPage />
        </RequireRole>
      }
    />
    <Route
      path="vision"
      element={
        <RequireRole allow={FARM_SIDE_ROLES}>
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
    {/* MF-06 — trạng thái ngày và đánh giá ngày: Farm Owner đánh giá, Domain Expert chỉ xem (SRS 4.2.0, BR-31) */}
    <Route
      path="health"
      element={
        <RequireRole allow={FARM_SIDE_ROLES}>
          <FarmOwnerHealthPage />
        </RequireRole>
      }
    />
    <Route
      path="health/report"
      element={
        <RequireRole allow={FARM_SIDE_ROLES}>
          <FarmOwnerHealthReportPage />
        </RequireRole>
      }
    />
    {/* MF-02 — Work Order sửa chữa: Farm Owner mở, duyệt, mở lại, huỷ, giao lại; Domain Expert chỉ đọc (Report 3 §2.4) */}
    <Route
      path="work-orders"
      element={
        <RequireRole allow={FARM_SIDE_ROLES}>
          <FarmOwnerWorkOrdersPage />
        </RequireRole>
      }
    />
  </>
)
