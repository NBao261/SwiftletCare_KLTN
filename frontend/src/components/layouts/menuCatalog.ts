import {
  BasketIcon, BirdIcon, ChartBarIcon, ClipboardTextIcon, ClockCounterClockwiseIcon, CloudArrowUpIcon, CpuIcon, CrosshairIcon,
  FileTextIcon, GaugeIcon, GearSixIcon, HeartbeatIcon, HouseIcon, LightbulbFilamentIcon, PackageIcon, ScrollIcon,
  ShieldCheckIcon, SlidersHorizontalIcon, SquaresFourIcon, UsersIcon, WarningIcon, WrenchIcon,
} from '@phosphor-icons/react'
import type { MenuItem, MenuSection } from '@/components/layouts/AppSidebar'
import { canAccessPath } from '@/constants/roles'
import type { Role } from '@/types'

// Một danh mục cho mọi vai trò: cùng trang thì cùng tên, icon, nhóm tab; mỗi vai trò chỉ thấy phần MENU_ACCESS cho phép
type MenuGroup = 'monitor' | 'operations' | 'expertise' | 'system'

const GROUP_TITLE: Record<MenuGroup, string> = {
  monitor: 'Theo dõi',
  operations: 'Vận hành',
  expertise: 'Chuyên môn',
  system: 'Hệ thống',
}

const CATALOG: Record<MenuGroup, MenuItem[]> = {
  monitor: [
    { label: 'Tổng quan hệ thống', path: '/system/health', icon: GaugeIcon },
    {
      label: 'Tổng quan',
      path: '/dashboard',
      icon: SquaresFourIcon,
      tabs: [
        { label: 'Tình trạng các nhà', path: '/dashboard' },
        { label: 'So sánh nhà', path: '/overview' },
        { label: 'Điều khiển tay', path: '/dashboard/scada' },
      ],
    },
    { label: 'Cảnh báo', path: '/alerts', icon: WarningIcon },
    { label: 'Đàn chim', path: '/vision', icon: BirdIcon },
    { label: 'Sức khoẻ & báo cáo', path: '/health', icon: HeartbeatIcon },
    { label: 'Phân tích', path: '/analytics', icon: ChartBarIcon },
  ],
  operations: [
    {
      label: 'Công việc',
      path: '/work-orders',
      icon: WrenchIcon,
      tabs: [
        { label: 'Phiếu công việc', path: '/work-orders' },
        { label: 'Bảo trì định kỳ', path: '/maintenance' },
        { label: 'Khuyến nghị', path: '/recommendations' },
      ],
    },
    { label: 'Thiết bị', path: '/devices', icon: CpuIcon },
    { label: 'Kho thiết bị', path: '/system/device-stock', icon: PackageIcon },
    { label: 'Cập nhật firmware', path: '/ota', icon: CloudArrowUpIcon },
    { label: 'Trang trại', path: '/farms', icon: HouseIcon },
    { label: 'Thu hoạch', path: '/harvests', icon: BasketIcon },
  ],
  expertise: [
    { label: 'Hàng đợi việc', path: '/domain-expert/queue', icon: ClipboardTextIcon },
    { label: 'Kiểm chứng cảnh báo', path: '/domain-expert/alert-verdicts', icon: ShieldCheckIcon },
    {
      label: 'Tham số điều khiển',
      path: '/domain-expert/tuning',
      icon: SlidersHorizontalIcon,
      tabs: [
        { label: 'Ngưỡng & hệ số mờ', path: '/domain-expert/tuning' },
        { label: 'Duyệt & đề xuất', path: '/domain-expert/reviews' },
        { label: 'Hồ sơ cấu hình', path: '/domain-expert/profiles' },
        { label: 'Bù thời tiết', path: '/domain-expert/weather-rules' },
      ],
    },
    {
      label: 'Đếm chim',
      path: '/domain-expert/counting-schedule',
      icon: CrosshairIcon,
      tabs: [
        { label: 'Lịch đếm', path: '/domain-expert/counting-schedule' },
        { label: 'Vòng đếm', path: '/domain-expert/counting-ring' },
      ],
    },
    { label: 'Luật khuyến nghị', path: '/domain-expert/recommendation-rules', icon: LightbulbFilamentIcon },
    { label: 'Báo cáo & kết luận', path: '/domain-expert/reports', icon: FileTextIcon },
    { label: 'Lịch sử quyết định', path: '/domain-expert/history', icon: ClockCounterClockwiseIcon },
  ],
  system: [
    {
      label: 'Người dùng',
      path: '/users',
      icon: UsersIcon,
      tabs: [
        { label: 'Tài khoản', path: '/users' },
        { label: 'Yêu cầu xoá tài khoản', path: '/account-requests' },
      ],
    },
    { label: 'Cấu hình mặc định', path: '/system/settings', icon: GearSixIcon },
    { label: 'Nhật ký hệ thống', path: '/system/audit-log', icon: ScrollIcon },
  ],
}

