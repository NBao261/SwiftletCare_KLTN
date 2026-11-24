import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Đưa 5 tham số phát hiện của zone về mặc định của backend (EXPERT-FR-008); xong thì tải lại zone của nhà
export function useResetDetectionTuning() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (zoneId: string) => farmApi.resetDetectionTuning(zoneId).then(response => response.data.data),
    onSuccess: zone => queryClient.invalidateQueries({ queryKey: ['zones', zone.house_id] }),
  })
}
