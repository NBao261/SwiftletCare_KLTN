import api from './client'
import { ENDPOINTS } from '@/constants/api'
import type { TelemetryRecord, ApiResponse } from '@/types'

export const telemetryApi = {
  getLatest:  (zoneId: string) =>
    api.get<ApiResponse<TelemetryRecord>>(ENDPOINTS.TELEMETRY_LATEST(zoneId)),
  getHistory: (zoneId: string, from?: string, to?: string) =>
    api.get<ApiResponse<TelemetryRecord[]>>(ENDPOINTS.TELEMETRY_HISTORY(zoneId), { params: { from, to } }),
}
