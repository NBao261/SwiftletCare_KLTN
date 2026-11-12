import { buildMockPendingInvitations, mockResponse } from '@/services/mock/account.mock'

// Lời mời đang chờ của farm (AUTH-FR-010, Report 3 §6.4).
// TODO(AUTH-FR-010): backend chưa có route liệt kê lời mời (đã kiểm backend và develop ngày 10/11/2026). Đường đề xuất đã có sẵn
// ở ENDPOINTS.FARM_INVITATIONS — khi route vào api-spec, thay thân hàm bằng:
//   apiClient.get<ApiResponse<Invitation[]>>(ENDPOINTS.FARM_INVITATIONS(farmId), { params: { status: 'PENDING' } })
// rồi bỏ cờ IS_MOCK_API_ENABLED trong usePendingInvitations và members.tsx. Phản hồi không được có token lời mời
export const invitationApi = {
  listPending: (farmId: string) => {
    const invitations = buildMockPendingInvitations(farmId)
    return mockResponse(invitations, { total: invitations.length })
  },
}
