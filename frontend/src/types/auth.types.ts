// Module AUTH (§5.1) — tài khoản, đăng nhập, lời mời vào farm.

import type { AlertSeverity } from '@/types/alert.types'
import type { Role } from '@/types/common.types'

/**
 * Trạng thái tài khoản dưới góc nhìn Admin — KHÔNG phải field trên `users` (backend
 * chỉ có is_active/deletion_requested_at/deleted_at), là giá trị dẫn xuất phía UI,
 * xem `getUserStatus()` trong hooks/admin/useUsers.ts.
 */
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'PENDING_DELETION' | 'DELETED'

// ALERT-FR-005 — kênh ngoài ứng dụng của 1 mức cảnh báo; trường không có thì dùng cài đặt chung
export interface ChannelChoice {
  push?: boolean
  telegram?: boolean
}

export interface NotificationPreferences {
  push: boolean // zalo/sms đã bỏ theo SRS 3.1.0 (G-01)
  telegram?: boolean
  by_severity?: Partial<Record<AlertSeverity, ChannelChoice>>
  quiet_hours: { start: string; end: string }
}

// Gửi lên PUT /auth/notification-preferences: by_severity.<mức> = null để bỏ ghi đè của mức đó
export interface NotificationPreferencesInput extends Partial<Omit<NotificationPreferences, 'by_severity'>> {
  by_severity?: Partial<Record<AlertSeverity, ChannelChoice | null>>
}

export interface User {
  _id: string; email: string; phone?: string; full_name: string; role: Role; avatar_url?: string
  notification_preferences: NotificationPreferences
  /** ALERT-FR-013 — đã liên kết bot Telegram */
  telegram_linked?: boolean
  /** AUTH-FR-011 — false khi Admin khoá (Flow 19) HOẶC đã xoá theo yêu cầu (xem deleted_at) */
  is_active: boolean
  deactivated_at?: string
  /** AUTH-FR-011 — bắt buộc nhập khi khoá, backend trả lại nguyên văn */
  deactivated_reason?: string
  /** AUTH-FR-012 — đã yêu cầu xoá tài khoản, chờ Administrator xử lý trong ≤30 ngày */
  deletion_requested_at?: string
  /** AUTH-FR-012 — Admin đã xoá/ẩn danh xong; document vẫn còn để giữ tham chiếu lịch sử */
  deleted_at?: string
  created_at?: string
}

// AUTH-FR-002/003 — request/response cho POST /auth/login
export interface LoginRequest { email: string; password: string }
export interface LoginResponse { accessToken: string; user: User }

/** AUTH-FR-010, Flow 12 — lời mời đồng sở hữu/chuyên gia, hết hạn sau 7 ngày nếu không phản hồi */
export interface Invitation {
  _id: string
  farm_id: string
  invited_email: string
  invited_role: Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'FARM_TECHNICIAN'>
  invited_by: string
  token: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  expires_at: string
  responded_at?: string
  created_at: string
}
