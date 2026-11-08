import { MOCK_EXPERT_DECISIONS, MOCK_REVIEW_ITEMS, mockResponse } from '@/services/mock/account.mock'

// Lịch sử quyết định của chuyên gia (EXPERT-FR-009) và mục chờ duyệt của Farm Owner (EXPERT-FR-010/011).
// TODO(G-04, EXPERT-FR-009/010/011): backend chưa có route — khi có trong api-spec, thêm vào ENDPOINTS và thay thân hàm
// bằng apiClient.get<ApiResponse<…>>(ENDPOINTS.…, { params: { farmId } }); hook và màn không phải đổi
export const expertActivityApi = {
  listDecisions: (_farmId: string) => mockResponse(MOCK_EXPERT_DECISIONS, { total: MOCK_EXPERT_DECISIONS.length }),

  listMyReviewItems: (_farmId: string) => mockResponse(MOCK_REVIEW_ITEMS, { total: MOCK_REVIEW_ITEMS.length }),
}
