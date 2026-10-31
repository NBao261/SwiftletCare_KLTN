import type { DeviceStatus } from '@/types'

export interface DeviceStatusSummary {
  total: number
  online: number
  offline: number
  pending: number
}

// Đếm thiết bị theo trạng thái kết nối trong một lượt duyệt
export function summarizeDeviceStatuses(statuses: DeviceStatus[]): DeviceStatusSummary {
  const summary: DeviceStatusSummary = { total: statuses.length, online: 0, offline: 0, pending: 0 }
  for (const status of statuses) {
    if (status === 'ONLINE') summary.online += 1
    else if (status === 'OFFLINE') summary.offline += 1
    else summary.pending += 1
  }
  return summary
}
