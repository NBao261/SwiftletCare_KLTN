import api from '@/lib/axios'
import type { ApiResponse, SensorNode, CameraNode, RelayName, RelayOverrideLog, SystemNodeStatus, SpeakerScheduleInput, NodeCommandInput, RemovedDevice } from '@/types'

// BE xác thực cặp {device_id, secret_key} in trên nhãn thiết bị (kho `provisioned_devices`). Thiếu secret_key → 400.
export interface RegisterDeviceInput { device_id: string; zone_id: string; secret_key: string }
// camera gắn nhà yến (house_id), không gắn Zone
export interface RegisterCameraInput { device_id: string; house_id: string; secret_key: string; rtsp_url?: string }

// POST /devices/sensor-nodes/:id/replace: node mới cùng Zone, qua đúng luồng secret_key
export interface ReplaceSensorNodeInput { new_device_id: string; secret_key: string; reason: string }

export const deviceApi = {
  registerSensorNode: (input: RegisterDeviceInput) =>
    api.post<ApiResponse<SensorNode>>('/devices/sensor-nodes/register', input),
  // Camera Node (camera IP, AI node đọc RTSP) cùng luồng onboarding với sensor node
  registerCameraNode: (input: RegisterCameraInput) =>
    api.post<ApiResponse<CameraNode>>('/devices/camera-nodes/register', input),
  listSensorNodes: (zoneId?: string) =>
    api.get<ApiResponse<SensorNode[]>>('/devices/sensor-nodes', { params: zoneId ? { zoneId } : undefined }),
  getSensorNode: (id: string) => api.get<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}`),

  // `confirmed`: Farm Owner xác nhận bật bơm dù Zone đang có cảnh báo cảm biến/phun sương (thiếu thì 409)
  controlRelay: (id: string, relayName: RelayName, state: boolean, durationMs?: number, confirmed?: boolean) =>
    api.post<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/relay`, { relayName, state, durationMs, ...(confirmed && { confirmed: true }) }),

  // trả về AUTO ngay, không đợi hết hạn override; có relayName thì chỉ huỷ relay đó
  clearRelayOverride: (id: string, relayName?: RelayName) =>
    api.delete<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/relay-override`, { params: relayName ? { relayName } : undefined }),

  // lịch sử can thiệp tay của thiết bị, mới nhất trước
  listRelayOverrides: (id: string, params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<RelayOverrideLog[]>>(`/devices/sensor-nodes/${id}/relay-overrides`, { params }),

  // lịch loa ru của thiết bị
  updateSpeakerSchedule: (id: string, input: SpeakerScheduleInput) =>
    api.put<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/speaker-schedule`, input),

  // dời bộ điều khiển sang Zone khác; offline thì dời khi kết nối lại
  reassignZone: (id: string, newZoneId: string) =>
    api.put<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/reassign-zone`, { newZoneId }),

  // camera gắn nhà yến; không truyền houseId thì mọi nhà user được xem
  listCameraNodes: (houseId?: string) =>
    api.get<ApiResponse<CameraNode[]>>('/devices/camera-nodes', { params: houseId ? { houseId } : undefined }),

  // xử lý từ xa. RESTART/OTA trả 501 khi thiết bị chạy firmware trước 1.4.0 (chỉ PUSH_CONFIG dùng được)
  sendCommand: (id: string, input: NodeCommandInput) =>
    api.post<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/commands`, input),

  // thiết bị gỡ trong 24 giờ còn khôi phục được (chỉ Farm Owner), và khôi phục kèm lý do bắt buộc
  listRemovedSensorNodes: () =>
    api.get<ApiResponse<RemovedDevice[]>>('/devices/sensor-nodes', { params: { removed: 'recent' } }),
  listRemovedCameraNodes: () =>
    api.get<ApiResponse<RemovedDevice[]>>('/devices/camera-nodes', { params: { removed: 'recent' } }),
  restoreSensorNode: (id: string, reason: string) =>
    api.post<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/restore`, { reason }),
  restoreCameraNode: (id: string, reason: string) =>
    api.post<ApiResponse<CameraNode>>(`/devices/camera-nodes/${id}/restore`, { reason }),

  // gỡ thiết bị (giữ lịch sử telemetry), lý do bắt buộc; khôi phục được trong 24 giờ. force: thiết bị đang ONLINE thì backend chỉ gỡ khi người dùng xác nhận (409 nếu thiếu)
  decommissionSensorNode: (id: string, reason: string, force = false) =>
    api.post<ApiResponse<SensorNode>>(`/devices/sensor-nodes/${id}/decommission`, force ? { reason, force: true } : { reason }),
  decommissionCameraNode: (id: string, reason: string) =>
    api.post<ApiResponse<CameraNode>>(`/devices/camera-nodes/${id}/decommission`, { reason }),
  // BE tạo node mới TRƯỚC rồi mới gỡ node cũ; sai secret_key thì node cũ giữ nguyên
  replaceSensorNode: (id: string, input: ReplaceSensorNodeInput) =>
    api.post<ApiResponse<{ oldNode: SensorNode; newNode: SensorNode }>>(`/devices/sensor-nodes/${id}/replace`, input),

  // chỉ Admin
  getSystemStatus: () => api.get<ApiResponse<SystemNodeStatus>>('/devices/system-status'),
}
