import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/apis/shared/devices.api'
import type { RemovedDevice } from '@/types'

// Dưới tiền tố ['sensor-nodes'] để gỡ hay thay thiết bị làm mới luôn danh sách này
const REMOVED_KEY = ['sensor-nodes', 'removed']

export interface RemovedDeviceRow {
  kind: 'sensor' | 'camera'
  device: RemovedDevice
}

// bộ điều khiển và camera gỡ trong 24 giờ còn khôi phục được (backend lọc cùng điều kiện với restore)
export function useRemovedDevices(enabled: boolean) {
  return useQuery({
    queryKey: REMOVED_KEY,
    enabled,
    queryFn: async (): Promise<RemovedDeviceRow[]> => {
      const [sensors, cameras] = await Promise.all([deviceApi.listRemovedSensorNodes(), deviceApi.listRemovedCameraNodes()])
      return [
        ...sensors.data.data.map(device => ({ kind: 'sensor' as const, device })),
        ...cameras.data.data.map(device => ({ kind: 'camera' as const, device })),
      ]
    },
  })
}

export function useRestoreDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ kind, id, reason }: { kind: 'sensor' | 'camera'; id: string; reason: string }): Promise<void> => {
      if (kind === 'sensor') await deviceApi.restoreSensorNode(id, reason)
      else await deviceApi.restoreCameraNode(id, reason)
    },
    // Cả khi lỗi: 409 nghĩa là dòng đó không còn khôi phục được, danh sách phải bỏ nó đi
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: REMOVED_KEY })
      void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] })
      void queryClient.invalidateQueries({ queryKey: ['camera-nodes'] })
    },
  })
}
