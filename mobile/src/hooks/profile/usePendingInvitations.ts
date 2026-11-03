import { useQuery } from '@tanstack/react-query'
import { IS_MOCK_API_ENABLED } from '@/constants/mockApi'
import { invitationApi } from '@/services/api/invitation.api'

// Lời mời còn chờ của farm (AUTH-FR-010) — đang là dữ liệu mẫu, tắt mẫu thì không tải
export function usePendingInvitations(farmId: string) {
  return useQuery({
    queryKey: ['invitations', farmId],
    queryFn: () => invitationApi.listPending(farmId).then(response => response.data.data),
    enabled: IS_MOCK_API_ENABLED && Boolean(farmId),
  })
}
