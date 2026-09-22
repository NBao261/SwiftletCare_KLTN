import api from '@/lib/axios'
import type { ApiResponse, TelemetryRecord } from '@/types'

export const telemetryApi = {
  getLatest: (zoneId: string) => api.get<ApiResponse<TelemetryRecord>>(`/telemetry/zones/${zoneId}/latest`),
  getHistory: (zoneId: string, params?: { from?: string; to?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<TelemetryRecord[]>>(`/telemetry/zones/${zoneId}/history`, { params }),
}
