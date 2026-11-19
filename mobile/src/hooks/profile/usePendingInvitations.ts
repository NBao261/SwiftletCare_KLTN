import { useQuery } from '@tanstack/react-query'
import { invitationApi } from '@/services/api/invitation.api'

// Lời mời còn chờ của farm (AUTH-FR-010): chỉ tải khi người xem là Primary Owner, đồng sở hữu gọi sẽ bị 403
export function usePendingInvitations(farmId: string, isPrimaryOwner: boolean) {
  return useQuery({
    queryKey: ['invitations', farmId],
    queryFn: () => invitationApi.listPending(farmId).then(response => response.data.data),
    enabled: isPrimaryOwner && Boolean(farmId),
  })
}
