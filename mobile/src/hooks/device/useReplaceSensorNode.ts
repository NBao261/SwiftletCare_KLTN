import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi, type ReplaceSensorNodePayload } from '@/services/api/device.api'

export interface ReplaceSensorNodeInput extends ReplaceSensorNodePayload {
  sensorNodeId: string
}

// Thay controller hỏng bằng controller mới cùng khu vực (FARM-FR-008): backend đăng ký thiết bị mới (PENDING) rồi gỡ thiết bị cũ.
// gcTime 0: bỏ biến của mutation (có mã kích hoạt) khỏi bộ nhớ ngay khi màn đóng, như useRegisterSensorNode
export function useReplaceSensorNode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sensorNodeId, ...payload }: ReplaceSensorNodeInput) =>
      deviceApi.replaceSensorNode(sensorNodeId, payload).then(response => response.data.data),
    gcTime: 0,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['devices', 'sensor-nodes'] }),
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      ]),
  })
}
