import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { UpdateFarmPayload } from '@/types'

export interface UpdateFarmInput {
  farmId: string
  payload: UpdateFarmPayload
}

// Sửa tên, địa chỉ, toạ độ farm (FARM-FR-001); xong thì tải lại danh sách và chi tiết farm
export function useUpdateFarm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ farmId, payload }: UpdateFarmInput) =>
      farmApi.update(farmId, payload).then(response => response.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}
