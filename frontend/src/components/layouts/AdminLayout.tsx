import AppShell from '@/components/layouts/AppShell'
import type { MenuItem, MenuSection } from '@/components/layouts/AppSidebar'
import {
  IconAlert, IconAnalytics, IconBell, IconDashboard,
  IconDevice, IconOTA, IconSettings, IconUsers,
} from '@/components/ui/icons'

/**
 * Khung ứng dụng cho Admin. "Tổng quan hệ thống" đặt ngay đầu sidebar vì là
 * trang nhà sau đăng nhập (SYSTEM-FR-003, gộp luôn OPS-NFR-004 — trạng thái node).
 * G-20: Admin có Console thiết bị (/devices, /alerts, /ota) — xem thiết bị mọi farm
 * qua GET /devices/sensor-nodes, cảnh báo thiết bị, gửi RESTART/PUSH_CONFIG/OTA.
 * Không có Thu hoạch hay Trang trại (Admin không xem GET /farms).
 */
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
      // OPS-NFR-004 — bảng system-status chỉ xem (node_id, farm_name, house_name, zone_name)
      { label: 'Trạng thái Node', path: '/system/devices', icon: IconDevice },
    ],
  },
  {
    // G-20: Console thiết bị của Administrator
    // ADMIN xem thiết bị mọi farm + gửi RESTART, PUSH_CONFIG, OTA (FARM-FR-009/013)
    title: 'Console Thiết bị',
    items: [
      { label: 'Danh sách thiết bị', path: '/devices', icon: IconDevice },
      { label: 'Cảnh báo thiết bị', path: '/alerts', icon: IconAlert },
      { label: 'OTA Firmware', path: '/ota', icon: IconOTA },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      // AUTH-FR-011 — quản lý tài khoản toàn hệ thống (RACI mục 4.4)
      { label: 'Người dùng', path: '/users', icon: IconUsers },
      // AUTH-FR-012 (hàng đợi xoá tài khoản)
      { label: 'Yêu cầu tài khoản', path: '/account-requests', icon: IconBell },
    ],
  },
  {
    // Module SYSTEM (mục 5.11) — "control center" chỉ Admin
    title: 'Hệ thống',
    items: [
      { label: 'Cấu hình mặc định', path: '/system/settings', icon: IconSettings },
      { label: 'Nhật ký hệ thống', path: '/system/audit-log', icon: IconAnalytics },
    ],
  },
  {
    title: 'Khác',
    items: [{ label: 'Cài đặt', path: '/settings', icon: IconSettings }],
  },
]

/**
 * Dock mobile: ưu tiên Console Thiết bị (trang nhà G-20) và Quản lý người dùng.
 */
const dockItems: MenuItem[] = [
  { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
  { label: 'Danh sách thiết bị', path: '/devices', icon: IconDevice },
  { label: 'Cảnh báo thiết bị', path: '/alerts', icon: IconAlert },
  { label: 'Người dùng', path: '/users', icon: IconUsers },
]

export default function AdminLayout() {
  return <AppShell menuSections={menuSections} dockItems={dockItems} />
}
