import type { Href } from 'expo-router'
import {
  BellIcon,
  ChartLineIcon,
  UserCircleIcon,
  HouseIcon,
  SquaresFourIcon,
  WarehouseIcon,
  type Icon,
} from 'phosphor-react-native'
import type { Role } from '@/types'

// Một mục trên thanh tab: name là thư mục route trong src/app/(tabs)/
export interface RoleTab {
  name: string
  title: string
  icon: Icon
  // Hiện số cảnh báo chưa đọc trên tab
  showsAlertBadge?: boolean
  // Nút tròn lớn nổi lên khỏi thanh tab (nền xanh loang); mỗi role tối đa một tab
  isFeatured?: boolean
}

/**
 * Tab của từng role trên mobile — chỗ duy nhất cần sửa khi đổi menu.
 * Đổi menu: sửa title/icon, trỏ name sang route thật trong src/app/(tabs)/.
 * Role không có ở đây thì không được vào app: Technician và Admin dùng bản web (Report 4 §5.4).
 */
export const ROLE_TABS: Partial<Record<Role, readonly RoleTab[]>> = {
  FARM_OWNER: [
    { name: 'dashboard', title: 'Trang chủ', icon: HouseIcon },
    { name: 'farms', title: 'Trang trại', icon: WarehouseIcon },
    { name: 'alerts', title: 'Cảnh báo', icon: BellIcon, showsAlertBadge: true, isFeatured: true },
    { name: 'analytics', title: 'Phân tích', icon: ChartLineIcon },
    { name: 'profile', title: 'Tài khoản', icon: UserCircleIcon },
  ],
  // menu-1..2 tạm — đổi tên và gán route thật khi làm màn chuyên gia; Tài khoản dùng chung màn với Farm Owner
  DOMAIN_EXPERT: [
    { name: 'menu-1', title: 'Menu 1', icon: SquaresFourIcon },
    { name: 'menu-2', title: 'Menu 2', icon: SquaresFourIcon },
    { name: 'profile', title: 'Tài khoản', icon: UserCircleIcon },
  ],
}

// Role được dùng app mobile
export function isMobileRole(role: Role): boolean {
  return (ROLE_TABS[role]?.length ?? 0) > 0
}

// Danh sách tab của role, theo đúng thứ tự trên thanh tab
export function getRoleTabs(role: Role): readonly RoleTab[] {
  return ROLE_TABS[role] ?? []
}

// Tiêu đề của tab theo tên route — màn tạm lấy tiêu đề từ đây
export function findTabTitle(name: string): string | undefined {
  for (const tabs of Object.values(ROLE_TABS)) {
    const tab = tabs?.find(roleTab => roleTab.name === name)
    if (tab) return tab.title
  }
  return undefined
}

// Màn đầu tiên sau khi đăng nhập: tab đầu của role
export function getRoleHomeHref(role: Role): Href {
  const firstTab = getRoleTabs(role)[0]
  return (firstTab ? `/(tabs)/${firstTab.name}` : '/(auth)/login') as Href
}
