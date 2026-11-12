import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import { IconAlert, IconDevice, IconFarm, IconSettings } from '@/components/ui/icons'

/**
 * Khung ứng dụng cho Farm Technician (G-20: đổi từ Technician hệ thống cũ).
 * Nghiệp vụ: theo dõi thiết bị và cảnh báo của nhà yến được giao;
 * xem cấu trúc trang trại (nhà được giao), gửi RESTART.
 * Không có OTA/PUSH_CONFIG (gọi API → 403) và không có /onboarding (chỉ FARM_OWNER).
 *
 * Dock mobile: firstDockItems lấy 4 mục đầu = Devices, Alerts, Farms, Settings.
 */
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: IconDevice },
      { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { label: 'Trang trại', path: '/farms', icon: IconFarm },
    ],
  },
  {
    title: 'Khác',
    items: [{ label: 'Cài đặt', path: '/settings', icon: IconSettings }],
  },
]

export default function TechnicianLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
