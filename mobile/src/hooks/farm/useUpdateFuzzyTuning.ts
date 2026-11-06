import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { FuzzyTuning } from '@/types'

export interface UpdateFuzzyTuningInput {
  zoneId: string
  tuning: FuzzyTuning
}

// Lưu hệ số bộ điều khiển mờ của zone (ENV-FR-021): backend gửi xuống controller qua config/update
export function useUpdateFuzzyTuning() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ zoneId, tuning }: UpdateFuzzyTuningInput) =>
      farmApi.updateFuzzyTuning(zoneId, tuning).then(response => response.data.data),
    onSuccess: zone => queryClient.invalidateQueries({ queryKey: ['zones', zone.house_id] }),
  })
}
