import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import { refreshFarmStructure } from '@/utils/farmStructure.utils'

// Xoá mềm nhà cùng các khu vực (FARM-FR-002): chỉ Farm Owner; còn thiết bị đang dùng thì 409 HAS_ACTIVE_DEVICES
export function useDeleteHouse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (houseId: string) => farmApi.deleteHouse(houseId),
    onSuccess: () => refreshFarmStructure(queryClient, 'delete'),
  })
}
