import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type {
  ApiResponse,
  HealthRatingValue,
  HealthReportPreview,
  HouseHealthDay,
  HouseHealthReport,
  HouseHealthReportKind,
  HouseHealthReportSummary,
  MyRatingState,
} from '@/types'

// Phạm vi các ngày: một nhà hoặc mọi nhà của một farm; ngày YYYY-MM-DD giờ Việt Nam, tối đa 31 ngày
export interface HealthDaysParams {
  houseId?: string
  farmId?: string
  from?: string
  to?: string
  myRatingState?: MyRatingState
}

export interface HouseReportsParams {
  houseId: string
  kind?: HouseHealthReportKind
  page: number
  limit: number
}

// API trạng thái ngày và báo cáo sức khỏe theo nhà (ANALYTICS-FR-012, EXPERT-FR-005/006/012)
export const healthReportApi = {
  // Các ngày của nhà, mới nhất trước; ngày người gọi chưa chấm bị che (BR-31)
  listDays: (params: HealthDaysParams) =>
    apiClient.get<ApiResponse<HouseHealthDay[]>>(ENDPOINTS.HEALTH_DAYS, { params }),

  getDay: (dayId: string) => apiClient.get<ApiResponse<HouseHealthDay>>(ENDPOINTS.HEALTH_DAY_DETAIL(dayId)),

  // Lưu mức và ảnh chụp trạng thái trong một lần ghi, trả ngày đầy đủ
  rateDay: (dayId: string, rating: HealthRatingValue, note?: string) =>
    apiClient.post<ApiResponse<HouseHealthDay>>(ENDPOINTS.HEALTH_DAY_RATING(dayId), { rating, note }),

  // Bỏ qua ngày không ra nhà yến, trả ngày đầy đủ
  skipDay: (dayId: string) => apiClient.post<ApiResponse<HouseHealthDay>>(ENDPOINTS.HEALTH_DAY_SKIP(dayId)),

  // Thay ghi chú của điểm đã chấm; mức không đổi
  updateRatingNote: (dayId: string, note: string) =>
    apiClient.patch<ApiResponse<HouseHealthDay>>(ENDPOINTS.HEALTH_DAY_RATING_NOTE(dayId), { note }),

  // Báo cáo của một nhà, mới nhất trước — danh sách chỉ có phần tóm tắt
  listHouseReports: ({ houseId, kind, page, limit }: HouseReportsParams) =>
    apiClient.get<ApiResponse<HouseHealthReportSummary[]>>(ENDPOINTS.HEALTH_REPORTS, {
      params: { houseId, kind, page, limit },
    }),

  getHouseReport: (reportId: string) =>
    apiClient.get<ApiResponse<HouseHealthReport>>(ENDPOINTS.HEALTH_REPORT_DETAIL(reportId)),

  // Báo cáo theo yêu cầu của 1 nhà, tối đa 31 ngày; cùng khoảng thì backend tính lại bản cũ
  createCustomReport: (houseId: string, from: string, to: string) =>
    apiClient.post<ApiResponse<HouseHealthReport>>(ENDPOINTS.HEALTH_REPORTS, { houseId, from, to }),

  // (Kiểu cũ, deprecated) số liệu một Zone trong khoảng tự chọn — chỉ bằng chứng cảnh báo LOW_RETURN_RATE còn dùng
  preview: (zoneId: string, from: string, to: string) =>
    apiClient.get<ApiResponse<HealthReportPreview>>(ENDPOINTS.HEALTH_REPORT_PREVIEW, { params: { zoneId, from, to } }),

  // Kết luận của chuyên gia (EXPERT-FR-006); chỉ người viết đầu tiên sửa được
  updateConclusion: (reportId: string, text: string) =>
    apiClient.put<ApiResponse<HouseHealthReport>>(ENDPOINTS.HEALTH_REPORT_CONCLUSION(reportId), { text }),
}
