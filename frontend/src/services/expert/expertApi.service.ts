import api from '@/lib/axios'
import type { ApiResponse } from '@/types'
import type {
  ExpertVerdictStats,
  InferredAlertItem,
  ExpertThresholds,
  ExpertFuzzyTuning,
  ExpertDetectionTuning,
  FuzzySuggestionResponse,
  ForecastResponse,
  ControlPerformanceResponse,
  AutonomyResponse,
  BirdCountTrendsResponse,
  ZoneComparisonResponse,
  ZoneHealthReportItem,
  HarvestBatchItem,
  RelayOverrideLogItem,
  AlertEvidence,
  ExpertActivityEntry,
  ExpertActivityQuery,
} from '@/types/expert.types'

export const expertApi = {
  // ── 1. Kiểm chứng Cảnh báo suy luận (EXPERT-FR-003, ALERT-FR-014) ───────────
  getPendingAlerts: (params?: { farmId?: string; zoneId?: string }) =>
    api.get<ApiResponse<InferredAlertItem[]>>('/alerts', {
      params: { ...params, verdict: 'pending' },
    }),

  getAllAlerts: (params?: { farmId?: string; zoneId?: string }) =>
    api.get<ApiResponse<InferredAlertItem[]>>('/alerts', { params }),

  getVerdictStats: (params?: { farmId?: string; zoneId?: string }) =>
    api.get<ApiResponse<ExpertVerdictStats[]>>('/alerts/verdict-stats', { params }),

  setAlertVerdict: (alertId: string, result: 'CONFIRMED' | 'REJECTED', note?: string) =>
    api.put<ApiResponse<InferredAlertItem>>(`/alerts/${alertId}/verdict`, { result, note }),

  getAlertEvidence: (alertId: string) =>
    api.get<ApiResponse<AlertEvidence>>(`/alerts/${alertId}/evidence`),

  // ── 1b. Lịch sử hoạt động chuyên gia (EXPERT-FR-009) ───────────────────────
  getExpertActivity: (params: ExpertActivityQuery) =>
    api.get<ApiResponse<ExpertActivityEntry[]> & { meta: { total: number; page: number; limit: number } }>(
      '/expert-activity',
      { params },
    ),

  // ── 2. Cấu hình Ngưỡng & Zone Config (EXPERT-FR-004, ENV-FR-006) ─────────────
  getZone: (zoneId: string) =>
    api.get<ApiResponse<{
      _id: string
      name: string
      thresholds: ExpertThresholds
      fuzzy_tuning: ExpertFuzzyTuning
      detection_tuning: ExpertDetectionTuning
    }>>(`/farms/zones/${zoneId}`),

  updateThresholds: (zoneId: string, thresholds: Partial<ExpertThresholds>) =>
    api.put<ApiResponse<{ _id: string; thresholds: ExpertThresholds }>>(`/farms/zones/${zoneId}/thresholds`, thresholds),

  resetThresholds: (zoneId: string) =>
    api.put<ApiResponse<{ _id: string; thresholds: ExpertThresholds }>>(`/farms/zones/${zoneId}/thresholds/reset`, {}),

  // ── 3. Tinh chỉnh Hệ số mờ & Gợi ý (EXPERT-FR-004, ANALYTICS-FR-010) ───────
  getFuzzySuggestion: (zoneId: string) =>
    api.get<ApiResponse<FuzzySuggestionResponse>>('/analytics/control/suggestion', { params: { zoneId } }),

  updateFuzzyTuning: (zoneId: string, tuning: Partial<ExpertFuzzyTuning>) =>
    api.put<ApiResponse<{ _id: string; fuzzy_tuning: ExpertFuzzyTuning }>>(`/farms/zones/${zoneId}/fuzzy-tuning`, tuning),

  // ── 4. Tham số Phát hiện Bất thường (EXPERT-FR-008) ────────────────────────
  updateDetectionTuning: (zoneId: string, tuning: Partial<ExpertDetectionTuning>) =>
    api.put<ApiResponse<{ _id: string; detection_tuning: ExpertDetectionTuning }>>(`/farms/zones/${zoneId}/detection-tuning`, tuning),

  // ── 5. Phân tích, So sánh & Dự báo (ANALYTICS-FR-005/008/009/011, VISION-FR-009)
  getForecast: (zoneId: string) =>
    api.get<ApiResponse<ForecastResponse>>('/analytics/forecast', { params: { zoneId } }),

  getControlPerformance: (zoneId: string, range = '24h') =>
    api.get<ApiResponse<ControlPerformanceResponse>>('/analytics/control/performance', { params: { zoneId, range } }),

  getAutonomy: (zoneId: string, range = '24h') =>
    api.get<ApiResponse<AutonomyResponse>>('/analytics/autonomy', { params: { zoneId, range } }),

  getBirdCountTrends: (zoneId: string, days = 30) =>
    api.get<ApiResponse<BirdCountTrendsResponse>>('/analytics/bird-count/trends', { params: { zoneId, days } }),

  compareZones: (zoneIds: string[], range = '24h') =>
    api.get<ApiResponse<ZoneComparisonResponse>>('/analytics/env/compare', {
      params: { zoneIds: zoneIds.join(','), range },
    }),

  getHarvestBatches: (params?: { farmId?: string; zoneId?: string }) =>
    api.get<ApiResponse<HarvestBatchItem[]>>('/harvests', { params }),

  // ── 6. Thiết bị & Lịch sử Can thiệp Relay (ENV-FR-019) ──────────────────────
  getSensorNodes: (zoneId?: string) =>
    api.get<ApiResponse<Array<{ _id: string; device_id: string; zone_id: string; status: string }>>>('/devices/sensor-nodes', {
      params: { zoneId },
    }),

  getRelayOverrideLogs: (nodeId: string, params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<RelayOverrideLogItem[]>>(`/devices/sensor-nodes/${nodeId}/relay-overrides`, { params }),

  // ── 7. Báo cáo Sức khỏe Zone (EXPERT-FR-005/006) ───────────────────────────
  getHealthReports: (zoneId: string, params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<ZoneHealthReportItem[]>>('/health-reports', { params: { zoneId, ...params } }),

  previewHealthReport: (params: { zoneId: string; from: string; to?: string }) =>
    api.get<ApiResponse<ZoneHealthReportItem>>('/health-reports/preview', { params }),

  setReportConclusion: (reportId: string, text: string) =>
    api.put<ApiResponse<ZoneHealthReportItem>>(`/health-reports/${reportId}/conclusion`, { text }),
}
