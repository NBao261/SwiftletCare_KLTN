import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { Thresholds } from '@/types'

export interface UpdateThresholdsInput {
  zoneId: string
  thresholds: Thresholds
}

// Lưu ngưỡng của zone (ENV-FR-006): chủ trại và chuyên gia; xong thì tải lại zone của nhà để ô cảm biến đổi theo
export function useUpdateThresholds() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ zoneId, thresholds }: UpdateThresholdsInput) =>
      farmApi.updateThresholds(zoneId, thresholds).then(response => response.data.data),
    onSuccess: zone => queryClient.invalidateQueries({ queryKey: ['zones', zone.house_id] }),
  })
}
