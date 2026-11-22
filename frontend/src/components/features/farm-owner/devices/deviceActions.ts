import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory'
import type { Role } from '@/types'

// Chỉ Farm Owner quản lý bài loa ru
export function canManageLullabyTracks(role: Role | undefined): boolean {
  return role === 'FARM_OWNER'
}

// chỉ Farm Owner dời, thay, gỡ bộ điều khiển; camera gắn cả nhà nên không dời Zone
export function canManageController(role: Role | undefined, device: Pick<DeviceItem, 'type'>): boolean {
  return role === 'FARM_OWNER' && device.type === 'sensor'
}

// Farm Owner khởi động lại bộ điều khiển của farm; chỉ khi đang ONLINE (lệnh đi qua MQTT)
export function canRestartController(role: Role | undefined, device: Pick<DeviceItem, 'type' | 'status'>): boolean {
  return role === 'FARM_OWNER' && device.type === 'sensor' && device.status === 'ONLINE'
}
