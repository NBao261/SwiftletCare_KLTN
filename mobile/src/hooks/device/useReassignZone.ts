import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'

export interface ReassignZoneInput {
  sensorNodeId: string
  newZoneId: string
}

// Dời controller sang khu vực khác (FARM-FR-007b). Backend đóng cảnh báo còn mở ở khu vực cũ và đưa trạng thái đồng bộ cấu hình
// về PENDING, nên tải lại danh sách controller và cảnh báo
export function useReassignZone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sensorNodeId, newZoneId }: ReassignZoneInput) =>
      deviceApi.reassignZone(sensorNodeId, newZoneId).then(response => response.data.data),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['devices', 'sensor-nodes'] }),
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      ]),
  })
}
