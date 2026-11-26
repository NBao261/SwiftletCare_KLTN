import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { UpdateZonePayload } from '@/types'
import { refreshFarmStructure } from '@/utils/farmStructure.utils'

export interface UpdateZoneInput {
  zoneId: string
  payload: UpdateZonePayload
}

// Sửa tên, tầng của khu vực (FARM-FR-002): chỉ Farm Owner; xong thì tải lại danh sách khu vực
export function useUpdateZone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ zoneId, payload }: UpdateZoneInput) =>
      farmApi.updateZone(zoneId, payload).then(response => response.data.data),
    onSuccess: () => refreshFarmStructure(queryClient, 'rename'),
  })
}
