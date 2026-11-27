import type { DeviceStatus, SystemNodeStatusItem } from '@/types'

// Hàng tab của trang Thiết bị: mỗi tab một trạng thái
export type DeviceTab = 'ALL' | DeviceStatus

// Cần chú ý lên trước: mất kết nối, chờ kết nối, rồi online
const STATUS_RANK: Record<DeviceStatus, number> = { OFFLINE: 0, PENDING: 1, ONLINE: 2 }

const heartbeatOf = (node: SystemNodeStatusItem) => (node.last_heartbeat ? new Date(node.last_heartbeat).getTime() : 0)

// Cùng trạng thái thì thiết bị kết nối gần nhất trước
export function sortDevices(nodes: SystemNodeStatusItem[]): SystemNodeStatusItem[] {
  return [...nodes].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || heartbeatOf(b) - heartbeatOf(a))
}

export function countByStatus(nodes: SystemNodeStatusItem[]): Record<DeviceTab, number> {
  const counts: Record<DeviceTab, number> = { ALL: nodes.length, OFFLINE: 0, PENDING: 0, ONLINE: 0 }
  for (const node of nodes) counts[node.status] += 1
  return counts
}

// Nhà và Zone của thiết bị; camera đếm chim thuộc cả nhà nên không có Zone
export function nodePlace(node: Pick<SystemNodeStatusItem, 'house_name' | 'zone_name'>): string {
  return [node.house_name, node.zone_name].filter(Boolean).join(' · ')
}
