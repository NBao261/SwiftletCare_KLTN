import api from '@/lib/axios';
import type { ApiResponse, CameraNode } from '@/types';

// Token xem live stream: video không qua backend, trình duyệt mở WebRTC (WHEP) tới MediaMTX ở đường `path`
export interface StreamToken {
  path: string;
  token: string;
  expires_in: number;
}

// VISION-FR-013 — camera cửa thu chim của 1 nhà yến (SRS v2.1.8: camera thuộc House) và token xem trực tiếp
export const cameraApi = {
  listHouseCameras: (houseId: string) =>
    api.get<ApiResponse<CameraNode[]>>('/devices/camera-nodes', { params: { houseId } }),
  streamToken: (cameraNodeId: string) =>
    api.get<ApiResponse<StreamToken>>(`/devices/camera-nodes/${cameraNodeId}/stream-token`),
};
