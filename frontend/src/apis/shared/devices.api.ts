import api from '@/lib/axios'
import type { ApiResponse, SensorNode, CameraNode, RelayName, SystemNodeStatus, SpeakerScheduleInput, NodeCommandInput } from '@/types'

/**
 * Flow 1 bước 3–4 — BE xác thực cặp {device_id, secret_key} in trên nhãn thiết bị
 * (kho `provisioned_devices`). Thiếu secret_key → 400.
 */
export interface RegisterDeviceInput { device_id: string; zone_id: string; secret_key: string }

/** FARM-FR-008 — POST /devices/sensor-nodes/:id/replace: node mới cùng Zone, qua đúng luồng secret_key */
export interface ReplaceSensorNodeInput { new_device_id: string; secret_key: string; reason: string }

export const deviceApi = {
  registerSensorNode: (input: RegisterDeviceInput) =>
    api.post<ApiResponse<SensorNode>>('/devices/sensor-nodes/register', input),
  /** FARM-FR-004 — Camera Node (RPi) cùng luồng onboarding với sensor node (Flow 1b) */
  registerCameraNode: (input: RegisterDeviceInput & { rtsp_url?: string }) =>
    api.post<ApiResponse<CameraNode>>('/devices/camera-nodes/register', input),
  listSensorNodes: (zoneId?: string) =>
    api.get<ApiResponse<SensorNode[]>>('/devices/sensor-nodes', { params: zoneId ? { zoneId } : undefined }),
  getSensorNode: (id: string) => api.get<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}`),

  controlRelay: (id: string, relayName: RelayName, state: boolean, durationMs?: number) =>
    api.post<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/relay`, { relayName, state, durationMs }),

  // ENV-FR-018 — trả về AUTO ngay, không đợi hết hạn override
  clearRelayOverride: (id: string) =>
    api.delete<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/relay-override`),

  // ENV-FR-013b — lịch loa ru của thiết bị
  updateSpeakerSchedule: (id: string, input: SpeakerScheduleInput) =>
    api.put<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/speaker-schedule`, input),

  // FARM-FR-007b, Flow 21 Nhánh A — chỉ khi thiết bị đang ONLINE
  reassignZone: (id: string, newZoneId: string) =>
    api.put<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/reassign-zone`, { newZoneId }),

  listCameraNodes: (zoneId?: string) =>
    api.get<ApiResponse<CameraNode[]>>('/devices/camera-nodes', { params: zoneId ? { zoneId } : undefined }),

  // TICKET-FR-008, Flow 15 — xử lý từ xa. RESTART/OTA trả 501 khi firmware chưa hỗ trợ (chỉ PUSH_CONFIG dùng được)
  sendCommand: (id: string, input: NodeCommandInput) =>
    api.post<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/commands`, input),

  // FARM-FR-008 — gỡ thiết bị (giữ lịch sử telemetry), lý do bắt buộc. Gỡ rồi không hoàn tác.
  decommissionSensorNode: (id: string, reason: string) =>
    api.post<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/decommission`, { reason }),
  decommissionCameraNode: (id: string, reason: string) =>
    api.post<ApiResponse<CameraNode>>(`/devices/camera-nodes/${id}/decommission`, { reason }),
  // FARM-FR-008 — BE tạo node mới TRƯỚC rồi mới gỡ node cũ; sai secret_key thì node cũ giữ nguyên
  replaceSensorNode: (id: string, input: ReplaceSensorNodeInput) =>
    api.post<ApiResponse<{ oldNode: SensorNode; newNode: SensorNode }>>(`/devices/sensor-nodes/${id}/replace`, input),

  // OPS-NFR-004 — chỉ Admin
  getSystemStatus: () => api.get<ApiResponse<SystemNodeStatus>>('/devices/system-status'),
}
