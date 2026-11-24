import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Đưa mức giảm tỷ lệ về tổ của nhà về mặc định 20 % (EXPERT-FR-008); xong thì tải lại danh sách nhà của farm
export function useResetBirdCountTuning() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (houseId: string) => farmApi.resetBirdCountTuning(houseId).then(response => response.data.data),
    onSuccess: house => queryClient.invalidateQueries({ queryKey: ['houses', house.farm_id] }),
  })
}
