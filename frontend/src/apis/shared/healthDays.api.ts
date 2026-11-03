import type { AxiosResponse } from 'axios'

import * as preview from '@/data/healthPreview.data'
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

// /health?preview: trả dữ liệu giả (src/data/healthPreview.data.ts) để xem giao diện, không gọi backend
const fake = <T>(data: T): Promise<AxiosResponse<T>> =>
  new Promise(resolve => setTimeout(() => resolve({ data } as AxiosResponse<T>), 300))
const fakeApi = <T>(data: T) => fake<ApiResponse<T>>({ success: true, data })

// MF-11 — trạng thái ngày, chấm điểm độc lập (BR-31), CSV; Farm Owner và Domain Expert
export const healthDayApi = {
  list: (scope: HealthDayScope & { myRatingState?: HealthRatingState }) => preview.isHealthPreview()
    ? fakeApi(preview.previewListDays(scope))
    : api.get<ApiResponse<HouseHealthDay[]>>('/health-reports/days', { params: scope }),
  getOne: (dayId: string) => preview.isHealthPreview()
    ? fakeApi(preview.previewGetDay(dayId))
    : api.get<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}`),
  rate: (dayId: string, input: { rating: HealthRatingValue; note?: string }) => preview.isHealthPreview()
    ? fakeApi(preview.previewRate(dayId, input.rating, input.note))
    : api.post<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}/rating`, input),
  skip: (dayId: string) => preview.isHealthPreview()
    ? fakeApi(preview.previewSkip(dayId))
    : api.post<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}/skip`),
  // Chỉ thêm ghi chú, điểm đã chấm không đổi (SM-18 RATED → RATED)
  addNote: (dayId: string, note: string) => preview.isHealthPreview()
    ? fakeApi(preview.previewAddNote(dayId, note))
    : api.patch<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}/rating/note`, { note }),
  // CSV có BOM, ngôn ngữ theo lang; tải qua axios để kèm phiên đăng nhập
  downloadCsv: (scope: HealthDayScope & { lang: 'vi' | 'en' }) => preview.isHealthPreview()
    ? fake(preview.previewCsv(scope))
    : api.get<Blob>('/health-reports/days.csv', { params: scope, responseType: 'blob' }),

  // BR-28 — mức chỉ số của nhà; ghi: Domain Expert, Farm Owner khi farm chưa có chuyên gia (BR-22)
  getLevels: (houseId: string) => preview.isHealthPreview()
    ? fakeApi(preview.previewLevels(houseId))
    : api.get<ApiResponse<HouseHealthLevels>>(`/farms/houses/${houseId}/health-levels`),
  updateLevels: (houseId: string, levels: Partial<HealthLevels>) => preview.isHealthPreview()
    ? fakeApi(preview.previewUpdateLevels(houseId, levels))
    : api.put<ApiResponse<HouseHealthLevels>>(`/farms/houses/${houseId}/health-levels`, levels),

  // EXPERT-FR-005 — báo cáo theo nhà (ngày/tuần/tháng theo lịch BR-33, CUSTOM theo yêu cầu tối đa 31 ngày)
  listReports: (scope: { houseId?: string; farmId?: string; kind?: HealthReportKind; page?: number; limit?: number }) => preview.isHealthPreview()
    ? fakeApi(preview.previewListReports(scope))
    : api.get<ApiResponse<HouseHealthReportSummary[]>>('/health-reports', { params: scope }),
  getReport: (reportId: string) => preview.isHealthPreview()
    ? fakeApi(preview.previewGetReport(reportId))
    : api.get<ApiResponse<HouseHealthReport>>(`/health-reports/${reportId}`),
  // Cùng nhà, cùng khoảng đã có thì backend tính lại và trả bản cũ (200)
  createReport: (input: { houseId: string; from: string; to: string }) => preview.isHealthPreview()
    ? fakeApi(preview.previewCreateReport(input))
    : api.post<ApiResponse<HouseHealthReport>>('/health-reports', input),
}
