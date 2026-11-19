import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import { IconAlert, IconDevice, IconFarm, IconSettings } from '@/components/ui/icons'

// Khung Farm Technician trên web (Report 4 §5.4): cảnh báo đứng đầu (MF-02: thợ nhận cảnh báo của nhà trước), thiết bị
// và nhà được giao, cài đặt; dock mobile là 4 mục này
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: IconDevice },
      { label: 'Nhà được giao', path: '/farms', icon: IconFarm },
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
