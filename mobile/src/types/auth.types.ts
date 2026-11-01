// Khớp backend/src/types/domain.types.ts (Report 3 §2.3)
export type Role = 'ADMIN' | 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'TECHNICIAN'

// Kênh ngoài app: push (ALERT-FR-002) và Telegram (ALERT-FR-013)
export interface NotificationPreferences {
  push: boolean
  // Chỉ có tác dụng khi tài khoản đã liên kết bot Telegram
  telegram: boolean
  quiet_hours: { start: string; end: string }
}

export interface User {
  _id: string
  email: string
  phone?: string
  full_name: string
  role: Role
  avatar_url?: string
  is_active: boolean
  // Đang giữ mật khẩu tạm do Admin cấp — phải đổi trước khi dùng app (AUTH-FR-005c)
  must_change_password?: boolean
  notification_preferences: NotificationPreferences
  // Đã liên kết bot Telegram (ALERT-FR-013)
  telegram_linked?: boolean
  created_at: string
}

// refreshToken chỉ có khi gửi header X-Client: mobile
export interface LoginResponse {
  accessToken: string
  refreshToken?: string
  user: User
}
