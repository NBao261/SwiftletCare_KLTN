import { buildMockPendingInvitations, mockResponse } from '@/services/mock/account.mock'

// Lời mời đang chờ của farm (AUTH-FR-010, Report 3 §6.4).
// TODO(AUTH-FR-010): backend chưa có route liệt kê lời mời — khi có trong api-spec, thêm vào ENDPOINTS và thay thân hàm
// bằng apiClient.get<ApiResponse<Invitation[]>>(…); phản hồi không được có token lời mời
export const invitationApi = {
  listPending: (farmId: string) => {
    const invitations = buildMockPendingInvitations(farmId)
    return mockResponse(invitations, { total: invitations.length })
  },
}
