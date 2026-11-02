import AppShell from '@/components/layouts/AppShell'
import type { MenuItem, MenuSection } from '@/components/layouts/AppSidebar'
import {
  IconAnalytics, IconBell, IconDashboard,
  IconDevice, IconSettings, IconUsers,
} from '@/components/ui/icons'

/**
 * Khung ứng dụng cho Admin. "Tổng quan hệ thống" đặt ngay đầu sidebar vì là
 * trang nhà sau đăng nhập (SYSTEM-FR-003, gộp luôn OPS-NFR-004 — trạng thái
 * node), không lặp lại ở nhóm "Hệ thống". Admin không thấy farm nào (Report 3
 * §2.4): không có Cảnh báo, Thu hoạch hay Trang trại.
 */
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
      // OPS-NFR-004 — bảng chỉ xem toàn hệ thống; không trỏ /devices (màn kích hoạt/điều khiển của Technician,
      // SRS RACI: Admin chỉ "I (audit)" với thiết bị)
      { label: 'Thiết bị & Cảm biến', path: '/system/devices', icon: IconDevice },
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
 * Admin có nhiều mục nên dock mobile phải chọn tay — lấy 4 mục đầu sidebar theo
 * mặc định thì Người dùng/Yêu cầu tài khoản không bao giờ mở được từ điện thoại.
 */
const dockItems: MenuItem[] = [
  { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
  { label: 'Thiết bị & Cảm biến', path: '/system/devices', icon: IconDevice },
  { label: 'Người dùng', path: '/users', icon: IconUsers },
  { label: 'Yêu cầu tài khoản', path: '/account-requests', icon: IconBell },
]

export default function AdminLayout() {
  return <AppShell menuSections={menuSections} dockItems={dockItems} />
}
