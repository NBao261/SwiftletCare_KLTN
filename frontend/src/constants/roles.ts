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

/**
 * Nhóm role vận hành trang trại (Tổng quan/Thiết bị/Cảnh báo/Trang trại…). Khai báo một chỗ để bảng
 * route (`routes/`) và menu sidebar (`components/layouts/<Role>Layout.tsx`) không lệch nhau.
 */
export const OPS_ROLES: Role[] = ['FARM_OWNER', 'TECHNICIAN', 'ADMIN']

/**
 * Nhóm role Chuyên gia nuôi yến — SRS v2.1.4:
 * Bảng điều khiển, Kiểm chứng cảnh báo suy luận, Tinh chỉnh & Hiệu chuẩn, Phân tích dự báo, Báo cáo sức khỏe.
 */
export const EXPERT_ROLES: Role[] = ['DOMAIN_EXPERT']

/**
 * Tổng quan/Phân tích (giám sát môi trường chi tiết theo zone) là công cụ vận
 * hành hằng ngày CỦA RIÊNG Farm Owner — Technician/Admin xử lý kỹ thuật,
 * họ "check tín hiệu" qua trang Thiết bị chứ không cần chi tiết tới mức đó.
 */
export const FARM_OWNER_ONLY: Role[] = ['FARM_OWNER']

/** Thống kê sản lượng (thu hoạch) — khớp backend: router harvests chỉ requireRole(FARM_OWNER, ADMIN). */
export const HARVEST_ROLES: Role[] = ['FARM_OWNER', 'ADMIN']

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
  DOMAIN_EXPERT: '/expert/dashboard',
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
const MENU_ACCESS: { path: string; roles: Role[] }[] = [
  { path: '/system/health',    roles: ADMIN_ONLY },
  { path: '/dashboard',        roles: FARM_OWNER_ONLY },
  { path: '/devices',          roles: OPS_ROLES },
  { path: '/alerts',           roles: OPS_ROLES },
  { path: '/farms',            roles: OPS_ROLES },
  { path: '/onboarding',       roles: OPS_ROLES },
  { path: '/ota',              roles: OPS_ROLES },
  { path: '/users',            roles: ADMIN_ONLY },
  { path: '/account-requests', roles: ADMIN_ONLY },
  { path: '/harvests',         roles: FARM_OWNER_ONLY },
  { path: '/system/settings',  roles: ADMIN_ONLY },
  { path: '/system/audit-log', roles: ADMIN_ONLY },
  { path: '/system/devices',   roles: ADMIN_ONLY },
  { path: '/analytics',        roles: FARM_OWNER_ONLY },
  { path: '/vision',           roles: FARM_OWNER_ONLY },
  { path: '/expert/dashboard', roles: EXPERT_ROLES },
  { path: '/expert/audit-logs',roles: EXPERT_ROLES },
  { path: '/expert/tuning',    roles: EXPERT_ROLES },
  { path: '/expert/analytics', roles: EXPERT_ROLES },
  { path: '/expert/reports',   roles: EXPERT_ROLES },
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
