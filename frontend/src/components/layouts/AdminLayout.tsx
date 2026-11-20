import AppShell from '@/components/layouts/AppShell'
import type { MenuItem, MenuSection } from '@/components/layouts/AppSidebar'
import {
  IconAlert, IconAnalytics, IconDashboard,
  IconDevice, IconOTA, IconOnboarding, IconSettings, IconUsers,
} from '@/components/ui/icons'

// AUTH-FR-011 quản lý tài khoản, AUTH-FR-012 hàng đợi xoá tài khoản là tab thứ hai; dock dùng cùng mục để sáng ở cả hai tab
const usersItem: MenuItem = {
  label: 'Người dùng',
  path: '/users',
  icon: IconUsers,
  tabs: [
    { label: 'Tài khoản', path: '/users' },
    { label: 'Yêu cầu xoá tài khoản', path: '/account-requests' },
  ],
}

// Khung Admin (§3.4): Tổng quan hệ thống là trang nhà (SYSTEM-FR-003); thiết bị mọi farm (FARM-FR-009, 013); không có trang farm
const menuSections: MenuSection[] = [
  {
    title: 'Theo dõi',
    items: [
      { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
      { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
    ],
  },
  {
    // FARM-FR-009, 010, 013 — thiết bị mọi farm (bộ điều khiển và camera), kho và nhãn QR, RESTART, PUSH_CONFIG, OTA
    title: 'Thiết bị',
    items: [
      { label: 'Danh sách thiết bị', path: '/devices', icon: IconDevice },
      { label: 'Kho thiết bị', path: '/system/device-stock', icon: IconOnboarding },
      { label: 'Cập nhật firmware', path: '/ota', icon: IconOTA },
    ],
  },
  {
    // Module SYSTEM (mục 5.11) và tài khoản (AUTH-FR-011, 012)
    title: 'Hệ thống',
    items: [
      usersItem,
      { label: 'Cấu hình mặc định', path: '/system/settings', icon: IconSettings },
      { label: 'Nhật ký hệ thống', path: '/system/audit-log', icon: IconAnalytics },
    ],
  },
]

// Dock điện thoại: 4 mục dùng nhiều nhất, 4 mục còn lại vào "Thêm"
const dockItems: MenuItem[] = [
  { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
  { label: 'Danh sách thiết bị', path: '/devices', icon: IconDevice },
  { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
  usersItem,
]

export default function AdminLayout() {
  return <AppShell menuSections={menuSections} dockItems={dockItems} />
}
