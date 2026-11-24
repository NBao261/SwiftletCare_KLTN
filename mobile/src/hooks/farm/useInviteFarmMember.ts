import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { InviteMemberPayload } from '@/types'

// Mời đồng sở hữu hoặc Domain Expert vào farm (AUTH-FR-005, EXPERT-FR-001) — chỉ Primary Owner.
// Phản hồi chứa token lời mời: không trả ra ngoài hook, không giữ trong cache (gcTime 0), không thử lại
export function useInviteFarmMember(farmId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (payload: InviteMemberPayload) => {
      await farmApi.inviteMember(farmId, payload)
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['farms', farmId] }),
        queryClient.invalidateQueries({ queryKey: ['invitations', farmId] }),
      ]),
  })
}
