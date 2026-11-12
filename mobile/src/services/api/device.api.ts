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

// Loại thiết bị của các thao tác chung controller / camera (gỡ, khôi phục)
export type DeviceKind = 'controller' | 'camera'

// Body gỡ thiết bị (FARM-FR-008): force bắt buộc khi thiết bị đang ONLINE, nếu thiếu backend trả 409
export interface DecommissionPayload {
  reason: string
  force?: boolean
}

// Body thay controller hỏng bằng controller mới cùng khu vực (FARM-FR-008): mã trên nhãn của thiết bị mới
export interface ReplaceSensorNodePayload {
  new_device_id: string
  secret_key: string
  reason: string
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

  // Dời controller sang khu vực khác (FARM-FR-007b): backend đổi khu vực rồi gửi lại cấu hình của khu vực mới
  reassignZone: (sensorNodeId: string, newZoneId: string) =>
    apiClient.put<ApiResponse<SensorNode>>(ENDPOINTS.SENSOR_NODE_REASSIGN_ZONE(sensorNodeId), { newZoneId }),

  // Gỡ thiết bị, giữ lịch sử dữ liệu (FARM-FR-008)
  decommission: (kind: DeviceKind, deviceRecordId: string, payload: DecommissionPayload) =>
    apiClient.post<ApiResponse<SensorNode | CameraNode>>(
      kind === 'camera'
        ? ENDPOINTS.CAMERA_NODE_DECOMMISSION(deviceRecordId)
        : ENDPOINTS.SENSOR_NODE_DECOMMISSION(deviceRecordId),
      payload,
    ),

  // Khôi phục thiết bị vừa gỡ, trong 24 giờ (FARM-FR-008)
  restore: (kind: DeviceKind, deviceRecordId: string, reason: string) =>
    apiClient.post<ApiResponse<SensorNode | CameraNode>>(
      kind === 'camera' ? ENDPOINTS.CAMERA_NODE_RESTORE(deviceRecordId) : ENDPOINTS.SENSOR_NODE_RESTORE(deviceRecordId),
      { reason },
    ),

  // Thay controller hỏng (FARM-FR-008); mã kích hoạt chỉ đi qua request này, không lưu ở app (FARM-FR-010)
  replaceSensorNode: (sensorNodeId: string, payload: ReplaceSensorNodePayload) =>
    apiClient.post<ApiResponse<{ oldNode: SensorNode; newNode: SensorNode }>>(
      ENDPOINTS.SENSOR_NODE_REPLACE(sensorNodeId),
      payload,
    ),

  // Điều khiển tay một relay (ENV-FR-016): controller chuyển MANUAL tới hết durationMs rồi tự về AUTO.
  // confirmed: Farm Owner đã đồng ý bật bơm dù khu vực có cảnh báo cảm biến/phun sương; thiếu thì backend trả 409 (ENV-FR-016)
  controlRelay: (
    sensorNodeId: string,
    relayName: keyof RelayStates,
    state: boolean,
    durationMs: number,
    isAlertConfirmed = false,
  ) =>
    apiClient.post<ApiResponse<SensorNode>>(ENDPOINTS.RELAY_CONTROL(sensorNodeId), {
      relayName,
      state,
      durationMs,
      ...(isAlertConfirmed ? { confirmed: true } : {}),
    }),

  // Lịch sử can thiệp tay, mới nhất trước (ENV-FR-019)
  listRelayOverrides: (sensorNodeId: string, params?: Record<string, string>) =>
    apiClient.get<ApiResponse<RelayOverrideLog[]>>(ENDPOINTS.RELAY_OVERRIDES(sensorNodeId), { params }),

  // Token 60 giây để mở live stream của một camera (VISION-FR-013)
  getStreamToken: (cameraId: string) =>
    apiClient.get<ApiResponse<StreamToken>>(ENDPOINTS.CAMERA_STREAM_TOKEN(cameraId)),

  // Tắt override sớm, trả mọi relay của thiết bị về tự động (ENV-FR-018)
  // Có relayName thì chỉ trả relay đó về AUTO (BR-20); không có thì trả mọi relay của controller
  clearRelayOverride: (sensorNodeId: string, relayName?: keyof RelayStates) =>
    apiClient.delete(ENDPOINTS.RELAY_OVERRIDE(sensorNodeId), relayName ? { params: { relayName } } : undefined),
}
