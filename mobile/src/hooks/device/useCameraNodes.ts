import { useQuery } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'

// Camera đếm chim của mọi nhà yến người dùng được xem (backend đã bỏ thiết bị đã gỡ)
export function useCameraNodes() {
  return useQuery({
    queryKey: ['devices', 'camera-nodes'],
    queryFn: () => deviceApi.listCameraNodes().then(response => response.data),
  })
}
