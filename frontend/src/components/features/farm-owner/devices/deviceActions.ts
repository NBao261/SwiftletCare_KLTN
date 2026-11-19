import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory'
import type { Role } from '@/types'

// ENV-FR-013c, Report 3 §2.4 — chỉ Farm Owner quản lý bài loa ru (tải lên, đánh dấu đã chép thẻ SD, xoá, chọn, phát thử);
// role khác chỉ xem danh mục
export function canManageLullabyTracks(role: Role | undefined): boolean {
  return role === 'FARM_OWNER'
}

// FARM-FR-013 — Farm Owner khởi động lại bộ điều khiển của farm; chỉ khi đang ONLINE (lệnh đi qua MQTT)
export function canRestartController(role: Role | undefined, device: Pick<DeviceItem, 'type' | 'status'>): boolean {
  return role === 'FARM_OWNER' && device.type === 'sensor' && device.status === 'ONLINE'
}
