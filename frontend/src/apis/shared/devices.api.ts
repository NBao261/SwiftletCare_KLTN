import api from '@/lib/axios'
import type { ApiResponse, SensorNode, CameraNode, RelayName, SystemNodeStatus, SpeakerScheduleInput } from '@/types'

export const deviceApi = {
  registerSensorNode: (input: { device_id: string; zone_id: string }) =>
    api.post<ApiResponse<SensorNode>>('/devices/sensor-nodes/register', input),
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

  // OPS-NFR-004 — chỉ Admin
  getSystemStatus: () => api.get<ApiResponse<SystemNodeStatus>>('/devices/system-status'),
}
