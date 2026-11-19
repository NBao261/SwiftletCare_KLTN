import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'
import { readApiError } from '@/utils/apiError.utils'

// Khởi động lại một controller từ xa (FARM-FR-013): Farm Owner và kỹ thuật viên nhà được giao. Thiết bị vừa mất kết nối (409)
// thì tải lại danh sách controller để màn thấy trạng thái mới
export function useRestartController() {
  const queryClient = useQueryClient()
  const refreshControllers = () => queryClient.invalidateQueries({ queryKey: ['devices', 'sensor-nodes'] })

  return useMutation({
    mutationFn: (sensorNodeId: string) => deviceApi.restartController(sensorNodeId).then(response => response.data.data),
    onError: error => {
      if (readApiError(error).status === 409) void refreshControllers()
    },
  })
}
