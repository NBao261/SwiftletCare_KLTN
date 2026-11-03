import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, CameraNode, RelayOverrideLog, RelayStates, SensorNode, StreamToken } from '@/types'

// Body đăng ký controller vào một Zone (FARM-FR-003): device_id và mã kích hoạt in trên nhãn
export interface RegisterSensorNodePayload {
  device_id: string
  zone_id: string
  secret_key: string
}

// Body đăng ký camera AI vào một nhà (FARM-FR-004)
export interface RegisterCameraNodePayload {
  device_id: string
  house_id: string
  secret_key: string
}

// API thiết bị: nút cảm biến, camera, relay
export const deviceApi = {
  listSensorNodes: () => apiClient.get<ApiResponse<SensorNode[]>>(ENDPOINTS.SENSOR_NODES),

  listCameraNodes: () => apiClient.get<ApiResponse<CameraNode[]>>(ENDPOINTS.CAMERA_NODES),

  // Mã kích hoạt chỉ đi qua request này, không lưu ở app (FARM-FR-010)
  registerSensorNode: (payload: RegisterSensorNodePayload) =>
    apiClient.post<ApiResponse<SensorNode>>(ENDPOINTS.SENSOR_NODE_REGISTER, payload),

  registerCameraNode: (payload: RegisterCameraNodePayload) =>
    apiClient.post<ApiResponse<CameraNode>>(ENDPOINTS.CAMERA_NODE_REGISTER, payload),

  // Điều khiển tay một relay (ENV-FR-016): controller chuyển MANUAL tới hết durationMs rồi tự về AUTO
  controlRelay: (sensorNodeId: string, relayName: keyof RelayStates, state: boolean, durationMs: number) =>
    apiClient.post<ApiResponse<SensorNode>>(ENDPOINTS.RELAY_CONTROL(sensorNodeId), { relayName, state, durationMs }),

  // Lịch sử can thiệp tay, mới nhất trước (ENV-FR-019)
  listRelayOverrides: (sensorNodeId: string, params?: Record<string, string>) =>
    apiClient.get<ApiResponse<RelayOverrideLog[]>>(ENDPOINTS.RELAY_OVERRIDES(sensorNodeId), { params }),

  // Token 60 giây để mở live stream của một camera (VISION-FR-013)
  getStreamToken: (cameraId: string) =>
    apiClient.get<ApiResponse<StreamToken>>(ENDPOINTS.CAMERA_STREAM_TOKEN(cameraId)),

  // Tắt override sớm, trả mọi relay của thiết bị về tự động (ENV-FR-018)
  clearRelayOverride: (sensorNodeId: string) => apiClient.delete(ENDPOINTS.RELAY_OVERRIDE(sensorNodeId)),
}
