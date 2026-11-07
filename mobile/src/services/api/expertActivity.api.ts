import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, CoefficientProposal, ExpertActivityEntry, ParameterReview } from '@/types'

// Tham số trang chung của các danh sách hoạt động chuyên gia (api-spec Page, Limit)
export interface ExpertActivityPageParams {
  farmId: string
  page?: number
  limit?: number
  status?: string
}

function toQuery({ farmId, page, limit, status }: ExpertActivityPageParams): Record<string, string> {
  return {
    farmId,
    ...(page ? { page: String(page) } : {}),
    ...(limit ? { limit: String(limit) } : {}),
    ...(status ? { status } : {}),
  }
}

// Hoạt động chuyên gia trên một farm (EXPERT-FR-009/010/011)
export const expertActivityApi = {
  // Lịch sử quyết định, mới nhất trước
  listActivity: (params: ExpertActivityPageParams) =>
    apiClient.get<ApiResponse<ExpertActivityEntry[]>>(ENDPOINTS.EXPERT_ACTIVITY, { params: toQuery(params) }),

  // Thay đổi ngưỡng, hệ số của Farm Owner chờ chuyên gia (farm có chuyên gia)
  listReviews: (params: ExpertActivityPageParams) =>
    apiClient.get<ApiResponse<ParameterReview[]>>(ENDPOINTS.EXPERT_REVIEWS, { params: toQuery(params) }),

  // Gợi ý hệ số Farm Owner đã gửi chuyên gia
  listProposals: (params: ExpertActivityPageParams) =>
    apiClient.get<ApiResponse<CoefficientProposal[]>>(ENDPOINTS.EXPERT_PROPOSALS, { params: toQuery(params) }),

  // Farm Owner gửi gợi ý hiện tại của zone cho chuyên gia; server tự tính gợi ý. Farm chưa có chuyên gia hoặc không có
  // gợi ý thì 409
  submitProposal: (zoneId: string) =>
    apiClient.post<ApiResponse<CoefficientProposal>>(ENDPOINTS.EXPERT_PROPOSALS, { zoneId }),
}
