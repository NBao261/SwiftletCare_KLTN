import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { FARM_OWNER_ONLY, HARVEST_ROLES, OPS_ROLES } from '@/constants/roles'
import { usePermission } from '@/hooks/common/usePermission'

// Màn nuôi yến của Farm Owner; allow quyết định ai vào: Trang trại / Camera mở cho Technician + Admin, Thu hoạch cho Admin (khớp backend)
const FarmOwnerDashboardPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDashboardPage'))
const FarmOwnerScadaPage = lazy(() => import('@/pages/farm-owner/FarmOwnerScadaPage'))
const FarmOwnerDeviceDetailPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDeviceDetailPage'))
const FarmOwnerAnalyticsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerAnalyticsPage'))
const FarmOwnerVisionPage = lazy(() => import('@/pages/farm-owner/FarmOwnerVisionPage'))
const FarmOwnerFarmsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmsPage'))
const FarmOwnerFarmZonesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmZonesPage'))
const FarmOwnerFarmZoneDetailPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmZoneDetailPage'))
const FarmOwnerHarvestPage = lazy(() => import('@/pages/farm-owner/FarmOwnerHarvestPage'))
const FarmOwnerLiveStreamPage = lazy(() => import('@/pages/farm-owner/FarmOwnerLiveStreamPage'))
const TechnicianFarmsPage = lazy(() => import('@/pages/technician/TechnicianFarmsPage'))
const FarmOwnerTicketsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerTicketsPage'))
const FarmOwnerTicketDetailPage = lazy(() => import('@/pages/farm-owner/FarmOwnerTicketDetailPage'))

/** /farms dùng chung URL nhưng Technician có trang riêng (chỉ cấu trúc + thiết bị trong vùng, không sản lượng) */
function FarmsIndexRoute() {
  const isTechnician = usePermission('TECHNICIAN')
  return isTechnician ? <TechnicianFarmsPage /> : <FarmOwnerFarmsPage />
}

export const farmOwnerRoutes = (
  <>
    <Route
      path="dashboard"
      element={
        <RequireRole allow={FARM_OWNER_ONLY}>
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
        <RequireRole allow={FARM_OWNER_ONLY}>
          <FarmOwnerDeviceDetailPage />
        </RequireRole>
      }
    />
    <Route
      path="analytics"
      element={
        <RequireRole allow={FARM_OWNER_ONLY}>
          <FarmOwnerAnalyticsPage />
        </RequireRole>
      }
    />
    <Route
      path="vision"
      element={
        <RequireRole allow={FARM_OWNER_ONLY}>
          <FarmOwnerVisionPage />
        </RequireRole>
      }
    />
    <Route
      path="farms"
      element={
        <RequireRole allow={OPS_ROLES}>
          <FarmsIndexRoute />
        </RequireRole>
      }
    />
    <Route
      path="farms/:farmId/houses/:houseId"
      element={
        <RequireRole allow={OPS_ROLES}>
          <FarmOwnerFarmZonesPage />
        </RequireRole>
      }
    />
    <Route
      path="farms/:farmId/houses/:houseId/zones/:zoneId"
      element={
        <RequireRole allow={OPS_ROLES}>
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
    {/* Ticket của Farm Owner tách URL khỏi /tickets (màn xử lý của Technician): tạo, theo dõi, huỷ, đánh giá */}
    <Route
      path="support"
      element={
        <RequireRole allow={FARM_OWNER_ONLY}>
          <FarmOwnerTicketsPage />
        </RequireRole>
      }
    />
    <Route
      path="support/chi-tiet"
      element={
        <RequireRole allow={FARM_OWNER_ONLY}>
          <FarmOwnerTicketDetailPage />
        </RequireRole>
      }
    />
    <Route
      path="stream/:id"
      element={
        <RequireRole allow={OPS_ROLES}>
          <FarmOwnerLiveStreamPage />
        </RequireRole>
      }
    />
  </>
)
