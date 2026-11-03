import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'
import type { RelayName } from '@/types'

export interface ControlRelayInput {
  sensorNodeId: string
  relay: RelayName
  state: boolean
  durationMs: number
}

// Điều khiển tay một relay (ENV-FR-016); xong thì tải lại controller và lịch sử override
// (không tải lại cả nhánh devices để khỏi xin lại token live stream đang mở)
export function useControlRelay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sensorNodeId, relay, state, durationMs }: ControlRelayInput) =>
      deviceApi.controlRelay(sensorNodeId, relay, state, durationMs).then(response => response.data.data),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['devices', 'sensor-nodes'] }),
        queryClient.invalidateQueries({ queryKey: ['devices', 'relay-overrides'] }),
      ]),
  })
}
