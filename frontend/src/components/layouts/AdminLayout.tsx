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

// Khung Admin: Tổng quan hệ thống là trang nhà (SYSTEM-FR-003); Console thiết bị /devices, /alerts, /ota cho mọi farm (FARM-FR-009, 013); không có trang farm
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
    ],
  },
  {
    // FARM-FR-009, 013 — thiết bị mọi farm kèm farm, nhà, khu vực (bộ điều khiển và camera); RESTART, PUSH_CONFIG, OTA
    title: 'Console thiết bị',
    items: [
      { label: 'Danh sách thiết bị', path: '/devices', icon: IconDevice },
      { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
      { label: 'Cập nhật firmware', path: '/ota', icon: IconOTA },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      usersItem,
    ],
  },
  {
    // Module SYSTEM (mục 5.11) — "control center" chỉ Admin
    title: 'Hệ thống',
    items: [
      // FARM-FR-010 — nhập thiết bị, in nhãn QR, cấp lại mã, thu hồi
      { label: 'Kho thiết bị', path: '/system/device-stock', icon: IconOnboarding },
      { label: 'Cấu hình mặc định', path: '/system/settings', icon: IconSettings },
      { label: 'Nhật ký hệ thống', path: '/system/audit-log', icon: IconAnalytics },
    ],
  },
]

/**
 * Dock mobile: ưu tiên Console Thiết bị (trang nhà G-20) và Quản lý người dùng.
 */
const dockItems: MenuItem[] = [
  { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
  { label: 'Danh sách thiết bị', path: '/devices', icon: IconDevice },
  { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
  usersItem,
]

export default function AdminLayout() {
  return <AppShell menuSections={menuSections} dockItems={dockItems} />
}
