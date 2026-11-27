import { useQuery } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'

// Địa chỉ camera IP đã lưu và tình trạng camera của một camera đếm chim (FARM-FR-004b); chỉ tải khi sheet đang mở
export function useCameraSource(cameraId: string | null) {
  return useQuery({
    queryKey: ['devices', 'camera-source', cameraId],
    queryFn: () => deviceApi.getCameraSource(cameraId as string).then(response => response.data.data),
    enabled: Boolean(cameraId),
  })
}
