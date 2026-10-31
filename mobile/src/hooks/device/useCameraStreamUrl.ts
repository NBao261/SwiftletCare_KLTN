import { useQuery } from '@tanstack/react-query'
import { STREAM_BASE_URL } from '@/constants/apiEndpoints'
import { deviceApi } from '@/services/api/device.api'
import { buildHlsUrl } from '@/utils/camera.utils'

// Địa chỉ HLS để mở live stream của một camera: xin token 60 giây mỗi lần mở (VISION-FR-013)
export function useCameraStreamUrl(cameraId: string | null) {
  return useQuery({
    queryKey: ['devices', 'stream-token', cameraId],
    queryFn: () =>
      deviceApi
        .getStreamToken(cameraId as string)
        .then(response => buildHlsUrl(STREAM_BASE_URL, response.data.data.path, response.data.data.token)),
    enabled: Boolean(cameraId),
    // Token chỉ dùng được lúc mở kết nối: mở lại thì luôn xin token mới, không giữ trong cache
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
}
