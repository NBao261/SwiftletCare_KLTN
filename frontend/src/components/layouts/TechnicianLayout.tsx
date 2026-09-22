import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import { IconAlert, IconDevice, IconFarm, IconSettings, IconTicket } from '@/components/ui/icons'

/**
 * Khung ứng dụng cho Technician — nghiệp vụ kỹ thuật: theo dõi tín hiệu thiết
 * bị (online/offline/RSSI), xử lý cảnh báo và ticket. Không có Tổng quan/Phân
 * tích vì họ không giám sát môi trường chi tiết theo zone như chủ nhà yến.
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
    title: 'Khác',
    items: [{ label: 'Cài đặt', path: '/settings', icon: IconSettings }],
  },
]

export default function TechnicianLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