// readOnly: nhóm chỉ để xem của vai trò này, thu gọn được và ghi rõ "(chỉ đọc)"
interface SectionPlan {
  group: MenuGroup
  readOnly?: boolean
  collapsible?: boolean
}

// Nhóm việc chính của vai trò đứng đầu; dock điện thoại là 4 trang vai trò đó dùng nhiều nhất
const ROLE_PLAN: Record<Role, { sections: SectionPlan[]; dock: string[] }> = {
  ADMIN: {
    sections: [{ group: 'monitor' }, { group: 'operations' }, { group: 'system' }],
    dock: ['/system/health', '/devices', '/alerts', '/users'],
  },
  FARM_OWNER: {
    // Chuyên môn ít dùng hằng ngày (farm có chuyên gia thì chỉ xem, nhắc) nên thu gọn được
    sections: [{ group: 'monitor' }, { group: 'operations' }, { group: 'expertise', collapsible: true }],
    dock: ['/dashboard', '/alerts', '/vision', '/health'],
  },
  FARM_TECHNICIAN: {
    // Vòng đếm thợ vẽ được nên nhóm Chuyên môn không ghi "chỉ đọc", chỉ thu gọn
    sections: [{ group: 'monitor' }, { group: 'operations' }, { group: 'expertise', collapsible: true }],
    dock: ['/alerts', '/work-orders', '/dashboard', '/health'],
  },
  DOMAIN_EXPERT: {
    sections: [{ group: 'expertise' }, { group: 'monitor', readOnly: true }, { group: 'operations', readOnly: true }],
    dock: ['/domain-expert/queue', '/domain-expert/alert-verdicts', '/domain-expert/tuning', '/domain-expert/counting-schedule'],
  },
}

// Mục mở trang đầu tiên vai trò vào được; còn một tab thì thôi hiện tab
function itemFor(role: Role, item: MenuItem): MenuItem | null {
  if (!item.tabs) return canAccessPath(role, item.path) ? item : null
  const tabs = item.tabs.filter(tab => canAccessPath(role, tab.path))
  if (tabs.length === 0) return null
  return tabs.length === 1 ? { ...item, path: tabs[0].path, tabs: undefined } : { ...item, path: tabs[0].path, tabs }
}

export function roleMenu(role: Role): { sections: MenuSection[]; dock: MenuItem[] } {
  const plan = ROLE_PLAN[role]
  const sections = plan.sections
    .map(({ group, readOnly, collapsible }) => ({
      title: readOnly ? `${GROUP_TITLE[group]} (chỉ đọc)` : GROUP_TITLE[group],
      collapsible: readOnly || collapsible,
      items: CATALOG[group].map(item => itemFor(role, item)).filter((item): item is MenuItem => item !== null),
    }))
    .filter(section => section.items.length > 0)
  const items = sections.flatMap(section => section.items)
  const dock = plan.dock
    .map(path => items.find(item => item.path === path || item.tabs?.some(tab => tab.path === path)))
    .filter((item): item is MenuItem => item !== undefined)
  return { sections, dock }
}
