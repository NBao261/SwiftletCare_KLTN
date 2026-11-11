import { useMutation, useQueryClient } from '@tanstack/react-query'
import { expertActivityApi } from '@/services/api/expertActivity.api'

// Farm Owner gửi gợi ý hệ số của zone cho chuyên gia duyệt (EXPERT-FR-011, POST /expert-activity/proposals)
export function useSubmitProposal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (zoneId: string) => expertActivityApi.submitProposal(zoneId).then(response => response.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expert-activity'] }),
  })
}
