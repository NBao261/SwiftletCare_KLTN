import type { Role } from '@/types'
import { t, translated } from '@/i18n'

// Nhãn vai trò dùng chung
export const ROLE_LABEL: Record<Role, string> = translated({
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ nhà yến',
  FARM_TECHNICIAN: 'Kỹ thuật viên',
  DOMAIN_EXPERT: 'Chuyên gia',
})

// Người được mời không thành chủ chính nên không dùng lại ROLE_LABEL
export const INVITE_ROLE_LABEL: Record<Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'FARM_TECHNICIAN'>, string> = {
  // Getter: gán thẳng thì nhãn đóng băng theo ngôn ngữ lúc import
  get FARM_OWNER() { return `${ROLE_LABEL.FARM_OWNER} (${t('thành viên')})` },
  get DOMAIN_EXPERT() { return ROLE_LABEL.DOMAIN_EXPERT },
  get FARM_TECHNICIAN() { return ROLE_LABEL.FARM_TECHNICIAN },
}

// Nhóm role khai một chỗ để route, sidebar và MENU_ACCESS không lệch nhau

// Chỉ Domain Expert; Farm Owner xem báo cáo ở /health
export const EXPERT_ROLES: Role[] = ['DOMAIN_EXPERT']

// Farm Owner cũng vào: ghi được khi farm chưa có chuyên gia (useExpertDecisionRights)
export const EXPERT_DECISION_ROLES: Role[] = ['DOMAIN_EXPERT', 'FARM_OWNER']

// Điều khiển tay relay (/dashboard/scada): Farm Owner, Kỹ thuật viên ở nhà được giao; Domain Expert không (Report 3 §2.4)
export const RELAY_CONTROL_ROLES: Role[] = ['FARM_OWNER', 'FARM_TECHNICIAN']

// Màn vận hành của farm; Domain Expert chỉ đọc
export const FARM_SIDE_ROLES: Role[] = ['FARM_OWNER', 'DOMAIN_EXPERT']

// Trang trại (/farms, nhà, Zone): không có Admin
export const FARM_STRUCTURE_ROLES: Role[] = ['FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN']

// Màn của nhà yến cho cả ba vai trò trại (giám sát, công việc, đánh giá ngày): kỹ thuật viên chỉ thấy nhà được giao (G-33)
export const FARM_WORK_ROLES: Role[] = ['FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN']

// Thu hoạch: Farm Owner ghi và xác nhận, Kỹ thuật viên nhập lần chờ xác nhận, Domain Expert chỉ đọc (backend canRead/canWrite)
export const HARVEST_ROLES: Role[] = FARM_WORK_ROLES

// Các role trang trại và Admin
export const DEVICE_LIST_ROLES: Role[] = ['ADMIN', ...FARM_STRUCTURE_ROLES]

// Lắp thiết bị: chỉ Farm Owner (: FARM_TECHNICIAN và ADMIN gọi API này nhận 403).
export const DEVICE_SETUP_ROLES: Role[] = ['FARM_OWNER']

// Domain Expert dùng hàng đợi kiểm chứng thay cho trang này
export const ALERT_ROLES: Role[] = ['ADMIN', 'FARM_OWNER', 'FARM_TECHNICIAN']

// OTA Firmware và PUSH_CONFIG: chỉ Admin gửi được.
export const ADMIN_DEVICE_CMD_ROLES: Role[] = ['ADMIN']

// RESTART từ xa: Admin (mọi farm) + Farm Owner + Farm Technician (nhà được giao).
export const DEVICE_RESTART_ROLES: Role[] = ['ADMIN', 'FARM_OWNER', 'FARM_TECHNICIAN']

// Module SYSTEM (mục 5.11) + quản lý tài khoản toàn hệ thống.
export const ADMIN_ONLY: Role[] = ['ADMIN']

// Mọi role đã đăng nhập: mục menu ai cũng thấy (Cài đặt tài khoản).
const ALL_ROLES: Role[] = ['FARM_OWNER', 'FARM_TECHNICIAN', 'ADMIN', 'DOMAIN_EXPERT']

// Dùng cho cả RoleHomeRedirect và điều hướng sau đăng nhập để không lệch nhau
const ROLE_HOME: Record<Role, string> = {
  FARM_OWNER: '/dashboard',
  ADMIN: '/system/health',
  FARM_TECHNICIAN: '/alerts',
  DOMAIN_EXPERT: '/domain-expert/queue',
}

export function getRoleHomePath(role: Role | undefined): string {
  return role ? ROLE_HOME[role] : '/dashboard'
}

