import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'
import type { RelayName } from '@/types'

export interface ClearRelayOverrideInput {
  sensorNodeId: string
  // Có thì chỉ relay này về AUTO; không có thì mọi relay của controller
  relayName?: RelayName
}

// Trả một relay hoặc mọi relay của controller về tự động (ENV-FR-018, BR-20), xong thì tải lại controller và lịch sử override
// (không tải lại cả nhánh devices để khỏi xin lại token live stream đang mở)
export function useClearRelayOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sensorNodeId, relayName }: ClearRelayOverrideInput) =>
      deviceApi.clearRelayOverride(sensorNodeId, relayName).then(() => undefined),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['devices', 'sensor-nodes'] }),
        queryClient.invalidateQueries({ queryKey: ['devices', 'relay-overrides'] }),
      ]),
  })
}
