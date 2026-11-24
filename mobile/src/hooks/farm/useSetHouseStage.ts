import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { HouseStage } from '@/types'

export interface SetHouseStageInput {
  houseId: string
  stage: HouseStage
}

// Đổi giai đoạn nhà (FARM-FR-014): chủ trại, chuyên gia; xong thì tải lại danh sách nhà của farm và trạng thái ngày (BR-46)
export function useSetHouseStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, stage }: SetHouseStageInput) =>
      farmApi.setHouseStage(houseId, stage).then(response => response.data.data),
    onSuccess: house =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['houses', house.farm_id] }),
        queryClient.invalidateQueries({ queryKey: ['farm-overview', house.farm_id] }),
      ]),
  })
}
