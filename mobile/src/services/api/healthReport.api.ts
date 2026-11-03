import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, HealthReportPreview, ZoneHealthReport } from '@/types'

// API báo cáo sức khoẻ (EXPERT-FR-005/006)
export const healthReportApi = {
  // Báo cáo của một zone, kỳ mới nhất trước
  list: (zoneId: string, page: number, limit: number) =>
    apiClient.get<ApiResponse<ZoneHealthReport[]>>(ENDPOINTS.HEALTH_REPORTS, { params: { zoneId, page, limit } }),

  getDetail: (reportId: string) =>
    apiClient.get<ApiResponse<ZoneHealthReport>>(ENDPOINTS.HEALTH_REPORT_DETAIL(reportId)),

  // Báo cáo khoảng tự chọn (tối đa 30 ngày), chỉ xem, backend không lưu
  preview: (zoneId: string, from: string, to: string) =>
    apiClient.get<ApiResponse<HealthReportPreview>>(ENDPOINTS.HEALTH_REPORT_PREVIEW, { params: { zoneId, from, to } }),

  // Kết luận của chuyên gia (EXPERT-FR-006); chỉ người viết đầu tiên sửa được
  updateConclusion: (reportId: string, text: string) =>
    apiClient.put<ApiResponse<ZoneHealthReport>>(ENDPOINTS.HEALTH_REPORT_CONCLUSION(reportId), { text }),
}
