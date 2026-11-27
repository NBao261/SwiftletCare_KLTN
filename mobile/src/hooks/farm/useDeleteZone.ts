import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import { refreshFarmStructure } from '@/utils/farmStructure.utils'

// Xoá mềm khu vực (FARM-FR-002): chỉ Farm Owner; còn bộ điều khiển đang dùng thì 409 HAS_ACTIVE_DEVICES
export function useDeleteZone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (zoneId: string) => farmApi.deleteZone(zoneId),
    onSuccess: () => refreshFarmStructure(queryClient, 'delete'),
  })
}
