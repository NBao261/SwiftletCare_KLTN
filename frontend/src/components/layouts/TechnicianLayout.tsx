import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import { IconAlert, IconDevice, IconFarm, IconSettings } from '@/components/ui/icons'

// Khung Farm Technician trên web (Report 4 §5.4): thiết bị, cảnh báo và nhà được giao, cài đặt; dock mobile là 4 mục này
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
