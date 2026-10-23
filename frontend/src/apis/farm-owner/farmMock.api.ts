import { DEVICE_COMPONENT_NAMES, type DeviceComponentName } from '@/data/deviceComponents.data'
import type { ApiResponse } from '@/types'

// MOCK API cho trường swagger chưa có (người phụ trách, lịch thu, khuyến nghị AI, kỹ thuật viên lắp, firmware mới nhất): trả rỗng đúng khuôn ApiResponse, có API thì chỉ thay thân hàm
const MOCK_LATENCY_MS = 120

function mockResponse<T>(data: T): Promise<{ data: ApiResponse<T> }> {
  return new Promise(resolve => setTimeout(() => resolve({ data: { success: true, data } }), MOCK_LATENCY_MS))
}

export interface StructureExtras {
  /** houseId → người phụ trách (chưa có field trên House) */
  houseStaff: Record<string, { name: string; initials: string }>
  /** houseId → ngày dự kiến thu hoạch tiếp theo, ISO (chưa có lịch thu hoạch) */
  nextHarvest: Record<string, string>
}

/** Khuyến nghị kỹ thuật từ hệ thống AI của nhà — null khi AI chưa triển khai */
export interface HouseAdvice { body: string; tag?: string }
export interface DeviceProfile { installedBy?: string; latestFirmware?: string }

export const farmMockApi = {
  getStructureExtras: (_houseIds: string[]) => mockResponse<StructureExtras>({ houseStaff: {}, nextHarvest: {} }),

  getHouseAdvice: (_houseId: string) => mockResponse<HouseAdvice | null>(null),

  getDeviceProfile: (_deviceId: string) => mockResponse<DeviceProfile>({}),

  // Tên thiết bị con của bộ kit do Kỹ thuật viên đặt — dữ liệu giả trong src/data, chờ API thật
  getDeviceComponentNames: (deviceId: string) => mockResponse<DeviceComponentName[]>(DEVICE_COMPONENT_NAMES[deviceId] ?? []),
}
