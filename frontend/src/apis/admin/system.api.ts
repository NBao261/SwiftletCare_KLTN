import api from '@/lib/axios'
import type { ApiResponse, AuditLogEntry, SystemDefaultThresholds, SystemDefaultThresholdsInput, SystemDefaultThresholdsView, SystemHealthSummary } from '@/types'

// GET /system/audit-logs: mọi filter đều tuỳ chọn; sort cố định created_at desc.
export interface ListAuditLogsQuery {
  // ObjectId user thực hiện (backend validate isMongoId)
  actorId?: string
  // Mã hành động nguyên văn, xem constants/auditActions.ts
  action?: string
  targetType?: string
  targetId?: string
  // ISO8601: backend so sánh `created_at >= from` / `<= to`, nên `to` phải là CUỐI ngày
  from?: string
  to?: string
  page?: number
  limit?: number
}

// Không có endpoint reset: khôi phục mặc định gốc là PUT với FACTORY_DEFAULT_THRESHOLDS
export const systemApi = {
  listAuditLogs: (query?: ListAuditLogsQuery) =>
    api.get<ApiResponse<AuditLogEntry[]>>('/system/audit-logs', { params: query }),

  // chưa cấu hình bao giờ thì backend trả giá trị gốc
  getDefaultThresholds: () =>
    api.get<ApiResponse<SystemDefaultThresholdsView>>('/system/settings/default-thresholds'),

  // 400 nếu min ≥ max / ngoài khoảng đo cảm biến, 422 nếu thiếu nguồn REF-5; ghi audit log
  updateDefaultThresholds: (input: SystemDefaultThresholdsInput) =>
    api.put<ApiResponse<SystemDefaultThresholds>>('/system/settings/default-thresholds', input),

  getHealthOverview: () =>
    api.get<ApiResponse<SystemHealthSummary>>('/system/health-overview'),
}
