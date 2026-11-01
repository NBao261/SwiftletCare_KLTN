import type { Role } from '@/types'
import { t, translated } from '@/i18n'

/** Nhãn vai trò dùng chung — Sidebar (hiển thị role user hiện tại), Settings, v.v. translated(): đọc ra theo VI/EN đang chọn */
export const ROLE_LABEL: Record<Role, string> = translated({
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ nhà yến',
  TECHNICIAN: 'Kỹ thuật viên',
  DOMAIN_EXPERT: 'Chuyên gia',
})

/**
 * Nhãn vai trò trong ngữ cảnh lời mời (InvitationPage) — chỉ 2 role mời được
 * (FARM_FR-*: FARM_OWNER mời thành viên/chuyên gia). FARM_OWNER ở đây được
 * chú thích "(thành viên)" vì người được mời KHÔNG trở thành chủ sở hữu chính
 * (isPrimaryOwner), khác với nhãn chung ở trên — cố ý không dùng lại ROLE_LABEL
 * để tránh nhầm lẫn về quyền sở hữu farm.
 */
export const INVITE_ROLE_LABEL: Record<Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT'>, string> = {
  // getter: đọc ROLE_LABEL (dịch lúc đọc) mỗi lần dùng — gán giá trị thẳng thì nhãn đóng băng theo ngôn ngữ lúc import
  get FARM_OWNER() { return `${ROLE_LABEL.FARM_OWNER} (${t('thành viên')})` },
  get DOMAIN_EXPERT() { return ROLE_LABEL.DOMAIN_EXPERT },
}

/*
 * Nhóm role theo Report 3 §2.4. Khai báo một chỗ để bảng route (`routes/`), menu sidebar
 * (`components/layouts/<Role>Layout.tsx`) và MENU_ACCESS bên dưới không lệch nhau.
 * Admin không thấy farm nào (chỉ /system/*, /users, /account-requests); Technician chỉ thấy
 * cấu trúc và thiết bị của mọi farm, không thấy số liệu môi trường, đàn chim, thu hoạch.
 */

/** Màn quyết định của Chuyên gia nuôi yến (/domain-expert/*). */
export const EXPERT_ROLES: Role[] = ['DOMAIN_EXPERT']

/** Việc chỉ Farm Owner làm: điều khiển relay (/dashboard/scada). */
export const FARM_OWNER_ONLY: Role[] = ['FARM_OWNER']

/**
 * Màn vận hành của farm: Tổng quan, Phân tích, Giám sát đàn chim, Thu hoạch, chi tiết thiết bị.
 * Domain Expert đọc qua chính các trang này (nút ghi gate bằng usePermission('FARM_OWNER')).
 */
export const FARM_SIDE_ROLES: Role[] = ['FARM_OWNER', 'DOMAIN_EXPERT']

/** Thu hoạch: Farm Owner ghi, Domain Expert chỉ đọc — khớp backend harvests (canRead/canWrite). */
export const HARVEST_ROLES: Role[] = FARM_SIDE_ROLES

/** Trang trại và Thiết bị: Farm Owner quản lý, Domain Expert chỉ đọc, Technician xem mọi farm. */
export const FARM_STRUCTURE_ROLES: Role[] = ['FARM_OWNER', 'DOMAIN_EXPERT', 'TECHNICIAN']

/** Lắp thiết bị (MF-10, FARM-FR-010/011): Farm Owner và Technician. */
export const DEVICE_SETUP_ROLES: Role[] = ['FARM_OWNER', 'TECHNICIAN']

/** Cảnh báo: Farm Owner xem và xác nhận, Technician chỉ cảnh báo thiết bị; Domain Expert dùng hàng đợi kiểm chứng. */
export const ALERT_ROLES: Role[] = ['FARM_OWNER', 'TECHNICIAN']

/** Lệnh từ xa và OTA (FARM-FR-013). */
export const TECHNICIAN_ONLY: Role[] = ['TECHNICIAN']

/** Module SYSTEM (mục 5.11) + quản lý tài khoản toàn hệ thống. */
export const ADMIN_ONLY: Role[] = ['ADMIN']

/** Mọi role đã đăng nhập — mục menu ai cũng thấy (Cài đặt tài khoản). */
const ALL_ROLES: Role[] = ['FARM_OWNER', 'TECHNICIAN', 'ADMIN', 'DOMAIN_EXPERT']

