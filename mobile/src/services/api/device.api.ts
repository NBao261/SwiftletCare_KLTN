import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, CameraNode, RelayStates, SensorNode } from '@/types'

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
}
