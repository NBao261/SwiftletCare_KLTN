import api from './client'
import type {
  ApiResponse, AuditLogEntry, SlaConfig, SlaConfigWithMeta,
  SystemDefaultThresholds, SystemDefaultThresholdsWithMeta, SystemHealthSummary,
} from '@/types'

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

  /** SYSTEM-FR-002 — chưa cấu hình bao giờ thì backend trả giá trị gốc, khi đó updated_at/updated_by vắng mặt */
  getDefaultThresholds: () =>
    api.get<ApiResponse<SystemDefaultThresholdsWithMeta>>('/system/settings/default-thresholds'),

  /** SYSTEM-FR-002 — 400 nếu min ≥ max / ngoài khoảng đo cảm biến; ghi DEFAULT_THRESHOLDS_UPDATED vào audit log. Response PUT không kèm meta — hook invalidate query để lấy lại updated_at/updated_by mới. */
  updateDefaultThresholds: (input: Partial<SystemDefaultThresholds>) =>
    api.put<ApiResponse<SystemDefaultThresholds>>('/system/settings/default-thresholds', input),

  /** TICKET-FR-006, SLA-NFR-001 — chưa cấu hình bao giờ thì backend trả DEFAULT_SLA (sla.util.ts), khi đó updated_at/updated_by vắng mặt */
  getSlaHours: () =>
    api.get<ApiResponse<SlaConfigWithMeta>>('/system/settings/sla'),

  /** TICKET-FR-006 — 400 nếu giờ ≤0 hoặc hạn phản hồi muộn hơn hạn xử lý; ghi SLA_UPDATED vào audit log. Response PUT không kèm meta — hook invalidate query để lấy lại updated_at/updated_by mới. */
  updateSlaHours: (input: Partial<SlaConfig>) =>
    api.put<ApiResponse<SlaConfig>>('/system/settings/sla', input),

  /** SYSTEM-FR-003 */
  getHealthOverview: () =>
    api.get<ApiResponse<SystemHealthSummary>>('/system/health-overview'),
}
