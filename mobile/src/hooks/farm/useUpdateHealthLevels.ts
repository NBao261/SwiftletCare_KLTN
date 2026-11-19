import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { HealthLevels } from '@/types'

export interface UpdateHealthLevelsInput {
  houseId: string
  levels: HealthLevels
}

// Lưu mức chỉ số sức khỏe của nhà (EXPERT-FR-022, BR-28); trạng thái ngày tính lại theo mức mới nên tải lại ngày và ngày lệch
export function useUpdateHealthLevels() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, levels }: UpdateHealthLevelsInput) =>
      farmApi.updateHealthLevels(houseId, levels).then(response => response.data.data),
    onSuccess: view => {
      queryClient.setQueryData(['health-levels', view.house_id], view)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['health-days'] }),
        queryClient.invalidateQueries({ queryKey: ['health-disagreements'] }),
      ])
    },
  })
}
