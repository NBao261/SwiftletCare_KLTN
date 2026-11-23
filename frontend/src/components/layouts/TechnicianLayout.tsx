import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import { WrenchIcon } from '@phosphor-icons/react'
import { IconAlert, IconDevice, IconFarm } from '@/components/ui/icons'

// Khung Farm Technician trên web: mọi việc của thợ ở nhà được giao (G-33); dock là 4 mục đầu
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
      {
        label: 'Công việc',
        path: '/work-orders',
        icon: WrenchIcon,
        tabs: [
          { label: 'Phiếu công việc', path: '/work-orders' },
          { label: 'Bảo trì định kỳ', path: '/maintenance' },
          { label: 'Khuyến nghị', path: '/recommendations' },
        ],
      },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: IconDevice },
      { label: 'Nhà được giao', path: '/farms', icon: IconFarm },
    ],
  },
]

export default function TechnicianLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
