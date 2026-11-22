import api from '@/lib/axios'
import type { ApiResponse } from '@/types'
import type {
  ExpertVerdictStats,
  InferredAlertItem,
  ExpertThresholds,
  ExpertFuzzyTuning,
  ExpertDetectionTuning,
  FuzzySuggestionResponse,
  AutonomyResponse,
  AlertEvidence,
  ExpertActivityEntry,
  ExpertActivityQuery,
  InferredAlertQuery,
} from '@/types/expert.types'

export const expertApi = {
  // Backend chỉ trả cảnh báo suy luận khi có verdict; lọc và phân trang ở server
  listInferredAlerts: (params: InferredAlertQuery) =>
    api.get<ApiResponse<InferredAlertItem[]>>('/alerts', { params }),

  getVerdictStats: (params?: { farmId?: string; zoneId?: string }) =>
    api.get<ApiResponse<ExpertVerdictStats[]>>('/alerts/verdict-stats', { params }),

  setAlertVerdict: (alertId: string, result: 'CONFIRMED' | 'REJECTED', note?: string) =>
    api.put<ApiResponse<InferredAlertItem>>(`/alerts/${alertId}/verdict`, { result, note }),

  getAlertEvidence: (alertId: string) =>
    api.get<ApiResponse<AlertEvidence>>(`/alerts/${alertId}/evidence`),

  // 1b. Lịch sử hoạt động chuyên gia
  getExpertActivity: (params: ExpertActivityQuery) =>
    api.get<ApiResponse<ExpertActivityEntry[]> & { meta: { total: number; page: number; limit: number } }>(
      '/expert-activity',
      { params },
    ),

  // 2. Cấu hình Ngưỡng & Zone Config
  getZone: (zoneId: string) =>
    api.get<ApiResponse<{
      _id: string
      house_id: string
      name: string
      thresholds: ExpertThresholds
      fuzzy_tuning: ExpertFuzzyTuning
      detection_tuning: ExpertDetectionTuning
    }>>(`/farms/zones/${zoneId}`),

  updateThresholds: (zoneId: string, thresholds: Partial<ExpertThresholds>) =>
    api.put<ApiResponse<{ _id: string; thresholds: ExpertThresholds }>>(`/farms/zones/${zoneId}/thresholds`, thresholds),

  // "reset to defaults": backend dùng bộ mặc định của nó, web không giữ bản sao hằng số
  resetDetectionTuning: (zoneId: string) =>
    api.put<ApiResponse<{ _id: string; detection_tuning: ExpertDetectionTuning }>>(`/farms/zones/${zoneId}/detection-tuning/reset`),

  resetThresholds: (zoneId: string) =>
    api.put<ApiResponse<{ _id: string; thresholds: ExpertThresholds }>>(`/farms/zones/${zoneId}/thresholds/reset`, {}),

  // 3. Tinh chỉnh Hệ số mờ & Gợi ý
  getFuzzySuggestion: (zoneId: string) =>
    api.get<ApiResponse<FuzzySuggestionResponse>>('/analytics/control/suggestion', { params: { zoneId } }),

  updateFuzzyTuning: (zoneId: string, tuning: Partial<ExpertFuzzyTuning>) =>
    api.put<ApiResponse<{ _id: string; fuzzy_tuning: ExpertFuzzyTuning }>>(`/farms/zones/${zoneId}/fuzzy-tuning`, tuning),

  // 4. Tham số Phát hiện Bất thường
  updateDetectionTuning: (zoneId: string, tuning: Partial<ExpertDetectionTuning>) =>
    api.put<ApiResponse<{ _id: string; detection_tuning: ExpertDetectionTuning }>>(`/farms/zones/${zoneId}/detection-tuning`, tuning),

  // 5. Phân tích, So sánh & Dự báo
  getAutonomy: (zoneId: string, range = '24h') =>
    api.get<ApiResponse<AutonomyResponse>>('/analytics/autonomy', { params: { zoneId, range } }),
}