/**
 * Trang "nhà" của mỗi role — dùng cho cả `RoleHomeRedirect` (App.tsx, khi vào
 * "/" hoặc URL không tồn tại) LẪN `useAuth.ts` (điều hướng ngay sau khi đăng
 * nhập thành công). Gộp về 1 chỗ để không lệch nhau — trước đây App.tsx tự
 * khai báo riêng còn useAuth.ts hardcode "/dashboard", khiến Technician/Admin
 * đăng nhập xong bị đưa nhầm vào trang họ không có quyền, văng
 * sang /403 ngay sau khi login.
 */
const ROLE_HOME: Record<Role, string> = {
  FARM_OWNER: '/dashboard',
  ADMIN: '/system/health',
  TECHNICIAN: '/devices',
  DOMAIN_EXPERT: '/domain-expert/queue',
}

export function getRoleHomePath(role: Role | undefined): string {
  return role ? ROLE_HOME[role] : '/dashboard'
}

/**
 * Path nào nằm trên menu của role nào. Phải khớp `menuSections` trong
 * `components/layouts/<Role>Layout.tsx` — cố ý để ở đây chứ không đọc ngược từ
 * layout, vì `useAuth` dùng bảng này mà layout lại dựng ra `AppHeader` gọi
 * `useAuth`, import vòng sẽ lỗi lúc chạy.
 */
// Path con cụ thể đặt TRƯỚC path cha: canAccessPath lấy dòng khớp đầu tiên
const MENU_ACCESS: { path: string; roles: Role[] }[] = [
  { path: '/system/health',    roles: ADMIN_ONLY },
  { path: '/dashboard/scada',  roles: FARM_OWNER_ONLY },
  { path: '/dashboard',        roles: FARM_SIDE_ROLES },
  { path: '/devices/detail',   roles: FARM_SIDE_ROLES },
  { path: '/devices',          roles: FARM_STRUCTURE_ROLES },
  { path: '/alerts',           roles: ALERT_ROLES },
  { path: '/farms',            roles: FARM_STRUCTURE_ROLES },
  { path: '/onboarding',       roles: DEVICE_SETUP_ROLES },
  { path: '/ota',              roles: TECHNICIAN_ONLY },
  { path: '/users',            roles: ADMIN_ONLY },
  { path: '/account-requests', roles: ADMIN_ONLY },
  { path: '/harvests',         roles: HARVEST_ROLES },
  { path: '/system/settings',  roles: ADMIN_ONLY },
  { path: '/system/audit-log', roles: ADMIN_ONLY },
  { path: '/system/devices',   roles: ADMIN_ONLY },
  { path: '/analytics',        roles: FARM_SIDE_ROLES },
  { path: '/vision',           roles: FARM_SIDE_ROLES },
  { path: '/domain-expert/queue',          roles: EXPERT_ROLES },
  { path: '/domain-expert/alert-verdicts',  roles: EXPERT_ROLES },
  { path: '/domain-expert/tuning',          roles: EXPERT_ROLES },
  { path: '/domain-expert/reports',         roles: EXPERT_ROLES },
  { path: '/domain-expert/history',         roles: EXPERT_ROLES },
  { path: '/settings',         roles: ALL_ROLES },
]

/**
 * true nếu role được phép vào path này — dùng để kiểm tra `returnTo` trước khi
 * điều hướng sau login (useAuth.ts). Không rõ path lạ (không nằm trong bảng, VD
 * `/farms/:id` con) thì mặc định tin — route thật vẫn tự chặn qua RequireRole
 * nếu sai, hàm này chỉ tránh trường hợp PHỔ BIẾN: đăng xuất account A trên 1
 * trang riêng của role A rồi đăng nhập account B (role khác) qua đúng URL đó,
 * bị đưa thẳng vào trang A không có quyền rồi văng /403 ngay. Bảo thủ theo
 * hướng an toàn: chỉ nói "không" khi CHẮC CHẮN path đó có danh sách role giới
 * hạn và role hiện tại không nằm trong đó.
 */
export function canAccessPath(role: Role | undefined, path: string): boolean {
  const entry = MENU_ACCESS.find(e => path === e.path || path.startsWith(`${e.path}/`))
  if (!entry) return true
  return !!role && entry.roles.includes(role)
}
