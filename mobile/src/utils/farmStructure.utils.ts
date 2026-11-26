import type { QueryClient } from '@tanstack/react-query'

// Khoá cần tải lại sau khi đổi tên nhà, khu vực: các màn đọc tên từ danh sách nhà, khu vực và tổng quan farm
const RENAME_KEYS = ['houses', 'zones', 'farms', 'farm-overview'] as const

// Khoá cần tải lại sau khi xoá nhà, khu vực: backend đóng cảnh báo, huỷ phiếu công việc, ngừng kế hoạch bảo trì và khuyến nghị
// của nơi bị xoá (FARM-FR-002)
const DELETE_KEYS = [
  ...RENAME_KEYS,
  'devices',
  'alerts',
  'work-orders',
  'maintenance',
  'recommendations',
  'health-days',
] as const

// Tải lại dữ liệu cấu trúc farm sau khi đổi tên hoặc xoá một nhà, khu vực
export function refreshFarmStructure(queryClient: QueryClient, change: 'rename' | 'delete'): Promise<void> {
  const keys = change === 'rename' ? RENAME_KEYS : DELETE_KEYS
  return Promise.all(keys.map(key => queryClient.invalidateQueries({ queryKey: [key] }))).then(() => undefined)
}

// Tầng cao nhất đang có khu vực: số tầng mới của nhà không được thấp hơn (backend trả 400); nhà chưa có khu vực thì 0
export function getHighestZoneFloor(zones: readonly { floor: number }[]): number {
  return zones.reduce((highest, zone) => Math.max(highest, zone.floor ?? 0), 0)
}
