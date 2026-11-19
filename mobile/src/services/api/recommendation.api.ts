import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, Recommendation, RecommendationStatus } from '@/types'

// Bộ lọc GET /recommendations: cần farmId hoặc houseId
export interface RecommendationListParams {
  farmId: string
  status?: RecommendationStatus
  page?: number
  limit?: number
}

// API khuyến nghị của nhà (EXPERT-FR-017, 018): mọi role trang trại đọc, chỉ Farm Owner chấp nhận hoặc từ chối
export const recommendationApi = {
  // Mới nhất trước, phân trang theo meta
  list: ({ farmId, status, page, limit }: RecommendationListParams) =>
    apiClient.get<ApiResponse<Recommendation[]>>(ENDPOINTS.RECOMMENDATIONS, { params: { farmId, status, page, limit } }),

  // Mở một phiếu công việc hoặc đổi tham số mọi zone của nhà theo luật; khuyến nghị không còn mở thì 409
  accept: (recommendationId: string) =>
    apiClient.post<ApiResponse<Recommendation>>(ENDPOINTS.RECOMMENDATION_ACCEPT(recommendationId)),

  // Từ chối kèm lý do (bắt buộc, tối đa 1000 ký tự)
  reject: (recommendationId: string, reason: string) =>
    apiClient.post<ApiResponse<Recommendation>>(ENDPOINTS.RECOMMENDATION_REJECT(recommendationId), { reason }),
}
