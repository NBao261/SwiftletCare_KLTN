import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type DeviceKind, deviceApi } from '@/services/api/device.api'

export interface RestoreDeviceInput {
  kind: DeviceKind
  deviceRecordId: string
  reason: string
}

// Khôi phục thiết bị vừa gỡ, trong 24 giờ (FARM-FR-008): thiết bị hiện lại trong danh sách cùng loại
export function useRestoreDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ kind, deviceRecordId, reason }: RestoreDeviceInput) =>
      deviceApi.restore(kind, deviceRecordId, reason).then(response => response.data.data),
    onSuccess: (_device, input) =>
      queryClient.invalidateQueries({
        queryKey: ['devices', input.kind === 'camera' ? 'camera-nodes' : 'sensor-nodes'],
      }),
  })
}
