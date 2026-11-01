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
const TechnicianFarmsPage = lazy(() => import('@/pages/technician/TechnicianFarmsPage'))

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
  </>
)
