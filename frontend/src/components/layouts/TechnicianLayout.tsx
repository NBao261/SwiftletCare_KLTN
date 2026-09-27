import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import { IconAlert, IconDevice, IconFarm, IconOnboarding, IconOTA, IconSettings, IconTicket } from '@/components/ui/icons'

/**
 * Khung ứng dụng cho Technician — nghiệp vụ kỹ thuật: theo dõi tín hiệu thiết
 * bị (online/offline/RSSI), xử lý cảnh báo và ticket. Không có Tổng quan/Phân
 * tích vì họ không giám sát môi trường chi tiết theo zone như chủ nhà yến.
 *
 * Dock mobile: firstDockItems lấy 4 mục đầu = Devices, Alerts, Farms, Tickets.
 * Onboarding + OTA đặt SAU Tickets ở section "Kỹ thuật" → chỉ hiển thị sidebar,
 * KHÔNG bị đẩy vào dock — tránh lặp lại lỗi round 1.
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
      { label: 'Ticket', path: '/tickets', icon: IconTicket },
    ],
  },
  {
    title: 'Kỹ thuật',
    items: [
      { label: 'Lắp đặt thiết bị', path: '/onboarding', icon: IconOnboarding },
      { label: 'OTA Firmware', path: '/ota', icon: IconOTA },
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

