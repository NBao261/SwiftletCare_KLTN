import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Xoá mềm farm (FARM-FR-001): chỉ chủ chính, backend trả 403 với người khác; xong thì tải lại danh sách farm
export function useDeleteFarm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (farmId: string) => farmApi.remove(farmId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}
