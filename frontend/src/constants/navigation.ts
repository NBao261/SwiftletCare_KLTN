import type { ComponentType, SVGProps } from 'react'
import {
  IconDashboard, IconFarm, IconDevice, IconAlert,
  IconAnalytics, IconTicket, IconHarvest, IconSettings, IconUsers,
  IconBell,
} from '@/components/ui/icons'
import type { Role } from '@/types'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Role nào được thấy mục này trong Sidebar/MobileDock — mỗi role có sidebar riêng, không dùng chung. */
  roles: Role[]
  /**
   * Role nào được ghim mục này lên MobileDock (tối đa DOCK_SIZE mục/role). Không
   * khai báo thì dock lấy DOCK_SIZE mục đầu tiên của nav đã lọc theo role — đủ
   * cho Farm Owner/Technician, nhưng Admin có 9 mục nên phải chọn tay, nếu
   * không Người dùng/Yêu cầu tài khoản không bao giờ vào được từ điện thoại.
   */
  dock?: Role[]
}

interface NavSection {
  title: string
  items: NavItem[]
}

const OPS_ROLES: Role[] = ['FARM_OWNER', 'TECHNICIAN', 'ADMIN']
// Dashboard (6 chỉ số môi trường realtime) và Phân tích (xu hướng/so sánh/đếm
// chim) là công cụ vận hành hằng ngày CỦA RIÊNG Farm Owner — SRS không mô tả
// Technician/Admin dùng 2 trang này (họ xử lý kỹ thuật/ticket, không giám sát
// môi trường chi tiết theo zone). Technician/Admin "check tín hiệu" qua trang
// Thiết bị (online/offline/RSSI theo zone); Admin có thêm mục "Hệ thống" riêng
// xem toàn hệ thống (Module SYSTEM, mục 5.11 — xem section "Hệ thống" dưới).
const FARM_OWNER_ONLY: Role[] = ['FARM_OWNER']

/**
 * Danh sách điều hướng đầy đủ (chưa lọc theo role) — dùng chung cho Sidebar
 * (desktop) và MobileDock (mobile), để 2 nơi không bị lệch nhau khi thêm/bớt
 * màn hình. Dùng getNavSections()/getDockItems() để lấy bản đã lọc theo role.
 */
