import type { AlertSeverity, Role } from '@/types/domain.types'

// Tên tiếng Việt của mã backend cho chữ người dùng đọc (thông báo, Telegram, push, email), cùng tên với web
// (frontend constants/enumLabels.i18n.ts, severity.i18n.ts — FE_Design §6.2); không đưa mã enum ra cho người dùng

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ nhà yến',
  FARM_TECHNICIAN: 'Kỹ thuật viên',
  DOMAIN_EXPERT: 'Chuyên gia',
}

// Mức cảnh báo hiện 3 cấp như web (FE_Design §2.4): MEDIUM và LOW cùng là "Thường"
export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  CRITICAL: 'Khẩn cấp',
  HIGH: 'Cao',
  MEDIUM: 'Thường',
  LOW: 'Thường',
}
