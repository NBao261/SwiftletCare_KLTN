import api from '@/lib/axios';
import type { ApiResponse, CameraNode } from '@/types';

// Camera cửa thu chim của 1 nhà yến (SRS v2.1.8: camera thuộc House); token xem trực tiếp ở `apis/shared/stream.api.ts`
export const cameraApi = {
  listHouseCameras: (houseId: string) =>
    api.get<ApiResponse<CameraNode[]>>('/devices/camera-nodes', { params: { houseId } }),
};
