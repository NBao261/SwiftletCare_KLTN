import api from './client'
import { ENDPOINTS } from '@/constants/api'
import type { Farm, House, Zone, Thresholds, ApiResponse } from '@/types'

export const farmApi = {
  list:        ()                    => api.get<ApiResponse<Farm[]>>(ENDPOINTS.FARMS),
  getOne:      (id: string)          => api.get<ApiResponse<Farm>>(`${ENDPOINTS.FARMS}/${id}`),
  create:      (data: Partial<Farm>) => api.post<ApiResponse<Farm>>(ENDPOINTS.FARMS, data),
  update:      (id: string, data: Partial<Farm>) => api.put(`${ENDPOINTS.FARMS}/${id}`, data),
  remove:      (id: string)          => api.delete(`${ENDPOINTS.FARMS}/${id}`),
  listHouses:  (farmId: string)      => api.get<ApiResponse<House[]>>(ENDPOINTS.FARM_HOUSES(farmId)),
  listZones:   (houseId: string)     => api.get<ApiResponse<Zone[]>>(ENDPOINTS.HOUSE_ZONES(houseId)),
  updateThresholds: (zoneId: string, data: Partial<Thresholds>) =>
    api.put(ENDPOINTS.ZONE_THRESHOLDS(zoneId), data),
}
