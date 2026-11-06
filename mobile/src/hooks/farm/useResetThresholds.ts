import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Đặt ngưỡng của zone về mặc định hệ thống (ENV-FR-020); xong thì tải lại zone của nhà
export function useResetThresholds() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (zoneId: string) => farmApi.resetThresholds(zoneId).then(response => response.data.data),
    onSuccess: zone => queryClient.invalidateQueries({ queryKey: ['zones', zone.house_id] }),
  })
}
