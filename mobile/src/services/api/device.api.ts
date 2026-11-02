import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, CameraNode, RelayOverrideLog, RelayStates, SensorNode, StreamToken } from '@/types'

export interface RegisterDevicePayload {
  device_id: string
  zone_id: string
}

// API thiết bị: nút cảm biến, camera, relay
export const deviceApi = {
  listSensorNodes: () => apiClient.get<ApiResponse<SensorNode[]>>(ENDPOINTS.SENSOR_NODES),

  listCameraNodes: () => apiClient.get<ApiResponse<CameraNode[]>>(ENDPOINTS.CAMERA_NODES),

  registerDevice: (payload: RegisterDevicePayload) => apiClient.post(ENDPOINTS.DEVICE_REGISTER, payload),

  controlRelay: (sensorNodeId: string, relayName: keyof RelayStates, state: boolean) =>
    apiClient.post(ENDPOINTS.RELAY_CONTROL(sensorNodeId), { relayName, state }),

  // Lịch sử can thiệp tay, mới nhất trước (ENV-FR-019)
  listRelayOverrides: (sensorNodeId: string, params?: Record<string, string>) =>
    apiClient.get<ApiResponse<RelayOverrideLog[]>>(ENDPOINTS.RELAY_OVERRIDES(sensorNodeId), { params }),

  // Token 60 giây để mở live stream của một camera (VISION-FR-013)
  getStreamToken: (cameraId: string) =>
    apiClient.get<ApiResponse<StreamToken>>(ENDPOINTS.CAMERA_STREAM_TOKEN(cameraId)),

  // Tắt override sớm, trả mọi relay của thiết bị về tự động (ENV-FR-018)
  clearRelayOverride: (sensorNodeId: string) => apiClient.delete(ENDPOINTS.RELAY_OVERRIDE(sensorNodeId)),
}
