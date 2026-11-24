import api from '@/lib/axios'
import type { ApiResponse } from '@/types'

// Token xem live stream: video không qua backend, trình duyệt mở WebRTC (WHEP) tới MediaMTX ở đường `path`
export interface StreamToken {
  path: string
  token: string
  expires_in: number
}

// token 60 giây xem luồng của 1 camera; Farm Owner (live) và Domain Expert (vẽ vòng đếm) cùng dùng
export const streamApi = {
  token: (cameraNodeId: string) =>
    api.get<ApiResponse<StreamToken>>(`/devices/camera-nodes/${cameraNodeId}/stream-token`),
}
