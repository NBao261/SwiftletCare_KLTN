import api from '@/lib/axios'
import type { ApiResponse, HealthLevels, HealthRatingState, HealthRatingValue, HouseHealthDay, HouseHealthLevels } from '@/types'

// Phạm vi đọc ngày: một trong houseId, farmId; from/to 'YYYY-MM-DD' giờ VN, tối đa 31 ngày
export interface HealthDayScope {
  houseId?: string
  farmId?: string
  from?: string
  to?: string
}

// MF-11 — trạng thái ngày, chấm điểm độc lập (BR-31), CSV; Farm Owner và Domain Expert
export const healthDayApi = {
  list: (scope: HealthDayScope & { myRatingState?: HealthRatingState }) =>
    api.get<ApiResponse<HouseHealthDay[]>>('/health-reports/days', { params: scope }),
  getOne: (dayId: string) => api.get<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}`),
  rate: (dayId: string, input: { rating: HealthRatingValue; note?: string }) =>
    api.post<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}/rating`, input),
  skip: (dayId: string) => api.post<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}/skip`),
  // Chỉ thêm ghi chú, điểm đã chấm không đổi (SM-18 RATED → RATED)
  addNote: (dayId: string, note: string) =>
    api.patch<ApiResponse<HouseHealthDay>>(`/health-reports/days/${dayId}/rating/note`, { note }),
  // CSV có BOM, ngôn ngữ theo lang; tải qua axios để kèm phiên đăng nhập
  downloadCsv: (scope: HealthDayScope & { lang: 'vi' | 'en' }) =>
    api.get<Blob>('/health-reports/days.csv', { params: scope, responseType: 'blob' }),

  // BR-28 — mức chỉ số của nhà; ghi: Domain Expert, Farm Owner khi farm chưa có chuyên gia (BR-22)
  getLevels: (houseId: string) => api.get<ApiResponse<HouseHealthLevels>>(`/farms/houses/${houseId}/health-levels`),
  updateLevels: (houseId: string, levels: Partial<HealthLevels>) =>
    api.put<ApiResponse<HouseHealthLevels>>(`/farms/houses/${houseId}/health-levels`, levels),
}
