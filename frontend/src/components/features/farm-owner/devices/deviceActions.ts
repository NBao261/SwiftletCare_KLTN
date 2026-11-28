import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory'
import type { Role } from '@/types'

// Chỉ Farm Owner quản lý bài loa ru
export function canManageLullabyTracks(role: Role | undefined): boolean {
  return role === 'FARM_OWNER'
}

// Farm Owner và Farm Technician (nhà được giao) dời, thay, gỡ bộ điều khiển; camera gắn cả nhà nên không dời Zone
export function canManageController(role: Role | undefined, device: Pick<DeviceItem, 'type'>): boolean {
  return (role === 'FARM_OWNER' || role === 'FARM_TECHNICIAN') && device.type === 'sensor'
}

// Địa chỉ camera IP là việc thiết lập thiết bị của Farm Owner và Farm Technician nhà được giao (SF-01, FARM-FR-004b)
export function canSetCameraSource(role: Role | undefined, device: Pick<DeviceItem, 'type'>): boolean {
  return (role === 'FARM_OWNER' || role === 'FARM_TECHNICIAN') && device.type === 'camera'
}

// Farm Owner và Farm Technician (nhà được giao) khởi động lại bộ điều khiển; chỉ khi đang ONLINE (lệnh đi qua MQTT)
export function canRestartController(role: Role | undefined, device: Pick<DeviceItem, 'type' | 'status'>): boolean {
  return (role === 'FARM_OWNER' || role === 'FARM_TECHNICIAN') && device.type === 'sensor' && device.status === 'ONLINE'
}
