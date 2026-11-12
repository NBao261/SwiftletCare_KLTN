// Kiểu dùng chung mọi module — không thuộc nghiệp vụ nào riêng.

// SRS AUTH-FR-004: 4 role tham gia RBAC. Buyer đăng ký qua OTP không mang role
// nào (role = null) vì không truy cập endpoint nào bị chặn theo role.
// G-20: TECHNICIAN (hệ thống) → FARM_TECHNICIAN (thợ được gán nhà cụ thể, backend f9d9522)
export type Role = 'ADMIN' | 'FARM_OWNER' | 'FARM_TECHNICIAN' | 'DOMAIN_EXPERT'

/** Chiều sắp xếp dùng chung cho DataTable + các hook list có sort */
export type SortDirection = 'asc' | 'desc'

// ── API response envelope (§9.0) ───────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  /** `unreadCount` chỉ có ở GET /alerts (ALERT-FR-007 — số cảnh báo ACTIVE) */
  meta?: { page?: number; limit?: number; total?: number; unreadCount?: number }
  error?: { code: string; message: string }
}
