import api from '@/lib/axios';
import type { ApiResponse, CameraNode, CameraSourceInput, CameraSourceView } from '@/types';

// Camera cửa thu chim của 1 nhà yến (: camera thuộc House); token xem trực tiếp ở `apis/shared/stream.api.ts`
export const cameraApi = {
  listHouseCameras: (houseId: string) =>
    api.get<ApiResponse<CameraNode[]>>('/devices/camera-nodes', { params: { houseId } }),
  // Địa chỉ camera IP của nút AI (chỉ Farm Owner); mật khẩu không bao giờ trả về
  getSource: (cameraId: string) => api.get<ApiResponse<CameraSourceView>>(`/devices/camera-nodes/${cameraId}/source`),
  updateSource: (cameraId: string, input: CameraSourceInput) =>
    api.put<ApiResponse<CameraSourceView>>(`/devices/camera-nodes/${cameraId}/source`, input),
};
