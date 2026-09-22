import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import {
  IconAlert, IconAnalytics, IconDashboard, IconDevice,
  IconFarm, IconHarvest, IconSettings, IconTicket,
} from '@/components/ui/icons'

/**
 * Khung ứng dụng cho Farm Owner — role duy nhất có Tổng quan + Phân tích (giám
 * sát môi trường chi tiết theo zone) và Thu hoạch & Chợ yến.
 */
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành LALALA',
    items: [
      { label: 'Tổng quan NÈ', path: '/dashboard', icon: IconDashboard },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: IconDevice },
      { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { label: 'Trang trại', path: '/farms', icon: IconFarm },
      { label: 'Ticket', path: '/tickets', icon: IconTicket },
      { label: 'Thu hoạch & Chợ yến', path: '/harvests', icon: IconHarvest },
    ],
  },
  {
    title: 'Khác',
    items: [
      { label: 'Phân tích', path: '/analytics', icon: IconAnalytics },
      { label: 'Cài đặt', path: '/settings', icon: IconSettings },
    ],
  },
]

export default function FarmOwnerLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
