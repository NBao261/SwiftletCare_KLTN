import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { UpdateHousePayload } from '@/types'
import { refreshFarmStructure } from '@/utils/farmStructure.utils'

export interface UpdateHouseInput {
  houseId: string
  payload: UpdateHousePayload
}

// Sửa tên, số tầng, mô tả của nhà (FARM-FR-002): chỉ Farm Owner; xong thì tải lại danh sách nhà
export function useUpdateHouse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, payload }: UpdateHouseInput) =>
      farmApi.updateHouse(houseId, payload).then(response => response.data.data),
    onSuccess: () => refreshFarmStructure(queryClient, 'rename'),
  })
}
