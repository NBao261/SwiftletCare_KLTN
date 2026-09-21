import api from './client'
import type { ApiResponse, AuditLogEntry, SystemDefaultThresholds, SystemHealthSummary } from '@/types'

/** GET /system/audit-logs — mọi filter đều tuỳ chọn; sort cố định created_at desc. */
export interface ListAuditLogsQuery {
  /** ObjectId user thực hiện (backend validate isMongoId) */
  actorId?: string
  /** Mã hành động nguyên văn, xem constants/auditActions.ts */
  action?: string
  targetType?: string
  targetId?: string
  /** ISO8601 — backend so sánh `created_at >= from` / `<= to`, nên `to` phải là CUỐI ngày */
  from?: string
  to?: string
  page?: number
  limit?: number
}

/**
 * Router `/system` (backend/src/routes/system.route.ts) — Module SYSTEM §5.11,
 * mọi endpoint `requireRole('ADMIN')`. Không có endpoint reset ngưỡng: "khôi
 * phục mặc định gốc" là PUT với FACTORY_DEFAULT_THRESHOLDS (constants/thresholds.ts).
 */
export const systemApi = {
  /** SYSTEM-FR-001 */
  listAuditLogs: (query?: ListAuditLogsQuery) =>
    api.get<ApiResponse<AuditLogEntry[]>>('/system/audit-logs', { params: query }),

  /** SYSTEM-FR-002 — chưa cấu hình bao giờ thì backend trả giá trị gốc */
  getDefaultThresholds: () =>
    api.get<ApiResponse<SystemDefaultThresholds>>('/system/settings/default-thresholds'),

  /** SYSTEM-FR-002 — 400 nếu min ≥ max / ngoài khoảng đo cảm biến; ghi DEFAULT_THRESHOLDS_UPDATED vào audit log */
  updateDefaultThresholds: (input: Partial<SystemDefaultThresholds>) =>
    api.put<ApiResponse<SystemDefaultThresholds>>('/system/settings/default-thresholds', input),

  /** SYSTEM-FR-003 */
  getHealthOverview: () =>
    api.get<ApiResponse<SystemHealthSummary>>('/system/health-overview'),
}
