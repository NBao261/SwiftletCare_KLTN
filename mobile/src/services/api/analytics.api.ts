import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, BirdCountRecord } from '@/types'

// API phân tích: số đếm chim, tương quan môi trường (ANALYTICS-FR-*)
export const analyticsApi = {
  getBirdCountDaily: (zoneId: string, from?: string, to?: string) =>
    apiClient.get<ApiResponse<BirdCountRecord[]>>(ENDPOINTS.BIRD_COUNT_DAILY, { params: { zoneId, from, to } }),

  getBirdCountTrends: (zoneId: string, days?: number) =>
    apiClient.get<ApiResponse<BirdCountRecord[]>>(ENDPOINTS.BIRD_COUNT_TRENDS, { params: { zoneId, days } }),

  getEnvironmentCorrelation: (zoneId: string, metric?: string, days?: number) =>
    apiClient.get(ENDPOINTS.ENVIRONMENT_CORRELATION, { params: { zoneId, metric, days } }),
}
