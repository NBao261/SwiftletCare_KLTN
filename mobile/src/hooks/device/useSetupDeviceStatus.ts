import { useQuery } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'
import type { ApiResponse, CameraNode, DeviceStatus, SensorNode } from '@/types'
import { type ConfigApplyStep, getConfigApplyStep } from '@/utils/device.utils'

// Thiết bị vừa đăng ký đang chờ kết nối hoặc chờ áp cấu hình: hỏi lại mỗi 5 giây (FARM-FR-012)
const SETUP_POLL_MS = 5 * 1000

export type SetupDeviceKind = 'camera' | 'controller'

export interface SetupDeviceStatus {
  status: DeviceStatus | null
  // Bước áp cấu hình khu vực, chỉ controller có (camera gắn House, không nhận cấu hình Zone)
  configStep: ConfigApplyStep | null
  // Quá 15 phút chưa kết nối (BR-27): backend gắn mốc này và báo người đăng ký
  isOverdue: boolean
  isError: boolean
}

type SetupDevice = SensorNode | CameraNode
type SetupDeviceList = ApiResponse<SetupDevice[]>

// Lấy danh sách thiết bị cùng loại — cùng dữ liệu, cùng khoá cache với useSensorNodes / useCameraNodes
function fetchDevices(kind: SetupDeviceKind): Promise<SetupDeviceList> {
  return kind === 'camera'
    ? deviceApi.listCameraNodes().then(response => response.data)
    : deviceApi.listSensorNodes().then(response => response.data)
}

// Bước áp cấu hình của controller; config_sync chỉ có trên SensorNode
function readConfigStep(kind: SetupDeviceKind, device: SetupDevice | null): ConfigApplyStep | null {
  if (kind !== 'controller') return null
  const configSync = device && 'config_sync' in device ? device.config_sync : undefined
  return getConfigApplyStep(device?.status ?? null, configSync)
}

// Còn phải hỏi lại không: xong khi thiết bị đang trực tuyến và (controller) đã áp cấu hình hoặc firmware không báo phiên bản.
// Thiết bị mất kết nối thì màn chờ nó kết nối lại (bước "Đã kết nối"), chỉ hỏi trong lúc màn tiến trình còn mở
function isSetupSettled(kind: SetupDeviceKind, device: SetupDevice | null): boolean {
  if (device?.status !== 'ONLINE') return false
  const configStep = readConfigStep(kind, device)
  return configStep === null || configStep === 'applied' || configStep === 'unknown'
}

// Trạng thái của thiết bị vừa đăng ký trong lúc theo dõi setup: đọc từ danh sách thiết bị (các màn khác cũng thấy thiết bị đã
// kết nối); chỉ hỏi lại khi thiết bị còn chờ
export function useSetupDeviceStatus(kind: SetupDeviceKind, deviceRecordId: string | null): SetupDeviceStatus {
  const query = useQuery({
    queryKey: ['devices', kind === 'camera' ? 'camera-nodes' : 'sensor-nodes'],
    queryFn: () => fetchDevices(kind),
    enabled: Boolean(deviceRecordId),
    refetchInterval: currentQuery => {
      const device = currentQuery.state.data?.data.find(item => item._id === deviceRecordId) ?? null
      return isSetupSettled(kind, device) ? false : SETUP_POLL_MS
    },
  })
  const device = query.data?.data.find(item => item._id === deviceRecordId) ?? null

  return {
    status: device?.status ?? null,
    configStep: readConfigStep(kind, device),
    isOverdue: Boolean(device?.activation_overdue_at) && device?.status === 'PENDING',
    isError: query.isError,
  }
}
