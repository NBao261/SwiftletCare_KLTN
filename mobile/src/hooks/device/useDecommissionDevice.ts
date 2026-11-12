import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type DecommissionPayload, type DeviceKind, deviceApi } from '@/services/api/device.api'

export interface DecommissionDeviceInput extends DecommissionPayload {
  kind: DeviceKind
  deviceRecordId: string
}

// Gỡ thiết bị, giữ lịch sử dữ liệu (FARM-FR-008). Backend đóng cảnh báo còn mở của thiết bị, nên tải lại danh sách cùng loại
// và cảnh báo (chỉ khoá của loại đó, để không xin lại token live stream đang mở)
export function useDecommissionDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ kind, deviceRecordId, ...payload }: DecommissionDeviceInput) =>
      deviceApi.decommission(kind, deviceRecordId, payload).then(response => response.data.data),
    onSuccess: (_device, input) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['devices', input.kind === 'camera' ? 'camera-nodes' : 'sensor-nodes'],
        }),
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      ]),
  })
}
