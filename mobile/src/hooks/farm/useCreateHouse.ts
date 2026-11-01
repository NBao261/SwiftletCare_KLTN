import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { CreateHousePayload } from '@/types'

export interface CreateHouseInput {
  farmId: string
  payload: CreateHousePayload
}

// Thêm nhà yến vào farm (FARM-FR-002); xong thì tải lại danh sách nhà của farm
export function useCreateHouse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ farmId, payload }: CreateHouseInput) =>
      farmApi.createHouse(farmId, payload).then(response => response.data.data),
    onSuccess: (_house, { farmId }) => queryClient.invalidateQueries({ queryKey: ['houses', farmId] }),
  })
}
