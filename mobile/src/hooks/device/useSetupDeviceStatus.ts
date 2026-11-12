import { useQuery } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'
import type { ApiResponse, CameraNode, DeviceStatus, SensorNode } from '@/types'

// Thiết bị vừa đăng ký đang chờ kết nối: hỏi lại mỗi 5 giây tới khi có heartbeat đầu tiên (FARM-FR-012)
const SETUP_POLL_MS = 5 * 1000

export type SetupDeviceKind = 'camera' | 'controller'

export interface SetupDeviceStatus {
  status: DeviceStatus | null
  // Quá 15 phút chưa kết nối (BR-27): backend gắn mốc này và báo người đăng ký
  isOverdue: boolean
  isError: boolean
}

type SetupDeviceList = ApiResponse<(SensorNode | CameraNode)[]>

// Lấy danh sách thiết bị cùng loại — cùng dữ liệu, cùng khoá cache với useSensorNodes / useCameraNodes
function fetchDevices(kind: SetupDeviceKind): Promise<SetupDeviceList> {
  return kind === 'camera'
    ? deviceApi.listCameraNodes().then(response => response.data)
    : deviceApi.listSensorNodes().then(response => response.data)
}

// Trạng thái của thiết bị vừa đăng ký trong lúc theo dõi setup: đọc từ danh sách thiết bị (các màn khác cũng thấy thiết bị đã
// kết nối); chỉ hỏi lại khi thiết bị còn chờ
export function useSetupDeviceStatus(kind: SetupDeviceKind, deviceRecordId: string | null): SetupDeviceStatus {
  const query = useQuery({
    queryKey: ['devices', kind === 'camera' ? 'camera-nodes' : 'sensor-nodes'],
    queryFn: () => fetchDevices(kind),
    enabled: Boolean(deviceRecordId),
    refetchInterval: currentQuery => {
      const device = currentQuery.state.data?.data.find(item => item._id === deviceRecordId)
      return device && device.status !== 'PENDING' ? false : SETUP_POLL_MS
    },
  })
  const device = query.data?.data.find(item => item._id === deviceRecordId) ?? null

  return {
    status: device?.status ?? null,
    isOverdue: Boolean(device?.activation_overdue_at) && device?.status === 'PENDING',
    isError: query.isError,
  }
}
