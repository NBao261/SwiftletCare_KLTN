import api from '@/lib/axios'
import type { ApiResponse, CameraNode, CountingRing } from '@/types'

// Camera sau khi lưu vòng + cờ đã gửi tới broker (false = nút AI nhận khi kết nối lại)
export interface CountingRingUpdateResult extends CameraNode {
  ring_delivered: boolean
}

// lưu 0–4 vòng, [] = xoá để camera dùng vòng mặc định; khung live để vẽ dùng `hooks/shared/useWhepStream.ts`
export const countingRingApi = {
  update: (cameraId: string, rings: CountingRing[]) =>
    api.put<ApiResponse<CountingRingUpdateResult>>(`/devices/camera-nodes/${cameraId}/counting-ring`, { rings }),
}
