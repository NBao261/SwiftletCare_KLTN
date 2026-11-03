import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Gỡ một thành viên khỏi farm — chỉ Primary Owner, không gỡ được Primary Owner (AUTH-FR-005)
export function useRemoveFarmMember(farmId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    retry: false,
    mutationFn: (userId: string) => farmApi.removeMember(farmId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}
