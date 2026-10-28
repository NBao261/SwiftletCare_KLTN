import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, Farm, House, Thresholds, Zone } from '@/types'

// API trang trại, House, Zone (FARM-FR-*)
export const farmApi = {
  list: () => apiClient.get<ApiResponse<Farm[]>>(ENDPOINTS.FARMS),

  getDetail: (farmId: string) => apiClient.get<ApiResponse<Farm>>(ENDPOINTS.FARM_DETAIL(farmId)),

  create: (payload: Partial<Farm>) => apiClient.post<ApiResponse<Farm>>(ENDPOINTS.FARMS, payload),

  update: (farmId: string, payload: Partial<Farm>) =>
    apiClient.put<ApiResponse<Farm>>(ENDPOINTS.FARM_DETAIL(farmId), payload),

  remove: (farmId: string) => apiClient.delete(ENDPOINTS.FARM_DETAIL(farmId)),

  listHouses: (farmId: string) => apiClient.get<ApiResponse<House[]>>(ENDPOINTS.FARM_HOUSES(farmId)),

  listZones: (houseId: string) => apiClient.get<ApiResponse<Zone[]>>(ENDPOINTS.HOUSE_ZONES(houseId)),

  updateThresholds: (zoneId: string, payload: Partial<Thresholds>) =>
    apiClient.put(ENDPOINTS.ZONE_THRESHOLDS(zoneId), payload),
}
