import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, BirdCountRecord, BirdCountToday } from '@/types'

// API phân tích: số đếm chim, tương quan môi trường (ANALYTICS-FR-*)
export const analyticsApi = {
  getBirdCountDaily: (zoneId: string, from?: string, to?: string) =>
    apiClient.get<ApiResponse<BirdCountRecord[]>>(ENDPOINTS.BIRD_COUNT_DAILY, { params: { zoneId, from, to } }),

  getBirdCountTrends: (zoneId: string, days?: number) =>
    apiClient.get<ApiResponse<BirdCountRecord[]>>(ENDPOINTS.BIRD_COUNT_TRENDS, { params: { zoneId, days } }),

  // Số đếm hôm nay của cả nhà yến (VISION-FR-012)
  getBirdCountCurrent: (houseId: string) =>
    apiClient.get<ApiResponse<BirdCountToday>>(ENDPOINTS.BIRD_COUNT_CURRENT, { params: { houseId } }),

  getEnvironmentCorrelation: (zoneId: string, metric?: string, days?: number) =>
    apiClient.get(ENDPOINTS.ENVIRONMENT_CORRELATION, { params: { zoneId, metric, days } }),
}