// Phải khớp menuSections của <Role>Layout; không đọc từ layout vì sẽ import vòng. Path con đặt trước path cha
export const MENU_ACCESS: { path: string; roles: Role[] }[] = [
  { path: '/system/health',    roles: ADMIN_ONLY },
  { path: '/dashboard/scada',  roles: RELAY_CONTROL_ROLES },
  { path: '/dashboard',        roles: FARM_WORK_ROLES },
  { path: '/devices/detail',   roles: FARM_SIDE_ROLES },
  { path: '/devices/onboarding', roles: DEVICE_SETUP_ROLES },
  { path: '/devices',          roles: DEVICE_LIST_ROLES },
  { path: '/alerts',           roles: ALERT_ROLES },
  { path: '/farms',            roles: FARM_STRUCTURE_ROLES },
  { path: '/ota',              roles: ADMIN_ONLY },
  { path: '/users',            roles: ADMIN_ONLY },
  { path: '/account-requests', roles: ADMIN_ONLY },
  { path: '/harvests',         roles: HARVEST_ROLES },
  { path: '/maintenance',      roles: FARM_WORK_ROLES },
  { path: '/recommendations',  roles: FARM_WORK_ROLES },
  { path: '/system/settings',  roles: ADMIN_ONLY },
  { path: '/system/audit-log', roles: ADMIN_ONLY },
  { path: '/system/device-stock', roles: ADMIN_ONLY },
  { path: '/analytics',        roles: FARM_WORK_ROLES },
  { path: '/overview',         roles: FARM_SIDE_ROLES },
  { path: '/vision',           roles: FARM_WORK_ROLES },
  { path: '/health',           roles: FARM_WORK_ROLES },
  { path: '/work-orders',      roles: FARM_WORK_ROLES },
  { path: '/domain-expert/queue',          roles: EXPERT_ROLES },
  { path: '/domain-expert/alert-verdicts',  roles: EXPERT_DECISION_ROLES },
  { path: '/domain-expert/reviews',         roles: EXPERT_DECISION_ROLES },
  { path: '/domain-expert/tuning',          roles: EXPERT_DECISION_ROLES },
  { path: '/domain-expert/counting-schedule',     roles: EXPERT_DECISION_ROLES },
  { path: '/domain-expert/counting-ring',         roles: FARM_WORK_ROLES },
  { path: '/domain-expert/weather-rules',         roles: EXPERT_DECISION_ROLES },
  { path: '/domain-expert/reports',               roles: EXPERT_ROLES },
  { path: '/domain-expert/profiles',              roles: EXPERT_DECISION_ROLES },
  { path: '/domain-expert/recommendation-rules',  roles: EXPERT_DECISION_ROLES },
  { path: '/domain-expert/history',               roles: EXPERT_DECISION_ROLES },
  { path: '/settings',         roles: ALL_ROLES },
]

// Path lạ thì mặc định tin (RequireRole vẫn chặn); chỉ nói "không" khi chắc chắn role không vào được
export function canAccessPath(role: Role | undefined, path: string): boolean {
  const entry = MENU_ACCESS.find(e => path === e.path || path.startsWith(`${e.path}/`))
  if (!entry) return true
  return !!role && entry.roles.includes(role)
}

// Bậc phạm vi trang cần để có dữ liệu; không có trong bảng = 'none'
export type ScopeLevel = 'none' | 'farm' | 'house' | 'zone'

const SCOPE_LEVEL: { path: string; level: ScopeLevel }[] = [
  { path: '/overview',                            level: 'farm' },
  { path: '/recommendations',                     level: 'farm' },
  { path: '/work-orders',                         level: 'farm' },
  { path: '/health',                              level: 'farm' },
  { path: '/domain-expert/alert-verdicts',        level: 'farm' },
  { path: '/domain-expert/reviews',               level: 'farm' },
  { path: '/domain-expert/profiles',              level: 'farm' },
  { path: '/domain-expert/recommendation-rules',  level: 'farm' },
  { path: '/domain-expert/history',               level: 'farm' },
  { path: '/domain-expert/counting-schedule',     level: 'house' },
  { path: '/domain-expert/counting-ring',         level: 'house' },
  { path: '/domain-expert/weather-rules',         level: 'house' },
  { path: '/domain-expert/tuning',                level: 'zone' },
]

export function scopeLevelOf(path: string): ScopeLevel {
  return SCOPE_LEVEL.find(entry => path === entry.path || path.startsWith(`${entry.path}/`))?.level ?? 'none'
}
