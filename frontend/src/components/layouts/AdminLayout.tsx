import AppShell from '@/components/layouts/AppShell'
import type { MenuItem, MenuSection } from '@/components/layouts/AppSidebar'
import {
  IconAlert, IconAnalytics, IconBell, IconDashboard,
  IconDevice, IconFarm, IconSettings, IconTicket, IconUsers,
} from '@/components/ui/icons'

/**
 * Khung ứng dụng cho Admin. "Tổng quan hệ thống" đặt ngay đầu sidebar vì là
 * trang nhà sau đăng nhập (SYSTEM-FR-003, gộp luôn OPS-NFR-004 — trạng thái
 * node), không lặp lại ở nhóm "Hệ thống". Cố ý không có Thu hoạch: backend vẫn
 * cho Admin gọi /harvests, nhưng theo lựa chọn sản phẩm sidebar Admin đi theo
 * hướng kỹ thuật, giống Technician.
 */
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: IconDevice },
      { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { label: 'Trang trại', path: '/farms', icon: IconFarm },
      { label: 'Ticket', path: '/tickets', icon: IconTicket },
      // AUTH-FR-011 — quản lý tài khoản toàn hệ thống (RACI mục 4.4)
      { label: 'Người dùng', path: '/users', icon: IconUsers },
      // AUTH-FR-012 (hàng đợi xoá tài khoản) + AUTH-FR-005d (đề xuất Sales Staff)
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
 * Admin có 10 mục nên dock mobile phải chọn tay — lấy 4 mục đầu sidebar theo
 * mặc định thì Người dùng/Yêu cầu tài khoản không bao giờ mở được từ điện thoại.
 */
const dockItems: MenuItem[] = [
  { label: 'Tổng quan hệ thống', path: '/system/health', icon: IconDashboard },
  { label: 'Ticket', path: '/tickets', icon: IconTicket },
  { label: 'Người dùng', path: '/users', icon: IconUsers },
  { label: 'Yêu cầu tài khoản', path: '/account-requests', icon: IconBell },
]

export default function AdminLayout() {
  return <AppShell menuSections={menuSections} dockItems={dockItems} />
}
