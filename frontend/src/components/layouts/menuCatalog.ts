import {
  BasketIcon, BirdIcon, ChartBarIcon, ClipboardTextIcon, ClockCounterClockwiseIcon, CpuIcon, CrosshairIcon,
  FileTextIcon, GaugeIcon, GearSixIcon, HandPointingIcon, HeartbeatIcon, HouseIcon, LightbulbFilamentIcon,
  ScrollIcon, ShieldCheckIcon, SlidersHorizontalIcon, SquaresFourIcon, UsersIcon, WarningIcon, WrenchIcon,
} from '@phosphor-icons/react'
import type { MenuItem, MenuSection } from '@/components/layouts/AppSidebar'
import { canAccessPath } from '@/constants/roles'
import type { Role } from '@/types'

// Một danh mục cho mọi vai trò: cùng trang thì cùng tên, icon, nhóm tab; mỗi vai trò chỉ thấy phần MENU_ACCESS cho phép
type MenuGroup = 'monitor' | 'operations' | 'manage' | 'expertise' | 'system'

const GROUP_TITLE: Record<MenuGroup, string> = {
  monitor: 'Theo dõi',
  operations: 'Vận hành',
  manage: 'Quản lý',
  expertise: 'Chuyên môn',
  system: 'Hệ thống',
}

const CATALOG: Record<MenuGroup, MenuItem[]> = {
  monitor: [
    { label: 'Tổng quan hệ thống', path: '/system/health', icon: GaugeIcon },
    { label: 'Tổng quan', path: '/dashboard', icon: SquaresFourIcon },
    { label: 'Cảnh báo', path: '/alerts', icon: WarningIcon },
    { label: 'Chim ra vào', path: '/vision', icon: BirdIcon },
    { label: 'Sức khoẻ & báo cáo', path: '/health', icon: HeartbeatIcon },
    { label: 'Phân tích', path: '/analytics', icon: ChartBarIcon },
  ],
  // Việc làm hằng ngày: phiếu và bảo trì, bật tắt tay, ghi thu hoạch
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
    { label: 'Điều khiển tay', path: '/relay-control', icon: HandPointingIcon },
    { label: 'Thu hoạch', path: '/harvests', icon: BasketIcon },
  ],
  // Tài sản và cấu trúc, thiết lập một lần rồi ít đụng tới
  manage: [
    // Quản trị viên thêm kho thiết bị và cập nhật firmware ở hai tab; vai trò khác chỉ vào được /devices nên không có tab
    {
      label: 'Thiết bị',
      path: '/devices',
      icon: CpuIcon,
      tabs: [
        { label: 'Thiết bị', path: '/devices' },
        { label: 'Kho thiết bị', path: '/system/device-stock' },
        { label: 'Cập nhật firmware', path: '/ota' },
      ],
    },
    { label: 'Trang trại', path: '/farms', icon: HouseIcon },
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
        { label: 'Phun sương theo thời tiết', path: '/domain-expert/weather-rules' },
      ],
    },
    {
      label: 'Cài đặt đếm chim',
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

// readOnly: nhóm chỉ để xem của vai trò này, ghi rõ "(chỉ đọc)"; mọi nhóm đều thu gọn được như nhau
interface SectionPlan {
  group: MenuGroup
  readOnly?: boolean
  only?: string[] // chỉ giữ các mục có đường dẫn này; không ghi thì giữ cả nhóm
  with?: MenuGroup[] // gộp thêm mục của các nhóm này vào cuối
  title?: MenuGroup // lấy tên nhóm này làm tiêu đề thay cho tên của `group`
}

// Nhóm việc chính của vai trò đứng đầu; dock điện thoại là 4 trang vai trò đó dùng nhiều nhất
// hide: mục hoặc tab ẩn khỏi menu của vai trò này, ở mọi nhóm (trang vẫn mở được bằng đường dẫn)
const ROLE_PLAN: Record<Role, { sections: SectionPlan[]; dock: string[]; hide?: string[] }> = {
  ADMIN: {
    // Việc hằng ngày (tổng quan, cảnh báo thiết bị, thiết bị) một nhóm, việc quản trị hệ thống một nhóm
    sections: [{ group: 'monitor', with: ['manage'], title: 'operations' }, { group: 'system' }],
    dock: ['/system/health', '/devices', '/alerts', '/users'],
  },
  FARM_OWNER: {
    sections: [{ group: 'monitor' }, { group: 'operations' }, { group: 'manage' }, { group: 'expertise' }],
    dock: ['/dashboard', '/alerts', '/vision', '/health'],
  },
  FARM_TECHNICIAN: {
    // Vòng đếm thợ vẽ được nên nhóm Chuyên môn không ghi "chỉ đọc"; phân tích, khuyến nghị, ngưỡng và lịch đếm là việc của chủ nhà yến và chuyên gia nên thợ không cần ở menu
    sections: [{ group: 'monitor' }, { group: 'operations' }, { group: 'manage' }, { group: 'expertise' }],
    dock: ['/alerts', '/work-orders', '/dashboard', '/health'],
    hide: ['/analytics', '/recommendations', '/domain-expert/tuning', '/domain-expert/weather-rules', '/domain-expert/counting-schedule'],
  },
  DOMAIN_EXPERT: {
    // Chuyên gia quyết định ở nhóm Chuyên môn; chỉ giữ ba trang số liệu để đối chiếu khi quyết định, còn việc vận hành, thiết bị là của chủ nhà yến
    sections: [{ group: 'expertise' }, { group: 'monitor', readOnly: true, only: ['/analytics', '/vision', '/health'] }],
    dock: ['/domain-expert/queue', '/domain-expert/alert-verdicts', '/domain-expert/tuning', '/domain-expert/counting-schedule'],
  },
}

// Mục mở trang đầu tiên vai trò vào được; còn một tab thì thôi hiện tab
function itemFor(role: Role, item: MenuItem, hide: string[] = []): MenuItem | null {
  if (!item.tabs) return canAccessPath(role, item.path) && !hide.includes(item.path) ? item : null
  const tabs = item.tabs.filter(tab => canAccessPath(role, tab.path) && !hide.includes(tab.path))
  if (tabs.length === 0) return null
  return tabs.length === 1 ? { ...item, path: tabs[0].path, tabs: undefined } : { ...item, path: tabs[0].path, tabs }
}

export function roleMenu(role: Role): { sections: MenuSection[]; dock: MenuItem[] } {
  const plan = ROLE_PLAN[role]
  const sections = plan.sections
    .map(({ group, readOnly, only, with: merged = [], title = group }) => ({
      title: readOnly ? `${GROUP_TITLE[title]} (chỉ đọc)` : GROUP_TITLE[title],
      collapsible: true,
      items: [group, ...merged].flatMap(name => CATALOG[name])
        .filter(item => !only || only.includes(item.path))
        .map(item => itemFor(role, item, plan.hide))
        .filter((item): item is MenuItem => item !== null),
    }))
    .filter(section => section.items.length > 0)
  const items = sections.flatMap(section => section.items)
  const dock = plan.dock
    .map(path => items.find(item => item.path === path || item.tabs?.some(tab => tab.path === path)))
    .filter((item): item is MenuItem => item !== undefined)
  return { sections, dock }
}
