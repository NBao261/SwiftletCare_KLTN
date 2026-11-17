import api from '@/lib/axios'
import type { ApiResponse, CameraNode, CountingRing } from '@/types'

// Camera sau khi lưu vòng + cờ đã gửi tới broker (false = nút AI nhận khi kết nối lại)
export interface CountingRingUpdateResult extends CameraNode {
  ring_delivered: boolean
}

// Token mở WebRTC (WHEP) xem luồng của camera để vẽ vòng trên khung live
export interface CameraStreamToken {
  path: string
  token: string
  expires_in: number
}

// VISION-FR-018 — lưu vòng đếm; VISION-FR-013 — token xem luồng để vẽ trên khung live
export const countingRingApi = {
  update: (cameraId: string, ring: CountingRing) =>
    api.put<ApiResponse<CountingRingUpdateResult>>(`/devices/camera-nodes/${cameraId}/counting-ring`, ring),

  streamToken: (cameraId: string) =>
    api.get<ApiResponse<CameraStreamToken>>(`/devices/camera-nodes/${cameraId}/stream-token`),
}
