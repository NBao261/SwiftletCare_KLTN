import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'

// Trả mọi relay của controller về tự động (ENV-FR-018), xong thì tải lại thiết bị và lịch sử override
export function useClearRelayOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sensorNodeId: string) => deviceApi.clearRelayOverride(sensorNodeId).then(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  })
}
