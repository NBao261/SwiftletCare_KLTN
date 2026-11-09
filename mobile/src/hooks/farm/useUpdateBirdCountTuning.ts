import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { BirdCountTuning } from '@/types'

export interface UpdateBirdCountTuningInput {
  houseId: string
  tuning: BirdCountTuning
}

// Lưu mức giảm tỷ lệ về tổ của nhà (EXPERT-FR-008): chỉ chuyên gia; xong thì tải lại danh sách nhà của farm
export function useUpdateBirdCountTuning() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, tuning }: UpdateBirdCountTuningInput) =>
      farmApi.updateBirdCountTuning(houseId, tuning).then(response => response.data.data),
    onSuccess: house => queryClient.invalidateQueries({ queryKey: ['houses', house.farm_id] }),
  })
}
