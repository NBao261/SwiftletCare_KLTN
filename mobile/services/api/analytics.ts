import api from './client'
import { ENDPOINTS } from '@/constants/api'
import type { BirdCountRecord, ApiResponse } from '@/types'

export const analyticsApi = {
  birdCountDaily:  (zoneId: string, from?: string, to?: string) =>
    api.get<ApiResponse<BirdCountRecord[]>>(ENDPOINTS.BIRD_COUNT_DAILY, { params: { zoneId, from, to } }),
  birdCountTrends: (zoneId: string, days?: number) =>
    api.get<ApiResponse<BirdCountRecord[]>>(ENDPOINTS.BIRD_COUNT_TRENDS, { params: { zoneId, days } }),
  correlation:     (zoneId: string, metric?: string, days?: number) =>
    api.get(ENDPOINTS.ENV_CORRELATION, { params: { zoneId, metric, days } }),
}
