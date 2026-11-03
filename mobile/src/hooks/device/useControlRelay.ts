import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'
import type { RelayName } from '@/types'

export interface ControlRelayInput {
  sensorNodeId: string
  relay: RelayName
  state: boolean
  durationMs: number
  // Farm Owner đã đồng ý bật bơm dù khu vực đang có cảnh báo chặn (ENV-FR-016)
  isAlertConfirmed?: boolean
}

// Điều khiển tay một relay (ENV-FR-016); xong thì tải lại controller và lịch sử override
// (không tải lại cả nhánh devices để khỏi xin lại token live stream đang mở)
export function useControlRelay() {
  const queryClient = useQueryClient()

  return useMutation({
    // Lệnh điều khiển không tự gửi lại: gửi lại lệnh bật bơm phải do người dùng bấm
    retry: false,
    mutationFn: ({ sensorNodeId, relay, state, durationMs, isAlertConfirmed }: ControlRelayInput) =>
      deviceApi
        .controlRelay(sensorNodeId, relay, state, durationMs, isAlertConfirmed)
        .then(response => response.data.data),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['devices', 'sensor-nodes'] }),
        queryClient.invalidateQueries({ queryKey: ['devices', 'relay-overrides'] }),
      ]),
  })
}
