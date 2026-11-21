import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, Invitation } from '@/types'

// Lời mời của farm (AUTH-FR-005, 010, Report 3 §6.4): chỉ Primary Owner xem được (đồng sở hữu 403); lời mời PENDING quá hạn
// backend trả là EXPIRED, không bao giờ trả token
export const invitationApi = {
  listPending: (farmId: string) =>
    apiClient.get<ApiResponse<Invitation[]>>(ENDPOINTS.FARM_INVITATIONS(farmId), { params: { status: 'PENDING' } }),
}
