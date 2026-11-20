import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import { IconAlert, IconDevice, IconFarm } from '@/components/ui/icons'

// Khung Farm Technician trên web (Report 4 §5.4, todo-ui-layout §3.3): cảnh báo đứng đầu (MF-02), thiết bị, nhà được giao; Cài đặt chỉ ở menu avatar (SH-03)
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: IconDevice },
      { label: 'Nhà được giao', path: '/farms', icon: IconFarm },
    ],
  },
]

export default function TechnicianLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
