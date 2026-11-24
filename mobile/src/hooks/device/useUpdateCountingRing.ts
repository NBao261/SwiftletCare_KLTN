import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'
import type { CountingRing } from '@/types'

export interface UpdateCountingRingInput {
  cameraId: string
  ring: CountingRing
}

// Lưu vòng đếm của camera (VISION-FR-018), xong thì tải lại danh sách camera để thấy vòng mới. Token live stream nằm ở khoá
// riêng (useCameraStreamUrl) nên tải lại camera không làm video mở lại
export function useUpdateCountingRing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cameraId, ring }: UpdateCountingRingInput) =>
      deviceApi.updateCountingRing(cameraId, ring).then(response => response.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices', 'camera-nodes'] }),
  })
}
