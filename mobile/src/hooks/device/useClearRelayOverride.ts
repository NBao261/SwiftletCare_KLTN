import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'

// Trả mọi relay của controller về tự động (ENV-FR-018), xong thì tải lại controller và lịch sử override
// (không tải lại cả nhánh devices để khỏi xin lại token live stream đang mở)
export function useClearRelayOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sensorNodeId: string) => deviceApi.clearRelayOverride(sensorNodeId).then(() => undefined),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['devices', 'sensor-nodes'] }),
        queryClient.invalidateQueries({ queryKey: ['devices', 'relay-overrides'] }),
      ]),
  })
}
