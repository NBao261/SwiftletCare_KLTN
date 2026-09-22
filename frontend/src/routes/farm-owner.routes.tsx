import { lazy } from 'react'
import { Route } from 'react-router-dom'
import RequireRole from '@/components/auth/RequireRole'
import { FARM_OWNER_ONLY, HARVEST_ROLES, OPS_ROLES } from '@/constants/roles'

/**
 * Nghiệp vụ nuôi yến — Farm Owner là role sở hữu các màn hình này, nhưng
 * `allow` mới là thứ quyết định ai vào được: Tổng quan/Phân tích (giám sát môi
 * trường chi tiết theo zone) chỉ riêng Farm Owner; Trang trại/Camera mở cho cả
 * Technician + Admin; Thu hoạch mở cho Admin (khớp requireRole của router
 * harvests bên backend).
 */
const FarmOwnerDashboardPage = lazy(() => import('@/pages/farm-owner/FarmOwnerDashboardPage'))
const FarmOwnerAnalyticsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerAnalyticsPage'))
const FarmOwnerFarmsPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmsPage'))
const FarmOwnerFarmHousesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmHousesPage'))
const FarmOwnerFarmZonesPage = lazy(() => import('@/pages/farm-owner/FarmOwnerFarmZonesPage'))
const FarmOwnerHarvestPage = lazy(() => import('@/pages/farm-owner/FarmOwnerHarvestPage'))
const FarmOwnerLiveStreamPage = lazy(() => import('@/pages/farm-owner/FarmOwnerLiveStreamPage'))

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
      path="analytics"
      element={
        <RequireRole allow={FARM_OWNER_ONLY}>
          <FarmOwnerAnalyticsPage />
        </RequireRole>
      }
    />
    <Route
      path="farms"
      element={
        <RequireRole allow={OPS_ROLES}>
          <FarmOwnerFarmsPage />
        </RequireRole>
      }
    />
    <Route
      path="farms/:farmId"
      element={
        <RequireRole allow={OPS_ROLES}>
          <FarmOwnerFarmHousesPage />
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
      path="harvests"
      element={
        <RequireRole allow={HARVEST_ROLES}>
          <FarmOwnerHarvestPage />
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
