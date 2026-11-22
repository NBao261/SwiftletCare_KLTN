import api from '@/lib/axios'
import type { ApiResponse, CameraNode, CountingRing } from '@/types'

// Camera sau khi lưu vòng + cờ đã gửi tới broker (false = nút AI nhận khi kết nối lại)
export interface CountingRingUpdateResult extends CameraNode {
  ring_delivered: boolean
}

// lưu vòng đếm; khung live để vẽ dùng `hooks/shared/useWhepStream.ts`
export const countingRingApi = {
  update: (cameraId: string, ring: CountingRing) =>
    api.put<ApiResponse<CountingRingUpdateResult>>(`/devices/camera-nodes/${cameraId}/counting-ring`, ring),
}
