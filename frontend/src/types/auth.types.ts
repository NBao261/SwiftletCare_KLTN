// Module AUTH (§5.1) — tài khoản, đăng nhập, lời mời vào farm.

import type { Role } from '@/types/common.types'

/**
 * Trạng thái tài khoản dưới góc nhìn Admin — KHÔNG phải field trên `users` (backend
 * chỉ có is_active/deletion_requested_at/deleted_at), là giá trị dẫn xuất phía UI,
 * xem `getUserStatus()` trong hooks/admin/useUsers.ts.
 */
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'PENDING_DELETION' | 'DELETED'

export interface User {
  _id: string; email: string; phone?: string; full_name: string; role: Role; avatar_url?: string
  notification_preferences: {
    push: boolean; zalo: boolean; sms: boolean
    quiet_hours: { start: string; end: string }
  }
  /** AUTH-FR-011 — false khi Admin khoá (Flow 19) HOẶC đã xoá theo yêu cầu (xem deleted_at) */
  is_active: boolean
  deactivated_at?: string
  /** AUTH-FR-011 — bắt buộc nhập khi khoá, backend trả lại nguyên văn */
  deactivated_reason?: string
  /** AUTH-FR-012 — đã yêu cầu xoá tài khoản, chờ Administrator xử lý trong ≤30 ngày */
  deletion_requested_at?: string
  /** AUTH-FR-012 — Admin đã xoá/ẩn danh xong; document vẫn còn để giữ tham chiếu lịch sử */
  deleted_at?: string
  /** AUTH-FR-005c — chỉ Technician, vùng phụ trách do Admin gán khi tạo tài khoản */
  assigned_regions?: string[]
  created_at?: string
}

/**
 * AUTH-FR-005b/005d, Flow 16 bước 1b/1e — đúng shape `GET /admin/sales-staff-requests`
 * (backend populate farm_id / requested_by / sales_staff_id / reviewed_by).
 * ADD = Farm Owner đề xuất thêm Sales Staff; REMOVE = yêu cầu gỡ khỏi farm.
 */
export interface SalesAssignmentRequest {
  _id: string
  type: 'ADD' | 'REMOVE'
  farm_id: { _id: string; name: string; region?: string }
  requested_by: { _id: string; full_name: string; email: string }
  /** Chỉ có với type=REMOVE */
  sales_staff_id?: { _id: string; full_name: string; email: string }
  sales_staff_email: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewed_by?: { _id: string; full_name: string; email: string }
  review_note?: string
  reviewed_at?: string
  created_at: string
}

// AUTH-FR-002/003 — request/response cho POST /auth/login, /auth/register
export interface LoginRequest { email: string; password: string }
export interface RegisterRequest { email: string; password: string; full_name: string; phone?: string }
export interface LoginResponse { accessToken: string; user: User }

/** AUTH-FR-010, Flow 12 — lời mời thành viên/Sales Staff, hết hạn sau 7 ngày nếu không phản hồi */
export interface Invitation {
  _id: string
  farm_id: string
  invited_email: string
  invited_role: Extract<Role, 'FARM_OWNER' | 'SALES_STAFF'>
  invited_by: string
  token: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  expires_at: string
  responded_at?: string
  created_at: string
}
