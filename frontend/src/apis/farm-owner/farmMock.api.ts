import type { ApiResponse } from '@/types'

// MOCK API cho trường swagger chưa có (lịch thu, khuyến nghị AI, người lắp, firmware mới nhất): trả rỗng đúng khuôn ApiResponse, có API thì chỉ thay thân hàm
const MOCK_LATENCY_MS = 120

function mockResponse<T>(data: T): Promise<{ data: ApiResponse<T> }> {
  return new Promise(resolve => setTimeout(() => resolve({ data: { success: true, data } }), MOCK_LATENCY_MS))
}

export interface StructureExtras {
  /** houseId → ngày dự kiến thu hoạch tiếp theo, ISO (chưa có lịch thu hoạch) */
  nextHarvest: Record<string, string>
}

/** Khuyến nghị kỹ thuật từ hệ thống AI của nhà — null khi AI chưa triển khai */
export interface HouseAdvice { body: string; tag?: string }
export interface DeviceProfile { installedBy?: string; latestFirmware?: string }

export const farmMockApi = {
  getStructureExtras: (_houseIds: string[]) => mockResponse<StructureExtras>({ nextHarvest: {} }),

  getHouseAdvice: (_houseId: string) => mockResponse<HouseAdvice | null>(null),

  getDeviceProfile: (_deviceId: string) => mockResponse<DeviceProfile>({}),
}
