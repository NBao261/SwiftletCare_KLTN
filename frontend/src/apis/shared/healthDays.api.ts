import api from '@/lib/axios'
import type {
  ApiResponse, HealthLevels, HealthRatingState, HealthRatingValue, HealthReportKind, HouseHealthDay, HouseHealthLevels,
  HouseHealthReport, HouseHealthReportSummary,
} from '@/types'

// Phạm vi đọc ngày: một trong houseId, farmId; from/to 'YYYY-MM-DD' giờ VN, tối đa 31 ngày
export interface HealthDayScope {
  houseId?: string
  farmId?: string
  from?: string
  to?: string
}

// MF-06 — trạng thái ngày, đánh giá độc lập (BR-31), CSV, mức chỉ số, báo cáo theo nhà
export const healthDayApi = {
  list: (scope: HealthDayScope & { myRatingState?: HealthRatingState }) =>
    api.get<ApiResponse<HouseHealthDay[]>>('/health-reports/days', { params: scope }),
  getOne: (dayId: string) => api.get<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}`),
  rate: (dayId: string, input: { rating: HealthRatingValue; note?: string }) =>
    api.post<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}/rating`, input),
  skip: (dayId: string) => api.post<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}/skip`),
  // Chỉ thêm ghi chú, mức đã đánh giá không đổi (SM-18 RATED → RATED)
  addNote: (dayId: string, note: string) =>
    api.patch<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}/rating/note`, { note }),
  // CSV có BOM, ngôn ngữ theo lang; tải qua axios để kèm phiên đăng nhập
  downloadCsv: (scope: HealthDayScope & { lang: 'vi' | 'en' }) =>
    api.get<Blob>('/health-reports/days.csv', { params: scope, responseType: 'blob' }),

  // BR-28 — mức chỉ số của nhà; ghi: Domain Expert, Farm Owner khi farm chưa có chuyên gia (BR-22)
  getLevels: (houseId: string) => api.get<ApiResponse<HouseHealthLevels>>(`/farms/houses/${houseId}/health-levels`),
  updateLevels: (houseId: string, levels: Partial<HealthLevels>) =>
    api.put<ApiResponse<HouseHealthLevels>>(`/farms/houses/${houseId}/health-levels`, levels),

  // EXPERT-FR-005 — báo cáo theo nhà (ngày/tuần/tháng theo lịch BR-33, CUSTOM theo yêu cầu tối đa 31 ngày)
  listReports: (scope: { houseId?: string; farmId?: string; kind?: HealthReportKind; page?: number; limit?: number }) =>
    api.get<ApiResponse<HouseHealthReportSummary[]>>('/health-reports', { params: scope }),
  getReport: (reportId: string) => api.get<ApiResponse<HouseHealthReport>>(`/health-reports/${reportId}`),
  // Cùng nhà, cùng khoảng đã có thì backend tính lại và trả bản cũ (200)
  createReport: (input: { houseId: string; from: string; to: string }) =>
    api.post<ApiResponse<HouseHealthReport>>('/health-reports', input),
  // EXPERT-FR-006 — chỉ Domain Expert; người viết sửa được kết luận của mình, chuyên gia khác 403
  setConclusion: (reportId: string, text: string) =>
    api.put<ApiResponse<HouseHealthReport>>(`/health-reports/${reportId}/conclusion`, { text }),
}
