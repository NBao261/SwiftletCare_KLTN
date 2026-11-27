import type { SensorNode } from '@/types'

// Hàng tab của trang Thiết bị: mỗi tab một nhóm trạng thái
export type DeviceTab = 'ALL' | 'WARNING' | 'OFFLINE' | 'PENDING' | 'ONLINE'

// Cần Kỹ thuật viên xử lý: quá hạn kích hoạt hoặc cập nhật firmware lỗi
export const needsAttention = (node: SensorNode): boolean => !!node.activation_overdue_at || !!node.ota_failed

export function matchesTab(node: SensorNode, tab: DeviceTab): boolean {
  if (tab === 'ALL') return true
  if (tab === 'WARNING') return needsAttention(node)
  return node.status === tab
}

export function countByTab(nodes: SensorNode[]): Record<DeviceTab, number> {
  const tabs: DeviceTab[] = ['ALL', 'WARNING', 'OFFLINE', 'PENDING', 'ONLINE']
  return Object.fromEntries(tabs.map(tab => [tab, nodes.filter(node => matchesTab(node, tab)).length])) as Record<DeviceTab, number>
}

// Tìm theo mã thiết bị hoặc phiên bản firmware
export function matchesSearch(node: SensorNode, query: string): boolean {
  const text = query.trim().toLowerCase()
  return !text || node.device_id.toLowerCase().includes(text) || (node.firmware_version ?? '').toLowerCase().includes(text)
}

const rankOf = (node: SensorNode): number => {
  if (needsAttention(node)) return 0
  if (node.status === 'OFFLINE') return 1
  if (node.status === 'PENDING') return 2
  return node.status === 'ONLINE' ? 3 : 4
}

const heartbeatOf = (node: SensorNode): number => (node.last_heartbeat ? new Date(node.last_heartbeat).getTime() : 0)

// Thiết bị có vấn đề lên trước (cần xử lý, mất kết nối, chờ kết nối, rồi online); cùng nhóm thì kết nối gần nhất trước
export function sortDevices(nodes: SensorNode[]): SensorNode[] {
  return [...nodes].sort((a, b) => rankOf(a) - rankOf(b) || heartbeatOf(b) - heartbeatOf(a))
}
