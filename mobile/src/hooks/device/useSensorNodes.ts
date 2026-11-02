import { useQuery } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'

// Bộ điều khiển ESP32 của mọi Farm người dùng được xem (backend đã bỏ thiết bị đã gỡ)
export function useSensorNodes() {
  return useQuery({
    queryKey: ['devices', 'sensor-nodes'],
    queryFn: () => deviceApi.listSensorNodes().then(response => response.data),
  })
}
