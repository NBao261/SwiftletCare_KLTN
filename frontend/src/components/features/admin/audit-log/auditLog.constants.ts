import {
  IconSettings, IconLogin, IconPlusCircle, IconEdit, IconTrash, IconShield, IconActivity,
} from '@/components/ui/icons'

/**
 * Nhóm hành động nhật ký — màu thẻ CHỈ phụ thuộc nhóm này (không zebra theo
 * index). Mã lấy nguyên văn từ constants/auditActions.ts; mã backend mới chưa có
 * trong map rơi về `other`, không vỡ giao diện.
 */
export type ActionCategory = 'config' | 'auth' | 'create' | 'update' | 'delete' | 'security' | 'other'

export const ACTION_CATEGORY: Record<string, ActionCategory> = {
  DEFAULT_THRESHOLDS_UPDATED: 'config',
  SLA_UPDATED: 'config',
  THRESHOLD_UPDATED: 'config',
  RELAY_OVERRIDE: 'config',

  LOGIN: 'auth',

  USER_CREATED: 'create',
  DEVICE_REGISTERED: 'create',

  TECHNICIAN_REGIONS_UPDATED: 'update',
  DEVICE_REASSIGNED: 'update',
  FARM_OWNERSHIP_TRANSFERRED: 'update',
  TICKET_ADMIN_OVERRIDE: 'update',
  SALES_STAFF_REQUEST_APPROVED: 'update',
  SALES_STAFF_REQUEST_REJECTED: 'update',

  ACCOUNT_DELETED: 'delete',
  DELETION_REQUESTED: 'delete',
  FARM_SOFT_DELETED: 'delete',
  SALES_STAFF_UNASSIGNED: 'delete',

  PASSWORD_RESET: 'security',
  ACCOUNT_LOCKED: 'security',
  ACCOUNT_UNLOCKED: 'security',
  LOGIN_FAILED: 'security',
}

export function actionCategory(action: string): ActionCategory {
  return ACTION_CATEGORY[action] ?? 'other'
}

/**
 * Icon tròn theo nhóm — nơi DUY NHẤT mang màu nhóm hành động (không dải viền, không nền thẻ).
 * Chỉ dùng token sẵn có (FE_Design_Claude.md cấm pha màu ngoài bảng): bảng màu không có
 * xanh dương/tím, nên update = graphite, security = charcoal + icon lime.
 */
export const CATEGORY_STYLE: Record<ActionCategory, { chip: string; Icon: typeof IconSettings }> = {
  config:   { chip: 'bg-orange-100 text-orange-600', Icon: IconSettings },
  auth:     { chip: 'bg-gray-100 text-gray-500',     Icon: IconLogin },
  create:   { chip: 'bg-accent-100 text-accent-800', Icon: IconPlusCircle },
  update:   { chip: 'bg-gray-100 text-graphite',     Icon: IconEdit },
  delete:   { chip: 'bg-red-100 text-red-600',       Icon: IconTrash },
  security: { chip: 'bg-charcoal text-limeMist',     Icon: IconShield },
  other:    { chip: 'bg-gray-100 text-warmGray',     Icon: IconActivity },
}
