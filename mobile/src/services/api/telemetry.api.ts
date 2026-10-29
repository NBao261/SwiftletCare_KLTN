import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, TelemetryRecord } from '@/types'

// API dữ liệu cảm biến của Zone (ENV-FR-*)
export const telemetryApi = {
  // Zone chưa có số đo nào thì backend trả data: null (không phải 404)
  getLatest: (zoneId: string) =>
    apiClient.get<ApiResponse<TelemetryRecord | null>>(ENDPOINTS.TELEMETRY_LATEST(zoneId)),

  getHistory: (zoneId: string, from?: string, to?: string) =>
    apiClient.get<ApiResponse<TelemetryRecord[]>>(ENDPOINTS.TELEMETRY_HISTORY(zoneId), { params: { from, to } }),
}
