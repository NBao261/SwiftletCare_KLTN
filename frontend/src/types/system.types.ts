// Module SYSTEM (§5.11) — nhật ký hệ thống, ngưỡng mặc định, tổng quan sức khoẻ.

import type { Role } from '@/types/common.types'
import type { Thresholds } from '@/types/farm.types'
import type { SystemNodeStatus } from '@/types/device.types'

/**
 * SYSTEM-FR-001 — 1 dòng `audit_logs`, đúng shape `GET /system/audit-logs`
 * (backend populate actor_id = 'full_name email role'). `actor_id` rỗng khi
 * hệ thống tự ghi (job nền, VD TICKET_SLA_BREACHED); mã `action` xem
 * constants/auditActions.ts.
 */
export interface AuditLogEntry {
  _id: string
  actor_id?: { _id: string; full_name: string; email: string; role: Role }
  action: string
  /** 'user' | 'ticket' | 'farm' | 'zone' | 'sensor_node' | 'camera_node' | 'system_settings' | 'sales_assignment_request' | ... */
  target_type: string
  target_id?: string
  metadata?: Record<string, unknown>
  ip_address?: string
  created_at: string
}

/** SYSTEM-FR-002 — nguồn cho ENV-FR-020 "reset về mặc định", cùng shape 7 trường với Zone.thresholds */
export type SystemDefaultThresholds = Thresholds

/**
 * SYSTEM-FR-003 — đúng shape `GET /system/health-overview`: chỉ đếm theo trạng
 * thái, KHÔNG phải BI/xu hướng. Farm chỉ đếm farm chưa xoá mềm; ticket chỉ đếm
 * ticket chưa CLOSED; `users.byRole` có thể có khoá 'NONE' (buyer không mang role).
 */
export interface SystemHealthSummary {
  farms: { total: number }
  zones: { total: number }
  devices: SystemNodeStatus['summary']
  openTickets: { total: number; P1: number; P2: number; P3: number }
  users: {
    total: number; active: number; inactive: number
    byRole: Partial<Record<Role | 'NONE', { active: number; inactive: number }>>
  }
}
