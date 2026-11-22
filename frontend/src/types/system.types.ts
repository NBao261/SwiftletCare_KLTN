// Module SYSTEM: nhật ký hệ thống, ngưỡng mặc định, tổng quan sức khoẻ.

import type { Role } from '@/types/common.types'
import type { Thresholds } from '@/types/farm.types'
import type { SystemNodeStatus } from '@/types/device.types'

// actor_id rỗng khi hệ thống tự ghi; mã action xem constants/auditActions.ts
export interface AuditLogEntry {
  _id: string
  actor_id?: { _id: string; full_name: string; email: string; role: Role }
  action: string
  // 'user' 'farm' 'zone' 'sensor_node' 'camera_node' 'system_settings' 'sales_assignment_request' ...
  target_type: string
  target_id?: string
  // Tên tài khoản khi target_type='user' (backend tra sẵn); null với loại khác/tài khoản không còn
  target_name?: string | null
  metadata?: Record<string, unknown>
  source_ip?: string
  client?: string
  correlation_id?: string
  created_at: string
}

// nguồn cho "reset về mặc định", cùng shape 7 trường với Zone.thresholds
export type SystemDefaultThresholds = Thresholds

// `GET /system/settings/default-thresholds`: ngưỡng kèm nguồn và lần đổi gần nhất
export type SystemDefaultThresholdsView = Thresholds & {
  source: string | null
  updated_at: string | null
}

// mỗi lần đổi ngưỡng mặc định phải kèm nguồn (mã REF-5)
export type SystemDefaultThresholdsInput = Thresholds & { source: string }

// Chỉ đếm theo trạng thái; active = đăng nhập được
export interface SystemHealthSummary {
  farms: { total: number }
  zones: { total: number }
  devices: SystemNodeStatus['summary']
  users: {
    total: number; active: number; inactive: number; deleted: number
    byRole: Partial<Record<Role, { active: number; inactive: number; deleted: number }>>
  }
}