const ALL_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Vận hành',
    items: [
      // Trang nhà Admin sau đăng nhập (ROLE_HOME) — đặt đầu sidebar, xem chi
      // tiết ở section "Hệ thống" trong comment dưới (SYSTEM-FR-003).
      { to: '/system/health', label: 'Tổng quan hệ thống', icon: IconDashboard, roles: ['ADMIN'], dock: ['ADMIN'] },
      { to: '/dashboard', label: 'Tổng quan', icon: IconDashboard, roles: FARM_OWNER_ONLY },
      { to: '/devices',   label: 'Thiết bị & Cảm biến',  icon: IconDevice, roles: OPS_ROLES },
      { to: '/alerts',    label: 'Cảnh báo',  icon: IconAlert, roles: OPS_ROLES },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { to: '/farms',     label: 'Trang trại', icon: IconFarm, roles: OPS_ROLES },
      { to: '/tickets',   label: 'Ticket',     icon: IconTicket, roles: OPS_ROLES, dock: ['ADMIN'] },
      // Quản lý tài khoản người dùng toàn hệ thống — chỉ Admin (AUTH-FR-011, RACI mục 4.4)
      { to: '/users',     label: 'Người dùng', icon: IconUsers, roles: ['ADMIN'], dock: ['ADMIN'] },
      // Hàng đợi xoá tài khoản (AUTH-FR-012) + đề xuất Sales Staff (AUTH-FR-005d) — chỉ Admin
      { to: '/account-requests', label: 'Yêu cầu tài khoản', icon: IconBell, roles: ['ADMIN'], dock: ['ADMIN'] },
      // Backend: toàn bộ router harvests chỉ requireRole(FARM_OWNER, ADMIN) —
      // và theo lựa chọn sản phẩm, Admin dùng sidebar giống Technician nên
      // cũng không hiện mục này (route /harvests vẫn cho Admin gọi được, chỉ
      // ẩn khỏi nav).
      { to: '/harvests',  label: 'Thu hoạch & Chợ yến', icon: IconHarvest, roles: FARM_OWNER_ONLY },
    ],
  },
  {
    // Module SYSTEM (mục 5.11, mới v1.16.0) — "control center" chỉ Admin: audit
    // log, ngưỡng mặc định hệ thống, tổng quan sức khỏe hệ thống. "Tổng quan hệ
    // thống" (gộp luôn OPS-NFR-004 — xem DeviceStatusSummary.tsx trong
    // SystemHealthPage) được đặt lên đầu sidebar (section "Vận hành" trên) vì
    // là trang nhà của Admin — không lặp lại ở đây.
    title: 'Hệ thống',
    items: [
      { to: '/system/settings', label: 'Cấu hình mặc định', icon: IconSettings, roles: ['ADMIN'] },
      { to: '/system/audit-log', label: 'Nhật ký hệ thống', icon: IconAnalytics, roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Khác',
    items: [
      { to: '/analytics', label: 'Phân tích', icon: IconAnalytics, roles: FARM_OWNER_ONLY },
      { to: '/settings',  label: 'Cài đặt',   icon: IconSettings, roles: ['FARM_OWNER', 'TECHNICIAN', 'ADMIN', 'SALES_STAFF'] },
    ],
  },
]

/** Toàn bộ nav item, không lọc theo role — TopBar dùng để tra tiêu đề trang (không phụ thuộc ai đang xem). */
export const ALL_NAV_ITEMS: NavItem[] = ALL_NAV_SECTIONS.flatMap(s => s.items)

/** Sidebar/MobileDock gọi hàm này thay vì đọc thẳng danh sách tĩnh — mỗi role ra 1 bộ nav riêng. */
export function getNavSections(role: Role | undefined): NavSection[] {
  if (!role) return []
  return ALL_NAV_SECTIONS
    .map(section => ({ ...section, items: section.items.filter(item => item.roles.includes(role)) }))
    .filter(section => section.items.length > 0)
}

/** Số mục tối đa trên dock — 4 nút tròn + 1 nhãn mục đang mở vừa khít 375px (UX-NFR-001). */
const DOCK_SIZE = 4

/**
 * Mục hiển thị trên dock mobile: ưu tiên các mục có `dock` ghim cho role này;
 * role không ghim gì thì lấy DOCK_SIZE mục đầu tiên của nav đã lọc (tần suất dùng hằng ngày).
 */
export function getDockItems(role: Role | undefined): NavItem[] {
  if (!role) return []
  const items = getNavSections(role).flatMap(s => s.items)
  const pinned = items.filter(item => item.dock?.includes(role))
  return (pinned.length > 0 ? pinned : items).slice(0, DOCK_SIZE)
}

/**
 * Trang "nhà" của mỗi role — dùng cho cả `RoleHomeRedirect` (App.tsx, khi vào
 * "/" hoặc URL không tồn tại) LẪN `useAuth.ts` (điều hướng ngay sau khi đăng
 * nhập thành công). Gộp về 1 chỗ để không lệch nhau — trước đây App.tsx tự
 * khai báo riêng còn useAuth.ts hardcode "/dashboard", khiến Technician/Admin/
 * Sales Staff đăng nhập xong bị đưa nhầm vào trang họ không có quyền, văng
 * sang /403 ngay sau khi login.
 */
const ROLE_HOME: Record<Role, string> = {
  FARM_OWNER: '/dashboard',
  ADMIN: '/system/health',
  TECHNICIAN: '/devices',
  SALES_STAFF: '/sales-home',
}

export function getRoleHomePath(role: Role | undefined): string {
  return role ? ROLE_HOME[role] : '/dashboard'
}

/**
 * true nếu role được phép vào path này — dùng để kiểm tra `returnTo` trước khi
 * điều hướng sau login (useAuth.ts). Không rõ path lạ (không nằm trong nav, VD
 * `/settings`, `/tickets/:id` con) thì mặc định tin — route thật vẫn tự chặn
 * qua RequireRole nếu sai, hàm này chỉ tránh trường hợp PHỔ BIẾN: đăng xuất
 * account A trên 1 trang riêng của role A rồi đăng nhập account B (role khác)
 * qua đúng URL đó, bị đưa thẳng vào trang A không có quyền rồi văng /403 ngay.
 * Bảo thủ theo hướng an toàn: chỉ nói "không" khi CHẮC CHẮN path đó có danh
 * sách role giới hạn và role hiện tại không nằm trong đó.
 */
export function canAccessPath(role: Role | undefined, path: string): boolean {
  const item = ALL_NAV_ITEMS.find(i => path === i.to || path.startsWith(`${i.to}/`))
  if (!item) return true
  return !!role && item.roles.includes(role)
}
