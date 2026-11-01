import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { DetectionTuning } from '@/types'

export interface UpdateDetectionTuningInput {
  zoneId: string
  tuning: DetectionTuning
}

// Lưu tham số phát hiện của zone (EXPERT-FR-008): chỉ chuyên gia
export function useUpdateDetectionTuning() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ zoneId, tuning }: UpdateDetectionTuningInput) =>
      farmApi.updateDetectionTuning(zoneId, tuning).then(response => response.data.data),
    onSuccess: zone => queryClient.invalidateQueries({ queryKey: ['zones', zone.house_id] }),
  })
}
