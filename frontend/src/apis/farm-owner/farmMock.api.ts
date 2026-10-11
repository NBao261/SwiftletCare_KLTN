import type { ApiResponse } from '@/types'

/**
 * MOCK API — những trường màn "Cấu trúc Farm" cần mà backend/swagger CHƯA có (đã đối chiếu
 * docs/api/api-spec.yaml): người phụ trách nhà, lịch thu hoạch dự kiến, khuyến nghị AI, kỹ thuật
 * viên lắp đặt + firmware mới nhất của thiết bị. Mọi thứ còn lại (farm/house/zone/thiết bị/
 * telemetry/cảnh báo/thu hoạch) đi qua API thật.
 *
 * KHÔNG bịa số liệu: khi chưa có endpoint, hàm trả dữ liệu RỖNG đúng kiểu và UI hiển thị khung
 * trống ("Chưa có dữ liệu"). Trả đúng khuôn `AxiosResponse<ApiResponse<T>>` (`{ data: { success, data } }`)
 * có độ trễ giả, nên khi backend có endpoint chỉ cần thay thân hàm — hook/UI giữ nguyên.
 */
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
}
