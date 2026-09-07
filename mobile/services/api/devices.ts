import api from './client'
import { ENDPOINTS } from '@/constants/api'
import type { SensorNode, CameraNode, ApiResponse } from '@/types'

export const deviceApi = {
  listSensors:   () => api.get<ApiResponse<SensorNode[]>>(ENDPOINTS.SENSOR_NODES),
  listCameras:   () => api.get<ApiResponse<CameraNode[]>>(ENDPOINTS.CAMERA_NODES),
  registerDevice:(data: { device_id: string; zone_id: string }) => api.post(ENDPOINTS.DEVICE_REGISTER, data),
  controlRelay:  (id: string, relayName: string, state: boolean) =>
    api.post(ENDPOINTS.RELAY_CONTROL(id), { relayName, state }),
}
