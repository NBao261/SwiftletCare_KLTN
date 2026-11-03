import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type {
  AnalyticsRange,
  ApiResponse,
  AutonomyResult,
  BirdCountBucketsResult,
  BirdCountDailyResult,
  BirdCountToday,
  ControlPerformanceResult,
  ControlSuggestion,
  CorrelationResult,
  EnvSummaryResult,
  ForecastResult,
} from '@/types'

// API phân tích (ANALYTICS-FR-*): đàn chim theo nhà, môi trường và điều khiển theo zone
export const analyticsApi = {
  // Số đếm từng ngày của cả nhà, ngày giờ Việt Nam (ANALYTICS-FR-002)
  getBirdCountDaily: (houseId: string, from: string, to: string) =>
    apiClient.get<ApiResponse<BirdCountDailyResult>>(ENDPOINTS.BIRD_COUNT_DAILY, { params: { houseId, from, to } }),

  // Số đếm hôm nay của cả nhà yến (VISION-FR-012)
  getBirdCountCurrent: (houseId: string) =>
    apiClient.get<ApiResponse<BirdCountToday>>(ENDPOINTS.BIRD_COUNT_CURRENT, { params: { houseId } }),

  // Số đếm từng khung 5 phút (VISION-FR-017), tối đa 7 ngày
  getBirdCountBuckets: (houseId: string, from: string, to: string) =>
    apiClient.get<ApiResponse<BirdCountBucketsResult>>(ENDPOINTS.BIRD_COUNT_BUCKETS, { params: { houseId, from, to } }),

  // Môi trường theo ngày của zone ghép với tỉ lệ về tổ của nhà (ANALYTICS-FR-003)
  getCorrelation: (zoneId: string, days: number) =>
    apiClient.get<ApiResponse<CorrelationResult>>(ENDPOINTS.ENVIRONMENT_CORRELATION, { params: { zoneId, days } }),

  // Chuỗi trung bình 6 chỉ số của zone theo khoảng (ANALYTICS-FR-001)
  getEnvSummary: (zoneId: string, range: AnalyticsRange) =>
    apiClient.get<ApiResponse<EnvSummaryResult>>(ENDPOINTS.ENV_SUMMARY, { params: { zoneId, range } }),

  // Hiệu quả điều khiển của zone (ANALYTICS-FR-008)
  getControlPerformance: (zoneId: string, range: AnalyticsRange) =>
    apiClient.get<ApiResponse<ControlPerformanceResult>>(ENDPOINTS.CONTROL_PERFORMANCE, { params: { zoneId, range } }),

  // % thời gian tự động của zone (ANALYTICS-FR-011)
  getAutonomy: (zoneId: string, range: AnalyticsRange) =>
    apiClient.get<ApiResponse<AutonomyResult>>(ENDPOINTS.AUTONOMY, { params: { zoneId, range } }),

  // Dự báo nhiệt, ẩm 60 phút tới (ANALYTICS-FR-009)
  getForecast: (zoneId: string) =>
    apiClient.get<ApiResponse<ForecastResult>>(ENDPOINTS.FORECAST, { params: { zoneId } }),

  // Gợi ý hệ số bộ điều khiển mờ (ANALYTICS-FR-010), chỉ đọc
  getControlSuggestion: (zoneId: string) =>
    apiClient.get<ApiResponse<ControlSuggestion>>(ENDPOINTS.CONTROL_SUGGESTION, { params: { zoneId } }),
}
